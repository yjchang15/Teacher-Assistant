-- Teacher-Assistant schema (PostgreSQL / Supabase)
-- Paste this into the Supabase SQL editor, or it is auto-applied to the local
-- PGlite database during development. Production access goes through the
-- server-side DATABASE_URL. Supabase Data API roles are locked down by the
-- migration in supabase/migrations.
-- NOTE: runInit splits this file on the statement separator, so never write that
-- separator character inside a comment (it would cut the comment mid-line).

-- App-wide key/value settings (also stores the schema-version marker).
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
);

-- 舊版登入資料表，僅為相容既有資料庫而保留；應用不再讀寫此表。
CREATE TABLE IF NOT EXISTS accounts (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    last_login_at TEXT DEFAULT '',
    created_at    TEXT DEFAULT ''
);

-- 班級。name 由使用者自訂（例如 701）。
CREATE TABLE IF NOT EXISTS classes (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT ''
);

-- 班級座號。新增班級時依「人數」自動展開成 1..N，之後可逐一增刪。
CREATE TABLE IF NOT EXISTS class_seats (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id   bigint NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    seat       INTEGER NOT NULL,
    created_at TEXT DEFAULT '',
    UNIQUE (class_id, seat)
);

CREATE INDEX IF NOT EXISTS class_seats_class ON class_seats (class_id, seat);

-- 作業項目。全部由使用者自行新增，沒有預設科別。
CREATE TABLE IF NOT EXISTS assignments (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id    bigint NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    date        TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at  TEXT DEFAULT '',
    UNIQUE (class_id, date, title)
);

CREATE INDEX IF NOT EXISTS assignments_class_date ON assignments (class_id, date);

-- 缺交紀錄：某個作業項目底下的某個座號。
CREATE TABLE IF NOT EXISTS assignment_records (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assignment_id bigint NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    seat          INTEGER NOT NULL,
    created_at    TEXT DEFAULT '',
    UNIQUE (assignment_id, seat)
);

-- English speaking practice reading material. The UI numbers articles by
-- creation order, so titles do not need to be stored separately.
CREATE TABLE IF NOT EXISTS speaking_articles (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
);

-- One completed reading or conversation practice. class_name is a snapshot so
-- reports remain understandable even if the class is renamed or removed.
CREATE TABLE IF NOT EXISTS speaking_practice_records (
    id          TEXT PRIMARY KEY,
    class_id    bigint REFERENCES classes(id) ON DELETE SET NULL,
    class_name  TEXT NOT NULL,
    seat         INTEGER NOT NULL,
    record_data JSONB NOT NULL,
    created_at  TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS speaking_records_class_created
    ON speaking_practice_records (class_id, created_at DESC);

-- Clearing records writes a full JSON snapshot here first in the same
-- transaction. This gives the teacher a recoverable audit trail.
CREATE TABLE IF NOT EXISTS speaking_practice_record_backups (
    id         TEXT PRIMARY KEY,
    records    JSONB NOT NULL,
    created_at TEXT NOT NULL DEFAULT ''
);
