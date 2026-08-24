-- Migration: allow joining a waiting online game
-- Created: 2026-08-24
--
-- The base update policy only lets existing players update a game, but a
-- joiner is not a player yet — they need to claim the empty black seat.
-- This policy allows exactly that: any signed-in user may update a game that
-- is still waiting with no black player, and the updated row must have
-- themselves as black. (Move-level integrity is enforced by chess_moves
-- policies; server-side move validation lands in a later phase.)

create policy "players can join waiting chess games"
	on public.chess_games for update
	using (
		status = 'waiting'
		and black_id is null
		and auth.uid() is not null
		and auth.uid() is distinct from white_id
	)
	with check (black_id = auth.uid());
