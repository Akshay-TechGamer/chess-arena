-- Migration: reap abandoned games (Phase 5)
-- Created: 2026-08-24
--
-- Runs hourly inside Postgres via pg_cron. Rules:
--   1. waiting > 24h with no opponent          -> DELETE (contentless invite)
--   2. active  > 24h with zero moves           -> DELETE (never really started)
--   3. active  with moves, idle > 24h          -> the side to move abandoned;
--      their opponent wins ("abandonment") and the Elo trigger applies.
-- Timed games normally end earlier via the in-app flag-fall claim; this job
-- is the backstop for when both players simply closed the tab.

create extension if not exists pg_cron;

create or replace function public.chess_cleanup_stale_games()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	-- 1. unjoined invites
	delete from chess_games
	where status = 'waiting'
	  and created_at < now() - interval '24 hours';

	-- 2. games that never got a first move
	delete from chess_games g
	where g.status = 'active'
	  and g.created_at < now() - interval '24 hours'
	  and not exists (select 1 from chess_moves m where m.game_id = g.id);

	-- 3. idle mid-game: the side to move forfeits.
	--    Even ply count -> white to move -> white abandoned -> black wins.
	update chess_games g
	set status = 'finished',
	    result = case
	    	when (played.ply_count % 2) = 0 then 'black_win'::chess_game_result
	    	else 'white_win'::chess_game_result
	    end,
	    result_reason = 'abandonment'
	from (
		select m.game_id, count(*) as ply_count, max(m.created_at) as last_move_at
		from chess_moves m
		group by m.game_id
	) played
	where g.id = played.game_id
	  and g.status = 'active'
	  and g.mode = 'online'
	  and played.last_move_at < now() - interval '24 hours';
end;
$$;

-- cleanup is server business only
revoke all on function public.chess_cleanup_stale_games() from public, anon, authenticated;

-- hourly; cron.schedule upserts by job name, so re-running is safe
select cron.schedule(
	'chess-cleanup-stale-games',
	'17 * * * *',
	$$select public.chess_cleanup_stale_games()$$
);
