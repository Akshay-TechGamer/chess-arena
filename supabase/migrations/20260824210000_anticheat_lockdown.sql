-- Migration: anti-cheat lockdown (Phase 5)
-- Created: 2026-08-24
--
-- Moves now go through the play-move edge function (service role), which
-- validates legality and computes clocks server-side. Resign and timeout
-- claims go through security-definer RPCs. Clients lose their direct write
-- access to chess_moves and to chess_games rows (the join policy stays —
-- claiming the empty black seat is still a client action).

-- ============================================================
-- Resign: the caller loses, the opponent wins.
-- ============================================================
create or replace function public.chess_resign(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	update chess_games
	set status = 'finished',
	    result = case when white_id = auth.uid() then 'black_win' else 'white_win' end::chess_game_result,
	    result_reason = 'resignation'
	where id = p_game_id
	  and status = 'active'
	  and auth.uid() in (white_id, black_id);
end;
$$;

-- ============================================================
-- Timeout claim: server recomputes the flag from stored clocks and
-- timestamps — a client cannot fake a flag fall.
-- ============================================================
create or replace function public.chess_claim_timeout(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	g record;
	last_move record;
	white_to_move boolean;
	remaining_ms bigint;
	elapsed_ms bigint;
begin
	select * into g from chess_games
	where id = p_game_id and status = 'active' and mode = 'online';
	if not found or g.time_control_secs = 0 or auth.uid() not in (g.white_id, g.black_id) then
		return;
	end if;

	select * into last_move from chess_moves
	where game_id = p_game_id order by ply desc limit 1;

	if found then
		white_to_move := (last_move.ply % 2 = 0);
		remaining_ms := case when white_to_move then last_move.white_ms_left else last_move.black_ms_left end;
		elapsed_ms := floor(extract(epoch from (now() - last_move.created_at)) * 1000);
	else
		white_to_move := true;
		remaining_ms := g.time_control_secs::bigint * 1000;
		elapsed_ms := floor(extract(epoch from (now() - g.updated_at)) * 1000);
	end if;

	if elapsed_ms >= remaining_ms then
		update chess_games
		set status = 'finished',
		    result = case when white_to_move then 'black_win' else 'white_win' end::chess_game_result,
		    result_reason = 'timeout'
		where id = p_game_id and status = 'active';
	end if;
end;
$$;

revoke all on function public.chess_resign(uuid) from public, anon;
revoke all on function public.chess_claim_timeout(uuid) from public, anon;
grant execute on function public.chess_resign(uuid) to authenticated;
grant execute on function public.chess_claim_timeout(uuid) to authenticated;

-- ============================================================
-- Lockdown: clients may no longer write moves or game rows directly.
-- ============================================================
drop policy "players can insert moves in their chess games" on public.chess_moves;
drop policy "players can update their own chess games" on public.chess_games;
