# Teacher Assistant

A Next.js app scaffolded on the same tech stack as `etf-tracker`.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router / RSC / Server Actions) + React 19 |
| Language | TypeScript 5 (strict, `@/*` path alias) |
| Styling | Tailwind CSS v4 + Bootstrap 5 (CDN) + Bootstrap Icons |
| Data | Dual backend — `postgres` (Supabase) in prod, `@electric-sql/pglite` (WASM Postgres) for local dev; see `lib/db.ts` |
| Access | Single-user, no login required |
| Tests | `node --test` + `tsx` |
| Deploy | Vercel |

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

With no `DATABASE_URL`, the app uses a local PGlite file DB under `./.pglite`
(auto-created, schema auto-applied). Set `DATABASE_URL` to a Supabase pooler URL
to use Postgres. Copy `.env.example` → `.env.local` to configure.

## Access

The app is designed for one trusted user. It opens directly without a login or
password, so deploy it only in an environment where access is already private.

## Scripts

- `npm run dev` / `build` / `start`
- `npm run lint` — ESLint
- `npm test` — unit tests for pure modules in `lib/**/*.test.ts`

## Layout

```
app/            routes (page.tsx, layout.tsx, actions.ts)
components/     shared UI (Nav)
lib/            db.ts (dual backend), queries.ts, schema.sql, pure helpers + tests
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
