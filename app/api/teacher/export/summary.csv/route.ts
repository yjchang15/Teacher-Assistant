import { NextRequest, NextResponse } from "next/server";
import { getSpeakingRecords, getSpeakingSummaries, speakingSummaryCsv } from "@/lib/speaking";

export async function GET(request: NextRequest) {
  const wanted = request.nextUrl.searchParams.get("class");
  const all = await getSpeakingSummaries(await getSpeakingRecords());
  const summaries = all.filter((summary) => !wanted || wanted === "all" || summary.className === wanted);
  return new NextResponse(speakingSummaryCsv(summaries), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="practice-summary.csv"' },
  });
}
