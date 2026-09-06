import { NextRequest, NextResponse } from "next/server";
import { isTeacherAuthenticated } from "@/lib/auth";
import { getSpeakingRecords, getSpeakingSummaries, speakingSummaryCsv } from "@/lib/speaking";

export async function GET(request: NextRequest) {
  if (!(await isTeacherAuthenticated())) return NextResponse.json({ error: "老師登入已失效" }, { status: 401 });
  const wanted = request.nextUrl.searchParams.get("class");
  const all = await getSpeakingSummaries(await getSpeakingRecords());
  const summaries = all.filter((summary) => !wanted || wanted === "all" || summary.className === wanted);
  return new NextResponse(speakingSummaryCsv(summaries), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="practice-summary.csv"' },
  });
}
