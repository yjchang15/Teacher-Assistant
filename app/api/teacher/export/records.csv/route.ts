import { NextRequest, NextResponse } from "next/server";
import { isTeacherAuthenticated } from "@/lib/auth";
import { getSpeakingRecords, speakingRecordsCsv } from "@/lib/speaking";

export async function GET(request: NextRequest) {
  if (!(await isTeacherAuthenticated())) return NextResponse.json({ error: "老師登入已失效" }, { status: 401 });
  const wanted = request.nextUrl.searchParams.get("class");
  const records = (await getSpeakingRecords()).filter((record) => !wanted || wanted === "all" || record.className === wanted).reverse();
  return new NextResponse(speakingRecordsCsv(records), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="practice-records.csv"' },
  });
}
