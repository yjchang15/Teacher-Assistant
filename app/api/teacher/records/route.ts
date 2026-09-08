import { NextResponse } from "next/server";
import { getSpeakingRecords, getSpeakingSummaries } from "@/lib/speaking";

export const dynamic = "force-dynamic";

// 後台畫面自己在伺服器端讀資料，這個端點留給 test/speaking 的情境測試回頭驗證
// 學生送出的紀錄真的寫進去了。刪除已經改由 /admin/speaking 的 server action 處理。
export async function GET() {
  try {
    const records = await getSpeakingRecords();
    return NextResponse.json({ records, summary: await getSpeakingSummaries(records) });
  } catch (error) {
    console.error("讀取口說練習紀錄失敗", error);
    return NextResponse.json({ error: "伺服器無法讀取練習紀錄" }, { status: 500 });
  }
}
