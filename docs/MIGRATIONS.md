# Migrations — today's workflow and tomorrow's escape hatches

Two meanings of "migration", both covered here:
1. **Schema migrations** — changing the database as features grow (weekly thing)
2. **Platform migrations** — leaving Supabase/Vercel someday (hopefully never,
   but the architecture keeps the door open)

## 1. Schema migrations (the everyday kind)

### Rules

- Every change is a new SQL file in `supabase/migrations/`, named
  `YYYYMMDDHHMMSS_short_description.sql`. Create it with:

```bash
npx supabase migration new short_description
```

- **Append-only.** Never edit a migration that has been applied anywhere
  (including chess-dev). Fix mistakes with a new migration.
- Test locally before pushing: `supabase db reset` replays ALL migrations from
  scratch on local Docker Postgres. If reset fails, the migration is broken —
  fix it before it ever reaches a real environment.
- After every schema change, regenerate types and fix compile errors:

```bash
npx supabase gen types typescript --local > lib/data/database.types.ts
```

### Zero-downtime pattern (expand → migrate → contract)

Prod deploys are: migrations first, then app. So every migration must work with
the app version that is live at that moment. For breaking changes, split into
three small steps across separate deploys:

Example: rename `games.pgn` → `games.notation`

1. **Expand** — add `notation` column; app writes to both, reads old one.
2. **Migrate** — backfill script copies `pgn` → `notation`; app reads new one.
3. **Contract** — drop `pgn` once nothing references it.

Boring, but this is exactly what makes "migration me koi dikkat nahi" true.

### Data backfills

Data-moving scripts (not schema) also live in `supabase/migrations/` as normal
migrations, and must be **idempotent** (safe to run twice — use
`where notation is null`-style guards).

## 2. Platform migrations (the someday kind)

The layering in AGENTS.md exists for this. What leaving each vendor costs:

| If we leave... | What changes | What survives untouched |
|---|---|---|
| Supabase DB | `lib/data/` rewritten against new client | Schema is plain Postgres SQL — restores anywhere (RDS, Neon, self-host) via `pg_dump` |
| Supabase Realtime | `lib/realtime/` (one interface: subscribe/publish) | All components and game logic |
| Supabase Auth | Auth wrapper in `lib/data/auth.ts` + `profiles.id` mapping | Everything else |
| Vercel | Nothing app-side — Next.js runs on any Node host / container | Entire codebase |
| Next.js itself | `app/` routes | `lib/game/` (pure TS), `lib/data/`, most of `components/` |

Practices that keep this table honest:
- No raw vendor SDK usage outside its designated folder (AGENTS.md layering).
- Postgres features we use (RLS, triggers, enums) are standard Postgres, not
  Supabase-only.
- Edge Functions stay thin — they call logic from `lib/game/` where possible.
- Weekly `pg_dump` of prod (Supabase does daily backups; keep our own copy too).

## Future feature → expected migration (roadmap, so schemas don't surprise us)

| Phase | Feature | Migration it will need |
|---|---|---|
| 3 | Elo rating | Already in `profiles.elo_rating`; add `rating_history` table |
| 3 | Quick match | `matchmaking_queue` table (user_id, time_control, enqueued_at) |
| 3 | Chat/emotes | Realtime broadcast only — NO table (ephemeral by design) |
| 4 | Puzzles | `puzzles` table + bulk import script for the Lichess puzzle DB |
| 4 | Daily challenge | `daily_challenges` + `challenge_attempts` |
| 4 | Analysis cache | `game_analysis` (game_id, ply, eval_cp, best_move) |
