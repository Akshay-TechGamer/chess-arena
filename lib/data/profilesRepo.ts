// Leaderboard and profile listings.

import { getSupabase } from './supabaseClient';

export interface LeaderboardRow {
	id: string;
	username: string;
	elo_rating: number;
	games_played: number;
}

export async function topProfiles(limit: number): Promise<LeaderboardRow[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('chess_profiles')
		.select('id, username, elo_rating, games_played')
		.gte('games_played', 1)
		.order('elo_rating', { ascending: false })
		.limit(limit);
	if (error) {
		throw new Error(`Could not load leaderboard: ${error.message}`);
	}
	return data ?? [];
}

export interface LeaderboardPage {
	rows: LeaderboardRow[];
	total: number;
}

/** One page of the leaderboard (0-based page index). */
export async function leaderboardPage(page: number, pageSize: number): Promise<LeaderboardPage> {
	const supabase = getSupabase();
	const from = page * pageSize;
	const { data, count, error } = await supabase
		.from('chess_profiles')
		.select('id, username, elo_rating, games_played', { count: 'exact' })
		.gte('games_played', 1)
		.order('elo_rating', { ascending: false })
		.range(from, from + pageSize - 1);
	if (error) {
		throw new Error(`Could not load leaderboard: ${error.message}`);
	}
	return { rows: data ?? [], total: count ?? 0 };
}
