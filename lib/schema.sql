-- Teacher-Assistant schema (PostgreSQL / Supabase)
-- Paste this into the Supabase SQL editor, or it is auto-applied to the local
-- PGlite database during development. Single-user app: RLS is intentionally off.

-- App-wide key/value settings (also stores the schema-version marker).
CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT DEFAULT ''
);

-- Example domain table — a starting point you can replace with your own.
CREATE TABLE IF NOT EXISTS notes (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title      TEXT NOT NULL,
    body       TEXT DEFAULT '',
    created_at TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
);
