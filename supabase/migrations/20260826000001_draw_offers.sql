-- Migration: draw offers (agree to a draw)
-- Created: 2026-08-26
--
-- A draw needs mutual consent, so the offer is tracked server-side on the game
-- row. Only the OTHER player can accept, and only while an offer stands — a
-- player cannot force a draw to dodge a loss.

alter table public.chess_games
	add column draw_offered_by uuid references auth.users (id);

-- Offer (or re-offer) a draw in an active game you are playing.
create or replace function public.chess_offer_draw(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	update chess_games
	set draw_offered_by = auth.uid()
	where id = p_game_id
	  and status = 'active'
	  and auth.uid() in (white_id, black_id);
end;
$$;

-- Accept a standing draw offer from the opponent.
create or replace function public.chess_accept_draw(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	g record;
begin
	select * into g from chess_games where id = p_game_id and status = 'active';
	if not found then
		return;
	end if;
	-- an offer must stand, from the OTHER player, and the caller must play here
	if g.draw_offered_by is null
	   or g.draw_offered_by = auth.uid()
	   or auth.uid() not in (g.white_id, g.black_id) then
		return;
	end if;
	update chess_games
	set status = 'finished',
	    result = 'draw',
	    result_reason = 'draw agreement',
	    draw_offered_by = null
	where id = p_game_id and status = 'active';
end;
$$;

-- Decline / withdraw a standing offer.
create or replace function public.chess_clear_draw(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	update chess_games set draw_offered_by = null
	where id = p_game_id and auth.uid() in (white_id, black_id);
end;
$$;

revoke all on function public.chess_offer_draw(uuid) from public, anon;
revoke all on function public.chess_accept_draw(uuid) from public, anon;
revoke all on function public.chess_clear_draw(uuid) from public, anon;
grant execute on function public.chess_offer_draw(uuid) to authenticated;
grant execute on function public.chess_accept_draw(uuid) to authenticated;
grant execute on function public.chess_clear_draw(uuid) to authenticated;
