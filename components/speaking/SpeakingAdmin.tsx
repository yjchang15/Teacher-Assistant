"use client";

import { useState } from "react";
import ScoresPanel from "./ScoresPanel";
import ArticlesPanel from "./ArticlesPanel";
import ClearPanel from "./ClearPanel";

export interface AdminSummary {
  student: string;
  className: string;
  readingCount: number;
  readingAvg: number | null;
  readingBest: number | null;
  conversationCount: number;
  conversationTurns: number;
  lastAtLabel: string;
}

export interface AdminRecord {
  id: string;
  createdAtLabel: string;
  type: "reading" | "conversation";
  student: string;
  className: string;
  target: string;
  heard: string;
  score: number | null;
  scenarioTitle: string;
  conversationLevel: string;
  userTurnCount: number;
  turns: { role: "user" | "model"; text: string }[];
  feedback: string;
}

export interface AdminArticle {
  id: string;
  text: string;
  updatedAtLabel: string;
}

const TABS = [
  { id: "scores", label: "成績檢視" },
  { id: "articles", label: "朗讀文章" },
  { id: "clear", label: "資料清空" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// 進來一律停在成績檢視：那是老師最常看的，另外兩個分頁是偶爾才用的維護動作，
// 不記上次停在哪，免得一開啟就對著「資料清空」。
export default function SpeakingAdmin({
  records,
  summaries,
  articles,
  classNames,
  defaultClass,
  hasUnassigned,
}: {
  records: AdminRecord[];
  summaries: AdminSummary[];
  articles: AdminArticle[];
  classNames: string[];
  defaultClass: string;
  hasUnassigned: boolean;
}) {
  const [tab, setTab] = useState<TabId>("scores");

  return (
    <>
      <div className="speaking-tabs" role="tablist" aria-label="口說後台功能">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "is-active" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "scores" && (
        <ScoresPanel
          records={records}
          summaries={summaries}
          classNames={classNames}
          defaultClass={defaultClass}
          hasUnassigned={hasUnassigned}
        />
      )}
      {tab === "articles" && <ArticlesPanel articles={articles} />}
      {tab === "clear" && <ClearPanel />}
    </>
  );
}
