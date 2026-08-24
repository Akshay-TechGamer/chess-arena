# Chess Arena

Play chess in the browser — against a friend or the computer. Online
multiplayer (invite links, quick match) is the next phase.

**Stack**: Next.js 15 + TypeScript · chess.js · react-chessboard ·
Stockfish 18 (WASM, in-browser) · Supabase (Postgres + Auth + Realtime) ·
Vercel.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The dev script copies the Stockfish engine into
`public/engine/` automatically.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs all four on every push and PR (`.github/workflows/ci.yml`).

## Project docs

- [AGENTS.md](AGENTS.md) — architecture, layering rules, conventions
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — environments, Vercel + Supabase setup
- [docs/MIGRATIONS.md](docs/MIGRATIONS.md) — DB migration workflow + platform exit plan
- [supabase/migrations/](supabase/migrations/) — database schema (SQL, versioned)
