import { NextRequest, NextResponse } from "next/server";

const LEVELS: Record<string, string> = {
  "1200": "Use only basic English from roughly the most frequent 1,200-word vocabulary (around CEFR A1-A2). Use one very short sentence per turn, at most 10 words. Prefer simple present tense and concrete everyday topics.",
  "2000": "Use only very common English from roughly the most frequent 2,000-word vocabulary (around CEFR A2). Use one short sentence per turn, at most 12 words.",
  "3500": "Use natural intermediate English within roughly a 3,500-word vocabulary (around CEFR B1). You may use up to two sentences per turn, at most 18 words each, and ask questions that invite reasons or opinions.",
};

const feedbackPrompt = [
  "You are an encouraging English teacher for Taiwanese junior high school students.",
  "Based on the conversation transcript, write short feedback in Traditional Chinese in 3 to 5 sentences.",
  "Cover what the student did well, one or two specific vocabulary or grammar improvements, and one encouraging closing sentence.",
  "Use English only when quoting the student's own words.",
].join(" ");

function conversationPrompt(level: string): string {
  return [
    "You are a friendly English conversation partner for a Taiwanese junior high school student.",
    LEVELS[level] || LEVELS["2000"],
    "Open with one short English greeting or question, then let the student lead.",
    "Follow whatever the student wants to talk about; do not force a topic of your own.",
    "Always end your turn with one simple question so the student keeps talking.",
    "Be warm and encouraging. Never switch to Chinese and never explain grammar unless this is the final feedback request.",
  ].join(" ");
}

// 閒聊只需要最近幾輪就接得下去，整份逐字稿每回合重送會讓對話越聊越慢。
// 回饋要評整堂課，所以才需要完整的紀錄。
const CHAT_TURNS = 20;
const FEEDBACK_TURNS = 60;

type Part = { text?: string; thought?: boolean };

// 「思考」內容也會出現在 parts 裡，但那是給開發者看的，不能唸給學生聽。
function visibleText(parts: Part[] | undefined): string {
  if (!Array.isArray(parts)) return "";
  return parts.filter((part) => !part.thought).map((part) => part.text || "").join("");
}

// 免費額度是以每分鐘計的，一整班同時上課很容易短暫超過。這種 429 通常
// 等幾秒就過去了，所以在伺服器端先擋下來重試，不要讓學生看到錯誤訊息。
const RETRY_STATUSES = new Set([429, 500, 503]);
const RETRY_DELAYS_MS = [1_000, 3_000, 7_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiWithRetry(model: string, apiKey: string, payload: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  let last: Response | null = null;

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(30_000),
    });
    if (!RETRY_STATUSES.has(response.status) || attempt >= RETRY_DELAYS_MS.length) return response;

    last = response;
    // 上游說了要等多久就等多久，沒說才用自己的退避時間
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 10_000)
      : RETRY_DELAYS_MS[attempt];
    // body 不讀掉會讓連線一直掛著
    await response.body?.cancel().catch(() => {});
    await sleep(waitMs);
  }
  return last!;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  if (!apiKey) return NextResponse.json({ error: "尚未設定 GEMINI_API_KEY" }, { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > 100_000) {
    return NextResponse.json({ error: "對話內容太大" }, { status: 413 });
  }

  let upstream: Response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const isFeedback = body.feedback === true;
    const history = (Array.isArray(body.history) ? body.history : [])
      .slice(isFeedback ? -FEEDBACK_TURNS : -CHAT_TURNS)
      .map((item) => {
        const turn = (item ?? {}) as Record<string, unknown>;
        return {
          role: turn.role === "model" ? "model" : "user",
          parts: [{ text: typeof turn.text === "string" ? turn.text.slice(0, 500).trim() : "" }],
        };
      })
      .filter((turn) => turn.parts[0].text);
    if (!history.length) return NextResponse.json({ error: "缺少對話內容" }, { status: 400 });
    const level = ["1200", "2000", "3500"].includes(String(body.level)) ? String(body.level) : "2000";

    const payload = JSON.stringify({
      contents: history,
      systemInstruction: { parts: [{ text: isFeedback ? feedbackPrompt : conversationPrompt(level) }] },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        // 國中生的一句閒聊不需要推理，預設的思考時間是這裡最大的延遲來源。
        thinkingLevel: "low",
      },
    });
    upstream = await callGeminiWithRetry(model, apiKey, payload);
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "送出的內容不是合法的 JSON" }, { status: 400 });
    console.error("伺服器呼叫 Gemini 失敗", error);
    return NextResponse.json({ error: "伺服器連線 Gemini API 失敗" }, { status: 500 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("Gemini API error", upstream.status, detail);
    // 重試完還是 429，代表整班真的把每分鐘的免費額度用滿了。
    // 對學生講「等一下再說一次」比貼原始錯誤訊息有用。
    if (upstream.status === 429) {
      return NextResponse.json(
        { error: "現在使用的人太多，請等幾秒再說一次。", retryable: true },
        { status: 429 },
      );
    }
    let message = "Gemini API 呼叫失敗";
    try { message = JSON.parse(detail)?.error?.message || message; } catch { /* 上游不一定回 JSON */ }
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  // 逐段轉成純文字往下丟，學生不必等整段講完才看得到第一個字。
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = upstream.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let emitted = false;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;
          // SSE 以空行分隔事件，最後一段可能被切斷，留在 buffer 等下一塊。
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";
          for (const event of events) {
            const data = event.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("");
            if (!data || data === "[DONE]") continue;
            let chunk: string;
            try {
              chunk = visibleText(JSON.parse(data)?.candidates?.[0]?.content?.parts);
            } catch {
              continue; // 壞掉的一段不值得中斷整場對話
            }
            if (chunk) {
              emitted = true;
              controller.enqueue(encoder.encode(chunk));
            }
          }
        }
        if (!emitted) controller.enqueue(encoder.encode("（AI 沒有回應內容，請再試一次）"));
      } catch (error) {
        console.error("Gemini 串流中斷", error);
        if (!emitted) controller.enqueue(encoder.encode("（AI 回應中斷，請再試一次）"));
      } finally {
        reader.cancel().catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
