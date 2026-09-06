import { NextRequest, NextResponse } from "next/server";
import { isTeacherAuthenticated } from "@/lib/auth";
import { deleteSpeakingArticle, updateSpeakingArticle } from "@/lib/speaking";

function articleId(params: Promise<{ id: string }>): Promise<number> {
  return params.then(({ id }) => Number.parseInt(id, 10));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isTeacherAuthenticated())) return NextResponse.json({ error: "老師登入已失效" }, { status: 401 });
  const id = await articleId(params);
  if (!Number.isSafeInteger(id)) return NextResponse.json({ error: "文章編號錯誤" }, { status: 400 });
  try {
    const result = await updateSpeakingArticle(id, (await request.json())?.text);
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  } catch (error) {
    console.error("更新朗讀文章失敗", error);
    return NextResponse.json({ error: "更新文章失敗" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isTeacherAuthenticated())) return NextResponse.json({ error: "老師登入已失效" }, { status: 401 });
  const id = await articleId(params);
  if (!Number.isSafeInteger(id)) return NextResponse.json({ error: "文章編號錯誤" }, { status: 400 });
  try {
    const result = await deleteSpeakingArticle(id);
    return NextResponse.json(result, { status: result.error ? 404 : 200 });
  } catch (error) {
    console.error("刪除朗讀文章失敗", error);
    return NextResponse.json({ error: "刪除文章失敗" }, { status: 500 });
  }
}
