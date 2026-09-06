import { NextRequest, NextResponse } from "next/server";
import { getSpeakingRecords, speakingRecordsCsv } from "@/lib/speaking";

export async function GET(request: NextRequest) {
  const wanted = request.nextUrl.searchParams.get("class");
  const records = (await getSpeakingRecords()).filter((record) => !wanted || wanted === "all" || record.className === wanted).reverse();
  return new NextResponse(speakingRecordsCsv(records), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="practice-records.csv"' },
  });
}
