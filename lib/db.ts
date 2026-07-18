import "server-only";
import fs from "node:fs";
import path from "node:path";

// ── Backend selection ─────────────────────────────────────────────────────────
// DATABASE_URL set  → PostgreSQL (Supabase) via the `postgres` driver.
// Otherwise         → local in-process PGlite (WASM Postgres) for dev / tests.
//
// Every query uses native `$1, $2, …` placeholders, which both backends accept.

export type Row = Record<string, unknown>;

interface Backend {
  query: (text: string, params?: unknown[]) => Promise<Row[]>;
  tx: (statements: [string, unknown[]][]) => Promise<void>;
  end?: () => Promise<void>;
}

const DATABASE_URL = process.env.DATABASE_URL || "";

// Cache the backend + init promise across hot reloads in dev.
const g = globalThis as unknown as {
  __taBackend?: Promise<Backend>;
  __taInit?: Promise<void>;
};

async function makePostgres(): Promise<Backend> {
  const { default: postgres } = await import("postgres");
  // Small connection cap: Supabase's transaction pooler grants a cold instance
  // only a few connections; a burst-heavy page opening more hangs on connect.
  // Multiplexing every query over a few warm, reused connections is what the
  // pooler expects. Staleness (the pooler dropping an idle conn) is handled by
  // the reconnect-and-retry in withBackend() below.
  const sql = postgres(DATABASE_URL, {
    prepare: false,       // required for Supabase's transaction pooler
    max: 2,
    connect_timeout: 15,
  });
  return {
    query: (text, params = []) =>
      sql.unsafe(text, params as never[]) as unknown as Promise<Row[]>,
    tx: async (statements) => {
      await sql.begin(async (s) => {
        for (const [text, params] of statements) {
          await s.unsafe(text, params as never[]);
        }
      });
    },
    end: () => sql.end({ timeout: 5 }),
  };
}

async function makePglite(): Promise<Backend> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.join(process.cwd(), ".pglite");
  const pg = new PGlite(dir);
  return {
    query: async (text, params = []) =>
      (await pg.query<Row>(text, params as unknown[])).rows,
    tx: async (statements) => {
      await pg.transaction(async (t) => {
        for (const [text, params] of statements) {
          await t.query(text, params as unknown[]);
        }
      });
    },
  };
}

function getBackend(): Promise<Backend> {
  if (!g.__taBackend) {
    g.__taBackend = DATABASE_URL ? makePostgres() : makePglite();
  }
  return g.__taBackend;
}

// A serverless instance caches the postgres client across invocations, but the
// Supabase pooler drops idle connections — so a reused client fails with
// "Connection closed" (or a reset). Detect that and rebuild the client.
function isConnectionError(e: unknown): boolean {
  const m = (e as { message?: string })?.message ?? "";
  return /connection.*clos|CONNECTION_CLOSED|CONNECTION_ENDED|ECONNRESET|ETIMEDOUT|socket|connection.*(reset|terminat|end)|write after end/i.test(m);
}

// Replace the cached client, but only once even when many concurrent queries
// fail together. Loser threads see g.__taBackend already swapped and reuse the
// fresh client. The stale client is closed in the background.
function resetBackend(failed: Promise<Backend>): void {
  if (g.__taBackend !== failed) return; // someone already reconnected
  g.__taBackend = undefined;
  failed.then((be) => be.end?.()).catch(() => {});
}

// App-level concurrency gate. `postgres` pipelines queued queries down a shared
// connection; Supabase's transaction pooler mishandles that and the pipeline
// hangs. Gating so at most MAX_INFLIGHT queries run at once — one per
// connection, plain request/response, no pipelining — is what it expects.
// Keep this ≤ the client's `max`.
const MAX_INFLIGHT = 2;
let inflight = 0;
const waiters: (() => void)[] = [];

function acquireSlot(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (inflight < MAX_INFLIGHT) {
      inflight++;
      resolve();
    } else {
      waiters.push(() => {
        inflight++;
        resolve();
      });
    }
  });
}

function releaseSlot(): void {
  inflight--;
  waiters.shift()?.();
}

// Run a backend operation, retrying on a dead connection with a fresh client
// (up to 2 reconnects). initDb() runs inside the loop so a stale connection hit
// by its fast-path check also reconnects; it only re-runs its work if it hasn't
// already succeeded. The query is gated (initDb is awaited first, ungated).
async function withBackend<T>(fn: (be: Backend) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const be = getBackend();
    try {
      await initDb();
      const backend = await be;
      await acquireSlot();
      try {
        return await fn(backend);
      } finally {
        releaseSlot();
      }
    } catch (e) {
      if (!isConnectionError(e)) throw e;
      lastErr = e;
      resetBackend(be);
    }
  }
  throw lastErr;
}

// ── Core helpers ──────────────────────────────────────────────────────────────

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await withBackend((be) => be.query(text, params))) as T[];
}

export async function execute(text: string, params: unknown[] = []): Promise<void> {
  await withBackend((be) => be.query(text, params));
}

export async function scalar<T = unknown>(text: string, params: unknown[] = []): Promise<T> {
  const rows = await withBackend((be) => be.query(text, params));
  const first = rows[0] ?? {};
  return Object.values(first)[0] as T;
}

export async function tx(statements: [string, unknown[]][]): Promise<void> {
  await withBackend((be) => be.tx(statements));
}

// ── Schema init (idempotent) ──────────────────────────────────────────────────

// Bump whenever schema.sql or the ALTER migrations below change, so existing
// databases re-run the full init once. Between bumps, a cold instance skips the
// schema round trips after a single cheap marker check.
const SCHEMA_VERSION = "2026-07-18-homework-records";

// 國中科目預設清單（可日後在 subjects 表增減）。
const DEFAULT_SUBJECTS = ["國文", "英文", "數學", "自然", "歷史", "地理", "公民"];

async function runInit(): Promise<void> {
  const be = await getBackend();

  // Fast path: if this schema version was already applied, skip the full apply.
  // The query throws on a brand-new DB (no app_settings yet) → falls through.
  try {
    const rows = await be.query(
      "SELECT value FROM app_settings WHERE key='__schema_version__'",
      [],
    );
    if (rows.length && (rows[0] as { value: string }).value === SCHEMA_VERSION) return;
  } catch {
    // app_settings doesn't exist yet — run the full init below.
  }

  const schema = fs.readFileSync(path.join(process.cwd(), "lib", "schema.sql"), "utf8");
  for (const stmt of schema.split(";")) {
    if (stmt.trim()) await be.query(stmt, []);
  }
  // Idempotent column migrations go here as the schema grows, e.g.:
  //   await be.query("ALTER TABLE records ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''", []);

  // Seed the default 科別 once (only when the table is empty, so edits stick).
  const subjectCount = await be.query("SELECT COUNT(*) AS n FROM subjects", []);
  if (Number((subjectCount[0] as { n: number }).n) === 0) {
    await be.tx(
      DEFAULT_SUBJECTS.map((name, i) => [
        "INSERT INTO subjects (name, sort_order) VALUES ($1,$2)",
        [name, i],
      ]),
    );
  }

  // Mark this schema version as applied so later cold instances take the fast
  // path above instead of re-running the whole init.
  await be.query(
    "INSERT INTO app_settings (key,value) VALUES ('__schema_version__',$1)" +
      " ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [SCHEMA_VERSION],
  );
}

export function initDb(): Promise<void> {
  // Don't cache a rejected promise — otherwise one failed init (e.g. a transient
  // connection drop) would poison every subsequent query on this instance.
  if (!g.__taInit) {
    g.__taInit = runInit().catch((e) => {
      g.__taInit = undefined;
      throw e;
    });
  }
  return g.__taInit;
}
