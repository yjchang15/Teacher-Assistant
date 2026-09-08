"use server";

import { revalidatePath } from "next/cache";
import {
  createSpeakingArticle,
  deleteSpeakingArticle,
  deleteSpeakingRecords,
  updateSpeakingArticle,
} from "@/lib/speaking";

const PATH = "/admin/speaking";

// 每個動作都回傳結果讓畫面自己說話：這些是客戶端元件直接呼叫的，不走 <form>，
// 所以沒有 redirect，重畫交給 revalidatePath。

export async function addArticle(text: string): Promise<{ error?: string }> {
  const result = await createSpeakingArticle(text);
  if (result.error) return { error: result.error };
  revalidatePath(PATH);
  return {};
}

export async function saveArticle(id: string, text: string): Promise<{ error?: string }> {
  const result = await updateSpeakingArticle(Number(id), text);
  if (result.error) return { error: result.error };
  revalidatePath(PATH);
  return {};
}

export async function removeArticle(id: string): Promise<{ error?: string }> {
  const result = await deleteSpeakingArticle(Number(id));
  if (result.error) return { error: result.error };
  revalidatePath(PATH);
  return {};
}

export async function deleteRecord(id: string): Promise<{ cleared: number; backup: string | null }> {
  const result = await deleteSpeakingRecords({ scope: "record", id });
  revalidatePath(PATH);
  return { cleared: result.cleared, backup: result.backup };
}

export async function deleteStudentRecords(className: string, student: string): Promise<{ cleared: number; backup: string | null }> {
  const result = await deleteSpeakingRecords({ scope: "student", className, student });
  revalidatePath(PATH);
  return { cleared: result.cleared, backup: result.backup };
}

// 換學期用：練習紀錄與朗讀文章一起清掉，兩邊都先備份。
export async function clearEverything(): Promise<{ cleared: number; clearedArticles: number; backups: string[] }> {
  const result = await deleteSpeakingRecords({ scope: "all" });
  revalidatePath(PATH);
  return {
    cleared: result.cleared,
    clearedArticles: result.clearedArticles,
    backups: [result.backup, result.articleBackup].filter((id): id is string => !!id),
  };
}
