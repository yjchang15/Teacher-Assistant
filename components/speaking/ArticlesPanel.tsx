"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addArticle, removeArticle, saveArticle } from "@/app/admin/speaking/actions";
import type { AdminArticle } from "./SpeakingAdmin";

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

export default function ArticlesPanel({ articles }: { articles: AdminArticle[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  // 文章編輯到一半的內容放這裡；沒編過的就直接吃伺服器送來的值
  const [edits, setEdits] = useState<Record<string, string>>({});

  function run(action: () => Promise<{ error?: string }>, done: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.error) return setMessage({ text: result.error, error: true });
      setMessage({ text: done });
      after?.();
      router.refresh();
    });
  }

  return (
    <section className="workflow-card p-3">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <h2 className="h6 fw-bold mb-0">朗讀文章</h2>
        <span className="small text-body-secondary">{articles.length ? `共 ${articles.length} 篇` : "尚未設定"}</span>
      </div>
      <p className="small text-body-secondary mt-2">可維護多篇朗讀文章，系統會依順序自動編為「文章 #1、文章 #2…」。</p>

      <div className="mb-3">
        <textarea
          className="form-control"
          rows={4}
          value={draft}
          placeholder="在這裡貼上新的英文文章…"
          aria-label="新文章內容"
          onChange={(event) => setDraft(event.target.value)}
        />
        {message && <p className={`small mt-2 mb-2 ${message.error ? "text-danger" : "text-body-secondary"}`}>{message.text}</p>}
        <button
          type="button"
          className="btn btn-primary mt-2"
          disabled={pending}
          onClick={() => {
            if (!draft.trim()) return setMessage({ text: "請先貼上文章內容。", error: true });
            run(() => addArticle(draft), "文章已新增。", () => setDraft(""));
          }}
        >
          <i className="bi bi-plus-lg me-1" />新增文章
        </button>
      </div>

      {articles.length === 0 ? (
        <div className="empty-state"><i className="bi bi-file-earmark-text" /><strong>還沒有文章</strong><span>請在上方貼上內容並新增。</span></div>
      ) : (
        <div className="speaking-article-list">
          {articles.map((article, index) => {
            const text = edits[article.id] ?? article.text;
            return (
              <article className="speaking-article" key={article.id}>
                <header>
                  <strong>文章 #{index + 1}</strong>
                  <span className="small text-body-secondary">
                    {wordCount(text)} 字{article.updatedAtLabel && ` · ${article.updatedAtLabel} 更新`}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger ms-auto"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`確定要刪除「文章 #${index + 1}」嗎？`)) return;
                      run(() => removeArticle(article.id), "文章已刪除，其餘文章已重新編號。");
                    }}
                  >
                    <i className="bi bi-trash3 me-1" />刪除
                  </button>
                </header>
                <textarea
                  className="form-control"
                  rows={6}
                  value={text}
                  aria-label={`文章 #${index + 1} 內容`}
                  onChange={(event) => setEdits((current) => ({ ...current, [article.id]: event.target.value }))}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm mt-2"
                  disabled={pending || text === article.text}
                  onClick={() => run(() => saveArticle(article.id, text), "文章已儲存。", () => setEdits((current) => {
                    const next = { ...current };
                    delete next[article.id];
                    return next;
                  }))}
                >
                  儲存文章
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
