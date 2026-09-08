"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearEverything } from "@/app/admin/speaking/actions";

export default function ClearPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <section className="workflow-card p-3">
      <ul className="small text-body-secondary">
        <li>此功能會同時刪除所有朗讀文章、練習次數與成績。</li>
        <li>若只想刪一位學生或一筆紀錄，請到「成績檢視」頁面刪除。</li>
      </ul>
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("確定要清空嗎？\n所有朗讀文章、練習次數與成績都會刪除（系統會先留下完整備份）。")) return;
          startTransition(async () => {
            const result = await clearEverything();
            const cleared = [
              result.cleared ? `${result.cleared} 筆練習紀錄` : "",
              result.clearedArticles ? `${result.clearedArticles} 篇朗讀文章` : "",
            ].filter(Boolean);
            setMessage(cleared.length
              ? `已清空 ${cleared.join("、")}，備份 ID：${result.backups.join("、")}`
              : "目前沒有資料可以清空。");
            router.refresh();
          });
        }}
      >
        清空所有朗讀文章與成績
      </button>
      {message && <p className="small text-body-secondary mt-3 mb-0">{message}</p>}
    </section>
  );
}
