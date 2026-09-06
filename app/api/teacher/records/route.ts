import { NextResponse } from "next/server";
import { isTeacherAuthenticated } from "@/lib/auth";
import { clearSpeakingRecords, getSpeakingRecords, getSpeakingSummaries } from "@/lib/speaking";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isTeacherAuthenticated())) return NextResponse.json({ error: "老師登入已失效" }, { status: 401 });
  try {
    const records = await getSpeakingRecords();
    return NextResponse.json({ records, summary: await getSpeakingSummaries(records) });
  } catch (error) {
    console.error("讀取口說練習紀錄失敗", error);
    return NextResponse.json({ error: "伺服器無法讀取練習紀錄" }, { status: 500 });
  }
}

export async function DELETE() {
  if (!(await isTeacherAuthenticated())) return NextResponse.json({ error: "老師登入已失效" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await clearSpeakingRecords()) });
  } catch (error) {
    console.error("備份並清空口說練習紀錄失敗", error);
    return NextResponse.json({ error: "伺服器無法清空練習紀錄" }, { status: 500 });
  }
}
