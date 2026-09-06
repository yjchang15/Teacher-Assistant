# Teacher Assistant

同一位老師使用的整合式教學系統，包含兩大服務：

1. 成績管理：作業缺交登記、個人與全班報表、Excel 匯出。
2. 英文口說輔助教學：學生朗讀評分、AI 英語對話、口說成績與文章管理。

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router / RSC / Server Actions) + React 19 |
| Language | TypeScript 5 (strict, `@/*` path alias) |
| Styling | Tailwind CSS v4 + Bootstrap 5 (CDN) + Bootstrap Icons |
| Data | Dual backend — `postgres` (Supabase) in prod, `@electric-sql/pglite` (WASM Postgres) for local dev; see `lib/db.ts` |
| Access | Single-teacher signed-cookie login; public student speaking page |
| Tests | `node --test` + `tsx` |
| Deploy | Vercel |

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

With no `DATABASE_URL`, the app uses a local PGlite file DB under `./.pglite`
(auto-created, schema auto-applied). Set `DATABASE_URL` to a Supabase pooler URL
to use Postgres. Copy `.env.example` → `.env.local` to configure. In local
development only, teacher login is skipped when its two variables are absent.

## Access

The teacher pages require a `TEACHER_PIN` of at least 4 characters and a
`SESSION_SECRET` of at least 32 characters in production. The PIN is exchanged
for a signed, HttpOnly, Secure cookie and is
never stored in browser JavaScript. The student speaking page is public at
`/speaking`; it can read class/seat choices and submit completed practice, but
cannot read teacher reports or modify classes.

## Supabase + Vercel deployment

1. In the existing `teacher-assistant` Supabase project, run
   `supabase/migrations/20260906000000_speaking_service.sql` in SQL Editor.
2. Copy the Supabase **Transaction pooler** connection string (port 6543) and
   save it in Vercel as `DATABASE_URL`.
3. Add `TEACHER_PIN`, `SESSION_SECRET`, `GEMINI_API_KEY`, and optionally
   `GEMINI_MODEL` to Vercel for Production, Preview, and Development.
4. Import the `Teacher-Assistant` GitHub repository into Vercel and deploy.

The migration enables RLS and removes Data API access for `anon` and
`authenticated`; all database access stays on the Next.js server through
`DATABASE_URL`.

## Scripts

- `npm run dev` / `build` / `start`
- `npm run lint` — ESLint
- `npm test` — unit tests for pure modules in `lib/**/*.test.ts`

## Layout

```
app/            routes (page.tsx, layout.tsx, actions.ts)
components/     shared UI (Nav)
lib/            db.ts (dual backend), queries.ts, schema.sql, pure helpers + tests
public/speaking student and teacher speaking UI
supabase/       production migration and security hardening
```

Extend the schema in `lib/schema.sql`, add queries in `lib/queries.ts`, and bump
`SCHEMA_VERSION` in `lib/db.ts` when the schema changes — `runInit()` re-runs the
idempotent migrations once per bump.

## Domain model

- **班級** (`classes`) — created in 班級維護 with a name and a 人數.
- **座號** (`class_seats`) — one row per seat. 人數 N expands into seats 1..N on
  creation; after that `+` appends the next number and `×` removes one. No
  student names are kept anywhere.
- **作業項目** (`assignments`) — every item is created by the teacher via 新增項目.
  Nothing is seeded, so all items can be renamed and deleted.
- **缺交紀錄** (`assignment_records`) — one row per 作業項目 × 座號.
- **口說文章** (`speaking_articles`) — teacher-maintained reading material.
- **口說練習紀錄** (`speaking_practice_records`) — references the shared class
  and seat while preserving a class-name snapshot for historical reports.
- **口說備份** (`speaking_practice_record_backups`) — full snapshot created
  transactionally before the teacher clears speaking records.
