# Deployment

How Chess Arena gets from your laptop to the internet. Three environments:

| Environment | Vercel | Supabase project | When |
|---|---|---|---|
| Local | `npm run dev` | `supabase start` (Docker, local) | While coding |
| Preview | Auto per pull request | `chess-dev` | Every PR gets its own URL |
| Production | `main` branch | `chess-prod` | On merge to `main` |

## One-time setup

### 1. Supabase (two projects)

1. In the [Supabase dashboard](https://supabase.com/dashboard), create two
   projects in your org: `chess-dev` and `chess-prod`.
2. Install the CLI and link the repo (defaults to dev):

```bash
npx supabase login
npx supabase link --project-ref <chess-dev-ref>
```

3. Push the schema:

```bash
npx supabase db push
```

4. Repeat `link` + `db push` against `chess-prod` when you first go live.
5. In both projects: Authentication → enable **Anonymous sign-in** and
   **Google** provider.

### 2. Vercel

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new)
   (framework auto-detected: Next.js).
2. Set environment variables (Settings → Environment Variables):

| Variable | Preview value | Production value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | chess-dev URL | chess-prod URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chess-dev anon key | chess-prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | chess-dev service key | chess-prod service key |

Never put the service role key in a `NEXT_PUBLIC_` variable — it bypasses RLS.

### 3. GitHub Actions secrets

For the migration deploy workflow (`.github/workflows/`):
- `SUPABASE_ACCESS_TOKEN` — from supabase.com/dashboard/account/tokens
- `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_PROD_PROJECT_REF`
- `SUPABASE_DB_PASSWORD_DEV`, `SUPABASE_DB_PASSWORD_PROD`

## Normal deploy flow (every feature)

1. Branch → code → PR.
2. CI runs: lint, typecheck, tests, and applies new migrations to a throwaway
   local Supabase to prove they replay cleanly.
3. PR merge to `main`:
   - CI applies new migrations to `chess-prod` (`supabase db push`)
   - Vercel builds and deploys production
4. Order matters: **migrations deploy before the app build**, and every
   migration must be backward-compatible with the previous app version
   (see MIGRATIONS.md). That way there is zero downtime and instant rollback.

## Rollback

- **App**: Vercel dashboard → Deployments → previous deployment → "Promote to
  Production". Instant.
- **DB**: never roll a migration back in prod. Write a new forward migration
  that undoes the change. (This is why migrations must be backward-compatible.)

## Checklist before first prod deploy

- [ ] RLS enabled on every table (`supabase db lint` / dashboard check)
- [ ] Anonymous + Google auth enabled in chess-prod
- [ ] Site URL + redirect URLs set in chess-prod Auth settings (your Vercel domain)
- [ ] All three env vars set for Production in Vercel
- [ ] `main` branch protection: PRs only, CI must pass
