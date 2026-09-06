import { NextResponse } from "next/server";
import { getSpeakingArticles } from "@/lib/speaking";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ articles: await getSpeakingArticles() });
  } catch (error) {
    console.error("讀取朗讀文章失敗", error);
    return NextResponse.json({ error: "伺服器無法讀取朗讀文章" }, { status: 500 });
  }
}
