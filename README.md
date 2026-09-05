# Teacher Assistant

A Next.js app scaffolded on the same tech stack as `etf-tracker`.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router / RSC / Server Actions) + React 19 |
| Language | TypeScript 5 (strict, `@/*` path alias) |
| Styling | Tailwind CSS v4 + Bootstrap 5 (CDN) + Bootstrap Icons |
| Data | Dual backend — `postgres` (Supabase) in prod, `@electric-sql/pglite` (WASM Postgres) for local dev; see `lib/db.ts` |
| Auth | Single-password cookie session (`lib/auth.ts` + `proxy.ts`) |
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

## Auth

The app has a **single user**. `APP_USERNAME` / `APP_PASSWORD` seed that account
on first start; after that the password is changed in-app and lives in the
database. Every route except `/login` is gated by `proxy.ts` (Next 16's
middleware equivalent).

## Scripts

- `npm run dev` / `build` / `start`
- `npm run lint` — ESLint
- `npm test` — unit tests for pure modules in `lib/**/*.test.ts`

## Layout

```
app/            routes (page.tsx, layout.tsx, login/, actions.ts)
components/     shared UI (Nav)
lib/            db.ts (dual backend), queries.ts, auth.ts, schema.sql, pure helpers + tests
proxy.ts        auth gate (Next 16 middleware)
```

Extend the schema in `lib/schema.sql`, add queries in `lib/queries.ts`, and bump
`SCHEMA_VERSION` in `lib/db.ts` when the schema changes — `runInit()` re-runs the
idempotent migrations once per bump.

## Domain model

- **班級** (`classes`) — created in 班級管理. 座號 is just a range:
  `seat_start`..`seat_end`, and the registration grid shows exactly that range.
  There is no per-student roster and no names.
- **作業項目** (`assignments`) — every item is created by the teacher via 新增項目.
  Nothing is seeded, so all items can be renamed and deleted.
- **缺交紀錄** (`assignment_records`) — one row per 作業項目 × 座號.
