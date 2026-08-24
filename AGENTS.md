# AGENTS.md — Chess Arena

Guide for AI agents (and humans) working in this repo. Follow these rules exactly.

## What is this project?

Online multiplayer chess game, built from scratch.
- Play vs a friend online (invite link / quick match)
- Play vs computer (Stockfish, difficulty levels)
- Future: Elo rating, puzzles, game analysis, PWA

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 15 + TypeScript (App Router) | Deployed on Vercel |
| DB / Auth / Realtime | Supabase (Postgres) | One project for dev, one for prod |
| Chess rules | `chess.js` | NEVER write chess rules by hand |
| Board UI | `react-chessboard` | |
| Engine (vs computer) | Stockfish WASM | Runs in browser, no server cost |
| Validation | `zod` | Shared schemas, client + server |
| Tests | `vitest` | Required for everything in `lib/game/` |

## Layering rules (the most important section)

```
app/            Next.js routes/pages. Thin. No business logic.
components/     UI only. MUST NOT import Supabase or touch the DB.
lib/game/       Pure chess/domain logic (clock math, Elo, UCI parsing).
                MUST NOT import Supabase, React, or Next.js. 100% unit-tested.
lib/engine/     Stockfish Web Worker wrapper (browser-only plumbing).
                All parsing/command-building stays in lib/game/uci.ts.
lib/data/       ALL database access lives here (one repo file per table).
                The ONLY layer allowed to import the Supabase client.
lib/realtime/   Thin interface over Supabase Realtime:
                subscribe(gameId, handlers) / publish(event).
supabase/       migrations/ (SQL) + edge functions.
docs/           DEPLOYMENT.md, MIGRATIONS.md.
```

Why: so we can swap Supabase (DB or Realtime) later by rewriting ONE folder.
If you find a DB call outside `lib/data/`, that is a bug — move it.

## Database rules

- **Every SQL statement lives in a script file in the repo.** Never run ad-hoc
  SQL in the Supabase dashboard. Never inline raw SQL strings in TypeScript.
  - Schema changes → new file in `supabase/migrations/` (see docs/MIGRATIONS.md)
  - Data access from the app → through `lib/data/` repos (Supabase query builder)
  - One-off analysis/debug queries → save under `docs/db-scripts/` with a date prefix
- Migrations are append-only. NEVER edit an already-applied migration file —
  write a new one.
- Every table gets Row Level Security (RLS) enabled in the same migration that
  creates it. No exceptions.
- After any schema change, regenerate types:
  `supabase gen types typescript --local > lib/data/database.types.ts`
  and fix every resulting TypeScript error before committing.

## Conventions

- TypeScript strict mode. No `any` unless commented with a reason.
- Tabs, single quotes, semicolons.
- Chess positions are passed around as FEN strings; full games as PGN.
- `lib/game/` changes require vitest tests in the same commit.
- Feature work happens on branches; `main` auto-deploys to prod (see docs/DEPLOYMENT.md).
- Never commit secrets. Env vars only; `.env.local` is git-ignored,
  `.env.example` documents every required var.

## Things agents must NOT do

- Do not hand-implement move legality, check, checkmate, castling, or
  en passant — that is `chess.js`'s job.
- Do not add a socket server / socket.io — Realtime goes through
  `lib/realtime/` (currently Supabase Realtime).
- Do not create tables from the dashboard — migrations only.
- Do not commit without `npm run lint && npm run typecheck && npm test` passing.
