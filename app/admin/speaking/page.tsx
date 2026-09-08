import { getClasses } from "@/lib/queries";
import { getSpeakingArticles, getSpeakingRecords, getSpeakingSummaries } from "@/lib/speaking";
import SpeakingAdmin, { type AdminArticle, type AdminRecord, type AdminSummary } from "@/components/speaking/SpeakingAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "英文口說後台" };

// 伺服器先把時間格式化好，客戶端就不會因為時區不同而 hydration 不一致。
const timeFormat = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei", month: "numeric", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});
function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso || "" : timeFormat.format(date);
}

export default async function SpeakingAdminPage() {
  const [records, articles, classes] = await Promise.all([
    getSpeakingRecords(),
    getSpeakingArticles(),
    getClasses(),
  ]);
  const summaries = await getSpeakingSummaries(records);

  // 班級選單：名冊上的班 + 只出現在紀錄裡的班（班級改名或刪掉後留下來的）
  const classNames = classes.map((classroom) => classroom.name);
  for (const summary of summaries) {
    if (summary.className && !classNames.includes(summary.className)) classNames.push(summary.className);
  }

  const adminRecords: AdminRecord[] = records.map((record) => ({
    id: record.id,
    createdAtLabel: formatTime(record.createdAt),
    type: record.type,
    student: record.student,
    className: record.className || "",
    target: record.target ?? "",
    heard: record.heard ?? "",
    score: record.score ?? null,
    scenarioTitle: record.scenarioTitle || record.scenarioId || "",
    conversationLevel: record.conversationLevel ?? "",
    userTurnCount: record.userTurnCount ?? 0,
    turns: record.turns ?? [],
    feedback: record.feedback ?? "",
  }));

  const adminSummaries: AdminSummary[] = summaries.map((summary) => ({
    student: summary.student,
    className: summary.className,
    readingCount: summary.readingCount,
    readingAvg: summary.readingAvg,
    readingBest: summary.readingBest,
    conversationCount: summary.conversationCount,
    conversationTurns: summary.conversationTurns,
    lastAtLabel: summary.lastAt ? formatTime(summary.lastAt) : "",
  }));

  const adminArticles: AdminArticle[] = articles.map((article) => ({
    id: article.id,
    text: article.text,
    updatedAtLabel: article.updatedAt ? formatTime(article.updatedAt) : "",
  }));

  return (
    <main className="desktop-dashboard">
      <header className="page-header">
        <div>
          <h1>英文口說後台</h1>
          <p>看學生的朗讀與對話成績、維護朗讀文章。</p>
        </div>
      </header>
      <SpeakingAdmin
        records={adminRecords}
        summaries={adminSummaries}
        articles={adminArticles}
        classNames={classNames}
        // 名冊上只有一個班就直接看那個班，省一次選擇
        defaultClass={classes.length === 1 ? classes[0].name : "all"}
        hasUnassigned={summaries.some((summary) => !summary.className)}
      />
    </main>
  );
}
