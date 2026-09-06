import "server-only";
import { execute, query, scalar } from "./db";
import { getClasses } from "./queries";

const MAX_ARTICLES = 50;
const MAX_ARTICLE_LENGTH = 3000;

export interface SpeakingArticle {
  id: string;
  text: string;
  updatedAt: string;
}

export type SpeakingTurn = { role: "user" | "model"; text: string };

export interface SpeakingRecord {
  id: string;
  createdAt: string;
  type: "reading" | "conversation";
  student: string;
  seatNo: string;
  className: string;
  target?: string;
  heard?: string;
  score?: number;
  scenarioId?: string;
  scenarioTitle?: string;
  conversationLevel?: string;
  turns?: SpeakingTurn[];
  userTurnCount?: number;
  feedback?: string;
}

export interface SpeakingSummary {
  student: string;
  className: string;
  seatNo: string;
  readingCount: number;
  readingAvg: number | null;
  readingBest: number | null;
  conversationCount: number;
  conversationTurns: number;
  lastAt: string;
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max).trim() : "";
}

function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function normalizeArticle(text: unknown): string {
  return clip(text, MAX_ARTICLE_LENGTH).replace(/\s+/g, " ").trim();
}

function articleError(text: string): string | null {
  if (!text) return "請貼上要讓學生朗讀的文章";
  if (!/[A-Za-z]/.test(text)) return "這段文字裡找不到英文內容，請確認貼上的文章。";
  return null;
}

export async function getSpeakingArticles(): Promise<SpeakingArticle[]> {
  const rows = await query<{ id: number; content: string; updated_at: string }>(
    "SELECT id,content,updated_at FROM speaking_articles ORDER BY id",
  );
  return rows.map((row) => ({ id: String(row.id), text: row.content, updatedAt: row.updated_at }));
}

export async function createSpeakingArticle(raw: unknown): Promise<{ article?: SpeakingArticle; articles?: SpeakingArticle[]; error?: string }> {
  const text = normalizeArticle(raw);
  const error = articleError(text);
  if (error) return { error };
  const count = Number(await scalar<number>("SELECT COUNT(*) FROM speaking_articles"));
  if (count >= MAX_ARTICLES) return { error: `最多只能建立 ${MAX_ARTICLES} 篇文章` };
  const now = new Date().toISOString();
  const rows = await query<{ id: number; content: string; updated_at: string }>(
    "INSERT INTO speaking_articles(content,created_at,updated_at) VALUES ($1,$2,$2) RETURNING id,content,updated_at",
    [text, now],
  );
  const row = rows[0];
  const article = { id: String(row.id), text: row.content, updatedAt: row.updated_at };
  return { article, articles: await getSpeakingArticles() };
}

export async function updateSpeakingArticle(id: number, raw: unknown): Promise<{ article?: SpeakingArticle; articles?: SpeakingArticle[]; error?: string }> {
  const text = normalizeArticle(raw);
  const error = articleError(text);
  if (error) return { error };
  const rows = await query<{ id: number; content: string; updated_at: string }>(
    "UPDATE speaking_articles SET content=$1,updated_at=$2 WHERE id=$3 RETURNING id,content,updated_at",
    [text, new Date().toISOString(), id],
  );
  if (!rows.length) return { error: "找不到這篇文章" };
  const row = rows[0];
  return {
    article: { id: String(row.id), text: row.content, updatedAt: row.updated_at },
    articles: await getSpeakingArticles(),
  };
}

export async function deleteSpeakingArticle(id: number): Promise<{ ok?: true; articles?: SpeakingArticle[]; error?: string }> {
  const rows = await query<{ id: number }>("DELETE FROM speaking_articles WHERE id=$1 RETURNING id", [id]);
  if (!rows.length) return { error: "找不到這篇文章" };
  return { ok: true, articles: await getSpeakingArticles() };
}

type NormalizedRecord = Omit<SpeakingRecord, "id" | "createdAt" | "className">;

export function normalizeSpeakingRecord(body: Record<string, unknown>): { record?: NormalizedRecord; error?: string } {
  const classId = Math.trunc(Number(body.classId));
  const seat = Math.trunc(Number(body.seatNo));
  if (!Number.isSafeInteger(classId) || classId < 1) return { error: "請重新選擇班級" };
  if (!Number.isInteger(seat) || seat < 1 || seat > 60) return { error: "請重新選擇座號" };
  const identity = { student: String(seat), seatNo: String(seat), classId };

  if (body.type === "reading") {
    const score = Number(body.score);
    if (!Number.isFinite(score)) return { error: "score 必須是數字" };
    return {
      record: {
        ...identity,
        type: "reading",
        target: clip(body.target, 3000),
        heard: clip(body.heard, 3000),
        score: Math.max(0, Math.min(100, Math.round(score))),
      } as NormalizedRecord,
    };
  }

  if (body.type === "conversation") {
    const turns = (Array.isArray(body.turns) ? body.turns : [])
      .slice(0, 60)
      .map((item) => {
        const turn = (item ?? {}) as Record<string, unknown>;
        return { role: turn.role === "model" ? "model" as const : "user" as const, text: clip(turn.text, 500) };
      })
      .filter((turn) => turn.text);
    if (!turns.length) return { error: "對話內容是空的" };
    const level = ["1200", "2000", "3500"].includes(String(body.conversationLevel))
      ? String(body.conversationLevel)
      : "2000";
    return {
      record: {
        ...identity,
        type: "conversation",
        scenarioId: "free",
        scenarioTitle: "自由對話",
        conversationLevel: level,
        turns,
        userTurnCount: turns.filter((turn) => turn.role === "user").length,
        feedback: clip(body.feedback, 2000),
      } as NormalizedRecord,
    };
  }

  return { error: "type 必須是 reading 或 conversation" };
}

export async function appendSpeakingRecord(record: NormalizedRecord): Promise<{ id: string }> {
  const row = record as NormalizedRecord & { classId: number; seatNo: string };
  const classes = await query<{ id: number; name: string }>(
    `SELECT c.id,c.name FROM classes c
     JOIN class_seats cs ON cs.class_id=c.id
     WHERE c.id=$1 AND cs.seat=$2 LIMIT 1`,
    [row.classId, Number(row.seatNo)],
  );
  if (!classes.length) throw new Error("INVALID_CLASS_SEAT");

  const id = newId("r");
  const now = new Date().toISOString();
  const { classId, ...stored } = row;
  await execute(
    `INSERT INTO speaking_practice_records(id,class_id,class_name,seat,record_data,created_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
    [id, classId, classes[0].name, Number(row.seatNo), JSON.stringify({ ...stored, className: classes[0].name }), now],
  );
  return { id };
}

export async function getSpeakingRecords(): Promise<SpeakingRecord[]> {
  const rows = await query<{ id: string; created_at: string; record_data: SpeakingRecord | string }>(
    "SELECT id,created_at,record_data FROM speaking_practice_records ORDER BY created_at DESC,id DESC",
  );
  return rows.map((row) => ({
    ...(typeof row.record_data === "string" ? JSON.parse(row.record_data) : row.record_data),
    id: row.id,
    createdAt: row.created_at,
  }));
}

export async function clearSpeakingRecords(): Promise<{ cleared: number; backup: string | null }> {
  const backupId = newId("b");
  const now = new Date().toISOString();
  const rows = await query<{ backup_id: string | null; cleared: number }>(
    `WITH source AS MATERIALIZED (
       SELECT id,created_at,record_data FROM speaking_practice_records ORDER BY created_at,id
     ), saved AS (
       INSERT INTO speaking_practice_record_backups(id,records,created_at)
       SELECT $1,jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at) || record_data),$2
       FROM source HAVING COUNT(*)>0 RETURNING id
     ), deleted AS (
       DELETE FROM speaking_practice_records
       WHERE EXISTS (SELECT 1 FROM saved) RETURNING id
     )
     SELECT (SELECT id FROM saved) AS backup_id,COUNT(*)::int AS cleared FROM deleted`,
    [backupId, now],
  );
  return { cleared: Number(rows[0]?.cleared ?? 0), backup: rows[0]?.backup_id ?? null };
}

export async function getSpeakingSummaries(records: SpeakingRecord[]): Promise<SpeakingSummary[]> {
  const classes = await getClasses();
  const byStudent = new Map<string, SpeakingSummary & { readingScores: number[] }>();
  for (const classroom of classes) {
    for (const seat of classroom.seats) {
      byStudent.set(`${classroom.name}|${seat}`, {
        student: String(seat), className: classroom.name, seatNo: String(seat), readingScores: [],
        readingCount: 0, readingAvg: null, readingBest: null,
        conversationCount: 0, conversationTurns: 0, lastAt: "",
      });
    }
  }
  for (const record of records) {
    const student = record.student || record.seatNo || "（未填）";
    const key = `${record.className || ""}|${student}`;
    const summary = byStudent.get(key) ?? {
      student, className: record.className || "", seatNo: record.seatNo || student, readingScores: [],
      readingCount: 0, readingAvg: null, readingBest: null,
      conversationCount: 0, conversationTurns: 0, lastAt: "",
    };
    if (record.type === "reading" && typeof record.score === "number") summary.readingScores.push(record.score);
    if (record.type === "conversation") {
      summary.conversationCount += 1;
      summary.conversationTurns += record.userTurnCount || 0;
    }
    if (record.createdAt > summary.lastAt) summary.lastAt = record.createdAt;
    byStudent.set(key, summary);
  }
  return [...byStudent.values()].map((summary) => ({
    student: summary.student,
    className: summary.className,
    seatNo: summary.seatNo,
    readingCount: summary.readingScores.length,
    readingAvg: summary.readingScores.length
      ? Math.round(summary.readingScores.reduce((sum, score) => sum + score, 0) / summary.readingScores.length)
      : null,
    readingBest: summary.readingScores.length ? Math.max(...summary.readingScores) : null,
    conversationCount: summary.conversationCount,
    conversationTurns: summary.conversationTurns,
    lastAt: summary.lastAt,
  })).sort((a, b) => a.className.localeCompare(b.className, "zh-Hant") || a.student.localeCompare(b.student, undefined, { numeric: true }));
}

function escapeCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

export function speakingRecordsCsv(records: SpeakingRecord[]): string {
  const headers = ["時間", "班級", "座號", "類型", "朗讀文章／對話輪數", "學生說出的內容", "分數", "AI 回饋"];
  const rows = records.map((record) => {
    if (record.type === "reading") {
      return [formatTime(record.createdAt), record.className, record.student, "朗讀", record.target, record.heard, record.score, ""];
    }
    const spoken = (record.turns || []).filter((turn) => turn.role === "user").map((turn) => turn.text).join(" / ");
    const levelNames: Record<string, string> = { "1200": "基礎", "2000": "標準", "3500": "進階" };
    const level = record.conversationLevel ? `（${levelNames[record.conversationLevel] || ""} ${record.conversationLevel} 單字）` : "";
    return [formatTime(record.createdAt), record.className, record.student, `對話${level}`, `${record.userTurnCount || 0} 輪`, spoken, "", record.feedback || ""];
  });
  return toCsv(headers, rows);
}

export function speakingSummaryCsv(summaries: SpeakingSummary[]): string {
  return toCsv(
    ["班級", "座號", "朗讀次數", "朗讀平均分", "朗讀最高分", "對話次數", "對話總輪數", "最後練習時間"],
    summaries.map((summary) => [
      summary.className, summary.student, summary.readingCount, summary.readingAvg ?? "", summary.readingBest ?? "",
      summary.conversationCount, summary.conversationTurns, formatTime(summary.lastAt),
    ]),
  );
}
