import { NextResponse } from "next/server";
import { deleteSpeakingRecords, getSpeakingRecords, getSpeakingSummaries } from "@/lib/speaking";
import { parseSpeakingDeleteFilter } from "@/lib/speaking-delete";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const records = await getSpeakingRecords();
    return NextResponse.json({ records, summary: await getSpeakingSummaries(records) });
  } catch (error) {
    console.error("讀取口說練習紀錄失敗", error);
    return NextResponse.json({ error: "伺服器無法讀取練習紀錄" }, { status: 500 });
  }
}

// ?id=… 刪一筆、?className=…&student=… 刪一位學生、不帶參數則清空全部。
export async function DELETE(request: Request) {
  const { filter, error } = parseSpeakingDeleteFilter(new URL(request.url).searchParams);
  if (!filter) return NextResponse.json({ error }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await deleteSpeakingRecords(filter)) });
  } catch (err) {
    console.error("備份並刪除口說練習紀錄失敗", err);
    return NextResponse.json({ error: "伺服器無法刪除練習紀錄" }, { status: 500 });
  }
}
