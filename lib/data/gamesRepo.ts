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

export interface RecordMoveInput {
	gameID: string;
	ply: number;
	san: string;
	fenAfter: string;
	pgn: string;
	/** Remaining clocks AFTER this move; 0/0 for unlimited games. */
	whiteMsLeft: number;
	blackMsLeft: number;
}

/** Inserts the move and syncs the game's current position. */
export async function recordMove(input: RecordMoveInput): Promise<void> {
	const supabase = getSupabase();
	const { error: moveError } = await supabase.from('chess_moves').insert({
		game_id: input.gameID,
		ply: input.ply,
		san: input.san,
		fen_after: input.fenAfter,
		white_ms_left: Math.round(input.whiteMsLeft),
		black_ms_left: Math.round(input.blackMsLeft),
	});
	if (moveError) {
		throw new Error(`Could not record move: ${moveError.message}`);
	}
	const { error: gameError } = await supabase
		.from('chess_games')
		.update({ fen: input.fenAfter, pgn: input.pgn })
		.eq('id', input.gameID);
	if (gameError) {
		throw new Error(`Could not update game position: ${gameError.message}`);
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

export async function finishGame(
	gameID: string,
	result: GameResult,
	reason: string,
): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase
		.from('chess_games')
		.update({ status: 'finished', result, result_reason: reason })
		.eq('id', gameID)
		.neq('status', 'finished');
	if (error) {
		throw new Error(`Could not finish game: ${error.message}`);
	}
}
