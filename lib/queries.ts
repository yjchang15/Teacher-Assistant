import "server-only";
import { query, execute, scalar } from "./db";

// Coerce DB numerics (some drivers return DOUBLE PRECISION / bigint as strings).
function num<T>(row: T, keys: (keyof T)[]): T {
  const r = row as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k as string];
    if (v != null) r[k as string] = Number(v);
  }
  return row;
}

// ── App settings (key/value) ──────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const v = await scalar<string | null>("SELECT value FROM app_settings WHERE key=$1", [key]);
  return v ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await execute(
    "INSERT INTO app_settings (key,value) VALUES ($1,$2)" +
      " ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [key, value],
  );
}

// ── Notes (example domain table) ──────────────────────────────────────────────

export interface Note {
  id: number;
  title: string;
  body: string;
  created_at: string;
  sort_order: number;
}

export async function getNotes(): Promise<Note[]> {
  const rows = await query<Note>("SELECT * FROM notes ORDER BY sort_order ASC, id ASC");
  return rows.map((r) => num(r, ["id", "sort_order"]));
}

export async function addNote(n: { title: string; body?: string }): Promise<void> {
  const maxOrder = await scalar<number>("SELECT COALESCE(MAX(sort_order),0) FROM notes");
  await execute(
    "INSERT INTO notes (title,body,created_at,sort_order) VALUES ($1,$2,$3,$4)",
    [n.title, n.body ?? "", new Date().toISOString(), Number(maxOrder) + 1],
  );
}

export async function deleteNote(id: number): Promise<void> {
  await execute("DELETE FROM notes WHERE id=$1", [id]);
}
