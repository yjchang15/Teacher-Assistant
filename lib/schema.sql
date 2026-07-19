-- Teacher-Assistant schema (PostgreSQL / Supabase)
-- Paste this into the Supabase SQL editor, or it is auto-applied to the local
-- PGlite database during development. Single-user (single-class) app: RLS off.
-- NOTE: runInit splits this file on the statement separator, so never write that
-- separator character inside a comment (it would cut the comment mid-line).

-- App-wide key/value settings (also stores the schema-version marker).
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
);

-- 科別清單（欄位＝矩陣的欄，可日後增減）
CREATE TABLE IF NOT EXISTS subjects (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0
);

-- 作業未交紀錄。status: 'open' 未交 / 'late' 已補交（已補交保留紀錄但不計入未交數）。
CREATE TABLE IF NOT EXISTS records (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    date        TEXT NOT NULL,               -- YYYY-MM-DD
    subject     TEXT NOT NULL,               -- 科別名稱
    seat        INTEGER NOT NULL,            -- 座號 1..32
    status      TEXT NOT NULL DEFAULT 'open',
    created_at  TEXT DEFAULT '',
    resolved_at TEXT DEFAULT ''
);

-- 同一「日期＋科別＋座號」不重複登記。
CREATE UNIQUE INDEX IF NOT EXISTS records_day_subject_seat ON records (date, subject, seat);

-- 常用查詢：依日期區間 + 狀態彙整。
CREATE INDEX IF NOT EXISTS records_date_status ON records (date, status);

CREATE TABLE IF NOT EXISTS classes (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    seat_count INTEGER NOT NULL DEFAULT 32,
    created_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS assignments (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id    bigint NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    date        TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at  TEXT DEFAULT '',
    UNIQUE (class_id, date, title)
);

CREATE TABLE IF NOT EXISTS assignment_records (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assignment_id bigint NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    seat          INTEGER NOT NULL,
    created_at    TEXT DEFAULT '',
    UNIQUE (assignment_id, seat)
);

CREATE INDEX IF NOT EXISTS assignments_class_date ON assignments (class_id, date);

CREATE TABLE IF NOT EXISTS accounts (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                 TEXT NOT NULL UNIQUE,
    display_name         TEXT NOT NULL,
    role                 TEXT NOT NULL DEFAULT 'class',
    class_id             bigint UNIQUE REFERENCES classes(id) ON DELETE SET NULL,
    password_hash        TEXT NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    active               BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at        TEXT DEFAULT '',
    created_at           TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS students (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id       bigint NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    seat           INTEGER NOT NULL,
    name           TEXT DEFAULT '',
    active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TEXT DEFAULT '',
    UNIQUE(class_id, seat)
);

CREATE INDEX IF NOT EXISTS students_class_active ON students(class_id, active);
