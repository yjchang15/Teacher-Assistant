import { NextRequest, NextResponse } from "next/server";
import { appendSpeakingRecord, normalizeSpeakingRecord } from "@/lib/speaking";

export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 1_000_000) {
    return NextResponse.json({ error: "送出的內容太大" }, { status: 413 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const normalized = normalizeSpeakingRecord(body);
    if (!normalized.record) return NextResponse.json({ error: normalized.error }, { status: 400 });
    const saved = await appendSpeakingRecord(normalized.record);
    return NextResponse.json({ ok: true, id: saved.id });
  } catch (error) {
    if ((error as Error).message === "INVALID_CLASS_SEAT") {
      return NextResponse.json({ error: "班級或座號已變更，請返回首頁重新選擇" }, { status: 400 });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "送出的內容不是合法的 JSON" }, { status: 400 });
    console.error("寫入口說練習紀錄失敗", error);
    return NextResponse.json({ error: "伺服器無法寫入練習紀錄" }, { status: 500 });
  }
}
