// All chess_games / chess_moves database access.

import { getSupabase } from './supabaseClient';
import type { Database } from './database.types';

export type GameRow = Database['public']['Tables']['chess_games']['Row'];
export type MoveRow = Database['public']['Tables']['chess_moves']['Row'];
export type GameResult = Database['public']['Enums']['chess_game_result'];

export async function createOnlineGame(
	userID: string,
	inviteCode: string,
	timeControlSecs: number,
	incrementSecs: number,
): Promise<GameRow> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('chess_games')
		.insert({
			mode: 'online',
			status: 'waiting',
			white_id: userID,
			invite_code: inviteCode,
			time_control_secs: timeControlSecs,
			increment_secs: incrementSecs,
		})
		.select()
		.single();
	if (error || !data) {
		throw new Error(`Could not create game: ${error?.message}`);
	}
	return data;
}

export async function getGame(gameID: string): Promise<GameRow | null> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('chess_games')
		.select()
		.eq('id', gameID)
		.maybeSingle();
	if (error) {
		throw new Error(`Could not load game: ${error.message}`);
	}
	return data;
}

export async function findGameByInviteCode(code: string): Promise<GameRow | null> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('chess_games')
		.select()
		.eq('invite_code', code.toUpperCase())
		.maybeSingle();
	if (error) {
		throw new Error(`Could not look up invite code: ${error.message}`);
	}
	return data;
}

/** Claims the black seat of a waiting game. Returns the updated game. */
export async function joinGame(gameID: string, userID: string): Promise<GameRow> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('chess_games')
		.update({ black_id: userID, status: 'active' })
		.eq('id', gameID)
		.eq('status', 'waiting')
		.is('black_id', null)
		.select()
		.single();
	if (error || !data) {
		throw new Error('Could not join — the game may already be full.');
	}
	return data;
}

export async function listMoves(gameID: string): Promise<MoveRow[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('chess_moves')
		.select()
		.eq('game_id', gameID)
		.order('ply', { ascending: true });
	if (error) {
		throw new Error(`Could not load moves: ${error.message}`);
	}
	return data ?? [];
}

/**
 * Plays a move via the server-side play-move edge function, which validates
 * legality, computes clocks, and finishes the game when it ends (anti-cheat:
 * clients have no direct write access to moves).
 */
export async function playMove(
	gameID: string,
	from: string,
	to: string,
	promotion?: 'q' | 'r' | 'b' | 'n',
): Promise<void> {
	const supabase = getSupabase();
	const { data, error } = await supabase.functions.invoke('play-move', {
		body: { gameID, from, to, promotion },
	});
	if (error) {
		let message = 'Move rejected by server';
		const context = (error as { context?: Response }).context;
		if (context && typeof context.json === 'function') {
			try {
				const body = (await context.json()) as { error?: string };
				if (body.error) {
					message = body.error;
				}
			} catch {
				// keep the generic message
			}
		}
		throw new Error(message);
	}
	if (data && typeof data === 'object' && 'error' in data && data.error) {
		throw new Error(String(data.error));
	}
}

/** Resigns via a server-verified RPC — only a player can resign themselves. */
export async function resignGame(gameID: string): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase.rpc('chess_resign', { p_game_id: gameID });
	if (error) {
		throw new Error(`Could not resign: ${error.message}`);
	}
}

/** Asks the server to verify and apply a flag fall. No-op if time remains. */
export async function claimTimeout(gameID: string): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase.rpc('chess_claim_timeout', { p_game_id: gameID });
	if (error) {
		throw new Error(`Could not claim timeout: ${error.message}`);
	}
}

/** Rematch: both players known up front, game starts immediately. */
export async function createRematchGame(whiteID: string, blackID: string): Promise<GameRow> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('chess_games')
		.insert({ mode: 'online', status: 'active', white_id: whiteID, black_id: blackID })
		.select()
		.single();
	if (error || !data) {
		throw new Error(`Could not create rematch: ${error?.message}`);
	}
	return data;
}

/** Latest games this user played (any status), newest first. */
export async function listMyGames(userID: string, limit: number): Promise<GameRow[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('chess_games')
		.select()
		.or(`white_id.eq.${userID},black_id.eq.${userID}`)
		.order('created_at', { ascending: false })
		.limit(limit);
	if (error) {
		throw new Error(`Could not load games: ${error.message}`);
	}
	return data ?? [];
}

