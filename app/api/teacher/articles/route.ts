import { NextRequest, NextResponse } from "next/server";
import { createSpeakingArticle, getSpeakingArticles } from "@/lib/speaking";

export async function GET() {
  return NextResponse.json({ articles: await getSpeakingArticles() });
}

export async function POST(request: NextRequest) {
  try {
    const result = await createSpeakingArticle((await request.json())?.text);
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  } catch (error) {
    console.error("新增朗讀文章失敗", error);
    return NextResponse.json({ error: "新增文章失敗" }, { status: 500 });
  }
}
