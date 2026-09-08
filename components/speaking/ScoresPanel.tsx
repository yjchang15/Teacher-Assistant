"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecord, deleteStudentRecords } from "@/app/admin/speaking/actions";
import type { AdminRecord, AdminSummary } from "./SpeakingAdmin";

const ALL = "all";
const UNASSIGNED = "";

const scoreTone = (score: number) => (score >= 85 ? "is-good" : score >= 60 ? "is-mid" : "is-low");
const levelNames: Record<string, string> = { "1200": "基礎", "2000": "標準", "3500": "進階" };

export default function ScoresPanel({
  records,
  summaries,
  classNames,
  defaultClass,
  hasUnassigned,
}: {
  records: AdminRecord[];
  summaries: AdminSummary[];
  classNames: string[];
  defaultClass: string;
  hasUnassigned: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [className, setClassName] = useState(defaultClass);
  const [student, setStudent] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [message, setMessage] = useState("");

  const inClass = (name: string) => className === ALL || name === className;
  const visibleSummaries = summaries.filter((summary) => inClass(summary.className));
  // 班級一換，原本選的學生多半不在新班級裡，篩選就退回全部
  const studentInView = visibleSummaries.some((summary) => summary.student === student);
  const activeStudent = studentInView ? student : ALL;
  const visibleRecords = records.filter(
    (record) =>
      inClass(record.className) &&
      (activeStudent === ALL || record.student === activeStudent) &&
      (type === ALL || record.type === type),
  );

  const practiced = visibleSummaries.filter((summary) => summary.lastAtLabel);
  const scored = visibleSummaries.filter((summary) => summary.readingAvg !== null);
  const average = scored.length
    ? Math.round(scored.reduce((sum, summary) => sum + (summary.readingAvg ?? 0), 0) / scored.length)
    : null;

  const exportQuery = className === ALL ? "" : `?class=${encodeURIComponent(className)}`;
  const exportName = (prefix: string) => (className === ALL ? `${prefix}.csv` : `${prefix}-${className || "未分班"}.csv`);

  function run(confirmText: string, action: () => Promise<{ cleared: number; backup: string | null }>, describe: (cleared: number, backup: string | null) => string) {
    if (!window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await action();
      setMessage(describe(result.cleared, result.backup));
      router.refresh();
    });
  }

  const who = (record: { className: string; student: string }) =>
    record.className ? `${record.className} ${record.student} 號` : `${record.student} 號`;

  return (
    <>
      <section className="workflow-card p-3 mb-3">
        <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
          <div>
            <label className="form-label" htmlFor="speaking-class">班級</label>
            <select id="speaking-class" className="form-select" value={className} onChange={(event) => setClassName(event.target.value)}>
              <option value={ALL}>全部班級</option>
              {classNames.map((name) => <option key={name} value={name}>{name}</option>)}
              {hasUnassigned && <option value={UNASSIGNED}>未分班（自己輸入名字的）</option>}
            </select>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={() => router.refresh()}>
              <i className="bi bi-arrow-clockwise me-1" />重新整理
            </button>
            <a className="btn btn-outline-secondary" href={`/api/teacher/export/summary.csv${exportQuery}`} download={exportName("practice-summary")}>
              <i className="bi bi-download me-1" />匯出成績 CSV
            </a>
            <a className="btn btn-primary" href={`/api/teacher/export/records.csv${exportQuery}`} download={exportName("practice-records")}>
              <i className="bi bi-download me-1" />匯出明細 CSV
            </a>
          </div>
        </div>

        {visibleSummaries.length > 0 && (
          <div className="speaking-stats">
            <div><strong>{practiced.length} / {visibleSummaries.length} 人</strong><span>已練習</span></div>
            <div><strong className={average === null ? undefined : `speaking-score ${scoreTone(average)}`}>{average ?? "—"}</strong><span>朗讀平均分</span></div>
            <div><strong>{visibleSummaries.length - practiced.length} 人</strong><span>尚未練習</span></div>
          </div>
        )}

        {message && <p className="small text-body-secondary mt-3 mb-0">{message}</p>}

        <div className="table-responsive mt-3">
          <table className="table table-hover align-middle mb-0 speaking-table">
            <thead>
              <tr>
                {className === ALL && <th>班級</th>}
                <th>座號</th><th>朗讀次數</th><th>平均分</th><th>最高分</th>
                <th>對話次數</th><th>對話總輪數</th><th>最後練習時間</th><th />
              </tr>
            </thead>
            <tbody>
              {visibleSummaries.length ? visibleSummaries.map((summary) => (
                <tr key={`${summary.className}|${summary.student}`} className={summary.lastAtLabel ? undefined : "text-body-secondary"}>
                  {className === ALL && <td>{summary.className || "未分班"}</td>}
                  <td className="fw-bold">{summary.student}</td>
                  <td>{summary.readingCount}</td>
                  <td className={summary.readingAvg === null ? undefined : `speaking-score ${scoreTone(summary.readingAvg)}`}>{summary.readingAvg ?? "—"}</td>
                  <td>{summary.readingBest ?? "—"}</td>
                  <td>{summary.conversationCount}</td>
                  <td>{summary.conversationTurns}</td>
                  <td>{summary.lastAtLabel || "尚未練習"}</td>
                  <td className="text-end">
                    {summary.lastAtLabel && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        disabled={pending}
                        onClick={() => run(
                          `確定要刪除 ${who(summary)}的所有練習紀錄嗎？\n（朗讀與對話都會刪掉，座號會留在名冊上；系統會先留下備份）`,
                          () => deleteStudentRecords(summary.className, summary.student),
                          (cleared, backup) => cleared
                            ? `已刪除 ${who(summary)}的 ${cleared} 筆紀錄，備份 ID：${backup}`
                            : `${who(summary)}目前沒有可刪除的紀錄。`,
                        )}
                      >
                        <i className="bi bi-trash3 me-1" />刪除紀錄
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={className === ALL ? 9 : 8} className="py-5 text-center text-body-secondary">這個班級還沒有人練習。學生完成一次朗讀或結束一次對話後就會出現在這裡。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workflow-card p-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <h2 className="h6 fw-bold mb-0">練習明細</h2>
          <div className="d-flex flex-wrap gap-2">
            <select className="form-select form-select-sm w-auto" value={activeStudent} onChange={(event) => setStudent(event.target.value)} aria-label="學生">
              <option value={ALL}>全部學生</option>
              {visibleSummaries.map((summary) => <option key={`${summary.className}|${summary.student}`} value={summary.student}>{summary.student}</option>)}
            </select>
            <select className="form-select form-select-sm w-auto" value={type} onChange={(event) => setType(event.target.value)} aria-label="練習類型">
              <option value={ALL}>全部類型</option>
              <option value="reading">只看朗讀</option>
              <option value="conversation">只看對話</option>
            </select>
          </div>
        </div>

        {visibleRecords.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-journal-text" />
            <strong>{records.length === 0 ? "還沒有任何練習紀錄" : "這個條件下沒有紀錄"}</strong>
            <span>{records.length === 0 ? "學生完成一次朗讀或結束一次對話後就會出現在這裡。" : "換個班級或學生看看。"}</span>
          </div>
        ) : (
          <>
            <p className="small text-body-secondary">共 {visibleRecords.length} 筆（新的在前）</p>
            <div className="speaking-record-list">
              {visibleRecords.map((record) => (
                <article className="speaking-record" key={record.id}>
                  <header>
                    <span className="fw-bold">{record.className ? `${record.className} · ${record.student}` : record.student}</span>
                    <span className="speaking-tag">
                      {record.type === "reading" ? "朗讀" : `對話${record.scenarioTitle ? ` · ${record.scenarioTitle}` : ""}`}
                    </span>
                    <span className="small text-body-secondary">{record.createdAtLabel}</span>
                    {record.type === "reading" && record.score !== null && (
                      <span className={`speaking-score ${scoreTone(record.score)}`}>{record.score}</span>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger ms-auto"
                      disabled={pending}
                      title="刪除這一筆練習紀錄"
                      onClick={() => run(
                        `確定要刪除 ${who(record)}在 ${record.createdAtLabel} 的這筆紀錄嗎？\n（${record.type === "reading" ? `朗讀 ${record.score} 分` : `對話 ${record.userTurnCount} 輪`}；系統會先留下備份）`,
                        () => deleteRecord(record.id),
                        (cleared, backup) => `已刪除 ${cleared} 筆紀錄，備份 ID：${backup}`,
                      )}
                    >
                      刪除
                    </button>
                  </header>

                  {record.type === "reading" ? (
                    <>
                      <p className="speaking-target">{record.target}</p>
                      <p className="small text-body-secondary mb-0">聽到：{record.heard || "（沒有聽到內容）"}</p>
                    </>
                  ) : (
                    <>
                      <p className="small text-body-secondary mb-2">
                        學生說了 {record.userTurnCount} 輪
                        {record.conversationLevel && ` · ${levelNames[record.conversationLevel] ?? ""}（${record.conversationLevel} 單字）`}
                      </p>
                      <details>
                        <summary className="small">看逐字稿與 AI 回饋</summary>
                        <div className="speaking-chat-log">
                          {record.turns.map((turn, index) => (
                            <p className={`speaking-bubble ${turn.role === "model" ? "is-ai" : "is-user"}`} key={index}>{turn.text}</p>
                          ))}
                        </div>
                        {record.feedback && <p className="speaking-feedback">{record.feedback}</p>}
                      </details>
                    </>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
