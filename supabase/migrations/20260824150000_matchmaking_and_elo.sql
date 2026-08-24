-- Migration: quick-match queue + server-side Elo rating
-- Created: 2026-08-24
--
-- Elo is applied by a trigger (not the client) so ratings cannot be forged.
-- The queue table has RLS enabled with NO policies: clients can only go
-- through the two security-definer RPCs below.

-- ============================================================
-- chess_matchmaking_queue
-- ============================================================
create table public.chess_matchmaking_queue (
	user_id uuid primary key references public.chess_profiles (id) on delete cascade,
	enqueued_at timestamptz not null default now()
);

alter table public.chess_matchmaking_queue enable row level security;

-- ============================================================
-- Quick match RPC: pair with the longest-waiting player, or enqueue.
-- Returns the new game id when paired, null when enqueued.
-- The queued player is white; the player who completes the pair is black.
-- ============================================================
create or replace function public.chess_quick_match()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	opponent uuid;
	new_game_id uuid;
begin
	if auth.uid() is null then
		raise exception 'must be signed in';
	end if;

	select user_id into opponent
	from chess_matchmaking_queue
	where user_id <> auth.uid()
	order by enqueued_at
	limit 1
	for update skip locked;

	if opponent is not null then
		delete from chess_matchmaking_queue where user_id in (opponent, auth.uid());
		insert into chess_games (mode, status, white_id, black_id)
		values ('online', 'active', opponent, auth.uid())
		returning id into new_game_id;
		return new_game_id;
	end if;

	insert into chess_matchmaking_queue (user_id)
	values (auth.uid())
	on conflict (user_id) do update set enqueued_at = now();
	return null;
end;
$$;

create or replace function public.chess_quick_match_cancel()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	delete from chess_matchmaking_queue where user_id = auth.uid();
end;
$$;

revoke all on function public.chess_quick_match() from public, anon;
revoke all on function public.chess_quick_match_cancel() from public, anon;
grant execute on function public.chess_quick_match() to authenticated;
grant execute on function public.chess_quick_match_cancel() to authenticated;

-- ============================================================
-- Elo trigger: fires once when an online 2-player game finishes.
-- Standard Elo, K=32.
-- ============================================================
create or replace function public.chess_apply_elo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	white_rating integer;
	black_rating integer;
	expected_white numeric;
	score_white numeric;
	k constant integer := 32;
begin
	if new.status = 'finished'
	   and old.status is distinct from 'finished'
	   and new.mode = 'online'
	   and new.white_id is not null
	   and new.black_id is not null
	   and new.result is not null then
		select elo_rating into white_rating from chess_profiles where id = new.white_id for update;
		select elo_rating into black_rating from chess_profiles where id = new.black_id for update;

		expected_white := 1 / (1 + power(10, (black_rating - white_rating) / 400.0));
		score_white := case new.result
			when 'white_win' then 1.0
			when 'black_win' then 0.0
			else 0.5
		end;

		update chess_profiles
		set elo_rating = round(elo_rating + k * (score_white - expected_white)),
		    games_played = games_played + 1
		where id = new.white_id;

		update chess_profiles
		set elo_rating = round(elo_rating + k * ((1 - score_white) - (1 - expected_white))),
		    games_played = games_played + 1
		where id = new.black_id;
	end if;
	return new;
end;
$$;

create trigger chess_games_apply_elo
	after update on public.chess_games
	for each row
	execute function public.chess_apply_elo();
