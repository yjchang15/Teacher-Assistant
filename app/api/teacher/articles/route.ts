import { NextRequest, NextResponse } from "next/server";
import { isTeacherAuthenticated } from "@/lib/auth";
import { createSpeakingArticle, getSpeakingArticles } from "@/lib/speaking";

export async function GET() {
  if (!(await isTeacherAuthenticated())) return NextResponse.json({ error: "老師登入已失效" }, { status: 401 });
  return NextResponse.json({ articles: await getSpeakingArticles() });
}

export async function POST(request: NextRequest) {
  if (!(await isTeacherAuthenticated())) return NextResponse.json({ error: "老師登入已失效" }, { status: 401 });
  try {
    const result = await createSpeakingArticle((await request.json())?.text);
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  } catch (error) {
    console.error("新增朗讀文章失敗", error);
    return NextResponse.json({ error: "新增文章失敗" }, { status: 500 });
  }
}
