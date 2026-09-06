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

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  if (!apiKey) return NextResponse.json({ error: "尚未設定 GEMINI_API_KEY" }, { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > 100_000) {
    return NextResponse.json({ error: "對話內容太大" }, { status: 413 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const history = (Array.isArray(body.history) ? body.history : []).slice(-60).map((item) => {
      const turn = (item ?? {}) as Record<string, unknown>;
      return {
        role: turn.role === "model" ? "model" : "user",
        parts: [{ text: typeof turn.text === "string" ? turn.text.slice(0, 500).trim() : "" }],
      };
    }).filter((turn) => turn.parts[0].text);
    if (!history.length) return NextResponse.json({ error: "缺少對話內容" }, { status: 400 });
    const level = ["1200", "2000", "3500"].includes(String(body.level)) ? String(body.level) : "2000";

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: history,
          systemInstruction: { parts: [{ text: body.feedback === true ? feedbackPrompt : conversationPrompt(level) }] },
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    const data = await upstream.json();
    if (!upstream.ok) {
      console.error("Gemini API error", upstream.status, data);
      return NextResponse.json({ error: data?.error?.message || "Gemini API 呼叫失敗" }, { status: upstream.status });
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "（AI 沒有回應內容，請再試一次）";
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "送出的內容不是合法的 JSON" }, { status: 400 });
    console.error("伺服器呼叫 Gemini 失敗", error);
    return NextResponse.json({ error: "伺服器連線 Gemini API 失敗" }, { status: 500 });
  }
}
