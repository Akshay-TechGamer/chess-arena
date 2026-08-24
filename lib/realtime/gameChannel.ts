// Thin interface over Supabase Realtime for one game (see AGENTS.md).
// If we ever swap Realtime providers, only this file changes.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/data/supabaseClient';
import type { GameRow, MoveRow } from '@/lib/data/gamesRepo';

export interface GameChannelHandlers {
	/** A new move row was inserted (fires for BOTH players' moves). */
	onMove: (move: MoveRow) => void;
	/** The game row changed (join, finish, position sync). */
	onGameUpdate: (game: GameRow) => void;
	/** Number of people currently connected to this game's channel. */
	onPresenceChange?: (count: number) => void;
}

export function subscribeToGame(
	gameID: string,
	userID: string,
	handlers: GameChannelHandlers,
): () => void {
	const supabase = getSupabase();
	const channel: RealtimeChannel = supabase
		.channel(`game:${gameID}`, { config: { presence: { key: userID } } })
		.on(
			'postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'chess_moves', filter: `game_id=eq.${gameID}` },
			(payload) => handlers.onMove(payload.new as MoveRow),
		)
		.on(
			'postgres_changes',
			{ event: 'UPDATE', schema: 'public', table: 'chess_games', filter: `id=eq.${gameID}` },
			(payload) => handlers.onGameUpdate(payload.new as GameRow),
		)
		.on('presence', { event: 'sync' }, () => {
			if (handlers.onPresenceChange) {
				handlers.onPresenceChange(Object.keys(channel.presenceState()).length);
			}
		})
		.subscribe((status) => {
			if (status === 'SUBSCRIBED') {
				void channel.track({ online_at: new Date().toISOString() });
			}
		});

	return () => {
		void supabase.removeChannel(channel);
	};
}
