// Tests for app/api/chat/route.ts. It lives here because `npm test` collects
// lib/**/*.test.ts, and a *.test.ts under app/api would sit inside the route
// folder Next.js scans.
import assert from "node:assert/strict";
import test from "node:test";

type Upstream = { status: number; body: string };

// Each case gets its own module instance: the route remembers, per model, which
// thinking setting the API accepted, and that memory must not leak between tests.
async function loadRoute(model: string) {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = model;
  const mod = await import(`../app/api/chat/route?case=${Math.random()}`);
  return mod.POST as (request: Request) => Promise<Response>;
}

function stubFetch(reply: (payload: Record<string, unknown>) => Upstream) {
  const sent: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const payload = JSON.parse(String(init.body));
    sent.push(payload);
    const { status, body } = reply(payload);
    return new Response(body, { status });
  }) as typeof fetch;
  return sent;
}

const sse = (text: string) =>
  `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;

const ask = (body: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ history: [{ role: "user", text: "hello" }], level: "2000", ...body }),
  });

const thinkingOf = (payload: Record<string, unknown>) =>
  (payload.generationConfig as Record<string, unknown>).thinkingConfig;

test("a Gemini 3 model is asked for the shortest thinking first", async () => {
  const post = await loadRoute("gemini-3.6-flash");
  const sent = stubFetch(() => ({ status: 200, body: sse("Hi!") }));
  const res = await post(ask());
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "Hi!");
  assert.deepEqual(thinkingOf(sent[0]), { thinkingLevel: "minimal" });
});

test("a model that rejects the shortest level falls back, then remembers", async () => {
  const post = await loadRoute("gemini-3.8-flash");
  const sent = stubFetch((payload) =>
    thinkingOf(payload) && (thinkingOf(payload) as { thinkingLevel: string }).thinkingLevel === "minimal"
      ? { status: 400, body: JSON.stringify({ error: { message: "Invalid value at 'generation_config.thinking_config.thinking_level'" } }) }
      : { status: 200, body: sse("Hi!") });

  assert.equal((await post(ask())).status, 200);
  assert.deepEqual(sent.map(thinkingOf), [{ thinkingLevel: "minimal" }, { thinkingLevel: "low" }]);

  sent.length = 0;
  assert.equal((await post(ask())).status, 200);
  assert.deepEqual(sent.map(thinkingOf), [{ thinkingLevel: "low" }], "the rejected level must not be tried again");
});

test("a Gemini 2.5 model gets a thinking budget instead of a level", async () => {
  const post = await loadRoute("gemini-2.5-flash");
  const sent = stubFetch(() => ({ status: 200, body: sse("Hi!") }));
  await post(ask());
  assert.deepEqual(thinkingOf(sent[0]), { thinkingBudget: 0 });
});

test("an unrecognised model is sent no thinking setting at all", async () => {
  const post = await loadRoute("some-other-model");
  const sent = stubFetch(() => ({ status: 200, body: sse("Hi!") }));
  await post(ask());
  assert.equal(thinkingOf(sent[0]), undefined);
});

test("a failure unrelated to thinking reaches the student unchanged, without a retry", async () => {
  const post = await loadRoute("gemini-3.6-flash");
  const sent = stubFetch(() => ({ status: 400, body: JSON.stringify({ error: { message: "API key not valid" } }) }));
  const res = await post(ask());
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "API key not valid" });
  assert.equal(sent.length, 1);
});

test("the model's own thinking is never sent to the student", async () => {
  const post = await loadRoute("gemini-3.6-flash");
  stubFetch(() => ({
    status: 200,
    body: `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "let me think", thought: true }, { text: "Hello!" }] } }] })}\n\n`,
  }));
  assert.equal(await (await post(ask())).text(), "Hello!");
});

test("a reply that arrives in pieces is passed on in pieces", async () => {
  const post = await loadRoute("gemini-3.6-flash");
  stubFetch(() => ({ status: 200, body: sse("That sounds fun. ") + sse("Where did you go?") }));
  assert.equal(await (await post(ask())).text(), "That sounds fun. Where did you go?");
});

test("an empty reply says so rather than going silent", async () => {
  const post = await loadRoute("gemini-3.6-flash");
  stubFetch(() => ({ status: 200, body: sse("") }));
  assert.equal(await (await post(ask())).text(), "（AI 沒有回應內容，請再試一次）");
});

test("chatting sends the recent turns; feedback sends the whole lesson", async () => {
  const post = await loadRoute("gemini-3.6-flash");
  const sent = stubFetch(() => ({ status: 200, body: sse("ok") }));
  const history = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "model" : "user", text: `turn ${i}` }));

  await post(ask({ history }));
  assert.equal((sent[0].contents as unknown[]).length, 20);
  assert.match(String((sent[0].systemInstruction as { parts: { text: string }[] }).parts[0].text), /conversation partner/);

  await post(ask({ history, feedback: true }));
  assert.equal((sent[1].contents as unknown[]).length, 40);
  assert.match(String((sent[1].systemInstruction as { parts: { text: string }[] }).parts[0].text), /feedback/);
});

test("the vocabulary level chooses the instructions", async () => {
  const post = await loadRoute("gemini-3.6-flash");
  const sent = stubFetch(() => ({ status: 200, body: sse("ok") }));
  await post(ask({ level: "1200" }));
  await post(ask({ level: "nonsense" }));
  const instruction = (i: number) => String((sent[i].systemInstruction as { parts: { text: string }[] }).parts[0].text);
  assert.match(instruction(0), /1,200-word/);
  assert.match(instruction(1), /2,000-word/, "an unknown level falls back to the standard one");
});

test("an empty conversation is refused before calling the API", async () => {
  const post = await loadRoute("gemini-3.6-flash");
  const sent = stubFetch(() => ({ status: 200, body: sse("ok") }));
  const res = await post(ask({ history: [] }));
  assert.equal(res.status, 400);
  assert.equal(sent.length, 0);
});

test("a missing API key is reported as configuration, not as a chat failure", async () => {
  process.env.GEMINI_API_KEY = "";
  const mod = await import(`../app/api/chat/route?case=${Math.random()}`);
  const res = await (mod.POST as (r: Request) => Promise<Response>)(ask());
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "尚未設定 GEMINI_API_KEY" });
});
