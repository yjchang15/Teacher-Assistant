-- Teacher-Assistant schema (PostgreSQL / Supabase)
-- Paste this into the Supabase SQL editor, or it is auto-applied to the local
-- PGlite database during development. Single-user app: RLS off.
-- NOTE: runInit splits this file on the statement separator, so never write that
-- separator character inside a comment (it would cut the comment mid-line).

-- App-wide key/value settings (also stores the schema-version marker).
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
);

-- 唯一使用者。第一次啟動時以 APP_USERNAME / APP_PASSWORD 建立，之後可站內改密碼。
CREATE TABLE IF NOT EXISTS accounts (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,
    display_name  TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    last_login_at TEXT DEFAULT '',
    created_at    TEXT DEFAULT ''
);

-- 班級。name 由使用者自訂（例如 701），座號就是 seat_start 到 seat_end 的範圍。
CREATE TABLE IF NOT EXISTS classes (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    seat_start INTEGER NOT NULL DEFAULT 1,
    seat_end   INTEGER NOT NULL DEFAULT 32,
    created_at TEXT DEFAULT ''
);

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
