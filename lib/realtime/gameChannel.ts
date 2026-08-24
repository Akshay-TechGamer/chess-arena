// Thin interface over Supabase Realtime for one game (see AGENTS.md).
// If we ever swap Realtime providers, only this file changes.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/data/supabaseClient';
import type { GameRow, MoveRow } from '@/lib/data/gamesRepo';

export interface ChatMessage {
	from: string;
	username: string;
	text: string;
}

export interface RematchSignal {
	kind: 'offer' | 'start';
	from: string;
	gameID?: string;
}

export interface GameChannelHandlers {
	/** A new move row was inserted (fires for BOTH players' moves). */
	onMove: (move: MoveRow) => void;
	/** The game row changed (join, finish, position sync). */
	onGameUpdate: (game: GameRow) => void;
	/** Number of people currently connected to this game's channel. */
	onPresenceChange?: (count: number) => void;
	onChat?: (message: ChatMessage) => void;
	onRematch?: (signal: RematchSignal) => void;
}

export interface GameChannelHandle {
	sendChat: (message: ChatMessage) => void;
	sendRematch: (signal: RematchSignal) => void;
	unsubscribe: () => void;
}

export function subscribeToGame(
	gameID: string,
	userID: string,
	handlers: GameChannelHandlers,
): GameChannelHandle {
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
		.on('broadcast', { event: 'chat' }, (payload) => {
			if (handlers.onChat) {
				handlers.onChat(payload.payload as ChatMessage);
			}
		})
		.on('broadcast', { event: 'rematch' }, (payload) => {
			if (handlers.onRematch) {
				handlers.onRematch(payload.payload as RematchSignal);
			}
		})
		.subscribe((status) => {
			if (status === 'SUBSCRIBED') {
				void channel.track({ online_at: new Date().toISOString() });
			}
		});

	return {
		sendChat: (message) => {
			void channel.send({ type: 'broadcast', event: 'chat', payload: message });
		},
		sendRematch: (signal) => {
			void channel.send({ type: 'broadcast', event: 'rematch', payload: signal });
		},
		unsubscribe: () => {
			void supabase.removeChannel(channel);
		},
	};
}

/**
 * Watches for a new game where I am white — how a queued quick-match player
 * finds out they were paired. Returns an unsubscribe function.
 */
export function subscribeToMyNewGames(userID: string, onGame: (gameID: string) => void): () => void {
	const supabase = getSupabase();
	const channel = supabase
		.channel(`mygames:${userID}`)
		.on(
			'postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'chess_games', filter: `white_id=eq.${userID}` },
			(payload) => onGame((payload.new as GameRow).id),
		)
		.subscribe();
	return () => {
		void supabase.removeChannel(channel);
	};
}
