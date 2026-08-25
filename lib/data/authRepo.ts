// Auth + profile access. Guests get an anonymous Supabase session and a
// generated username in chess_profiles.

import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabaseClient';

export interface ChessProfile {
	id: string;
	username: string;
	elo_rating: number;
}

/** Current Elo rating for a user, or null if they have no profile yet. */
export async function getMyRating(userID: string): Promise<number | null> {
	const supabase = getSupabase();
	const { data } = await supabase
		.from('chess_profiles')
		.select('elo_rating')
		.eq('id', userID)
		.maybeSingle();
	return data?.elo_rating ?? null;
}

/** Returns the signed-in user, creating an anonymous session if needed. */
export async function ensureSignedIn(): Promise<User> {
	const supabase = getSupabase();
	const { data: sessionData } = await supabase.auth.getSession();
	if (sessionData.session) {
		return sessionData.session.user;
	}
	const { data, error } = await supabase.auth.signInAnonymously();
	if (error || !data.user) {
		throw new Error(`Anonymous sign-in failed: ${error?.message}`);
	}
	return data.user;
}

/** Returns the user's chess profile, creating one on first visit. */
export async function ensureProfile(user: User): Promise<ChessProfile> {
	const supabase = getSupabase();
	const { data: existing } = await supabase
		.from('chess_profiles')
		.select('id, username, elo_rating')
		.eq('id', user.id)
		.maybeSingle();
	if (existing) {
		return existing;
	}
	const base = usernameFor(user);
	// The username column is unique — retry with a numeric suffix on collision.
	for (let attempt = 0; attempt < 4; attempt++) {
		const username = attempt === 0 ? base : `${base.slice(0, 16)}_${attempt + 1}`;
		const { data: created, error } = await supabase
			.from('chess_profiles')
			.insert({ id: user.id, username })
			.select('id, username, elo_rating')
			.single();
		if (created) {
			return created;
		}
		if (error && error.code !== '23505') {
			throw new Error(`Could not create profile: ${error.message}`);
		}
	}
	throw new Error('Could not create profile: username taken');
}

/** Google users get their display name; guests get Guest-<id fragment>. */
function usernameFor(user: User): string {
	const metadata = user.user_metadata as Record<string, unknown> | null;
	const rawName =
		(typeof metadata?.full_name === 'string' && metadata.full_name) ||
		(typeof metadata?.name === 'string' && metadata.name) ||
		'';
	const cleaned = rawName
		.replace(/[^A-Za-z0-9 _-]/g, '')
		.trim()
		.replace(/\s+/g, '_')
		.slice(0, 20);
	if (cleaned.length >= 3) {
		return cleaned;
	}
	return `Guest-${user.id.replace(/-/g, '').slice(0, 6)}`;
}

export function isGuestUser(user: User): boolean {
	return user.is_anonymous === true;
}

/** Usernames for a set of user ids, keyed by id. Unknown ids are omitted. */
export async function getUsernames(ids: readonly string[]): Promise<Record<string, string>> {
	const wanted = ids.filter(Boolean);
	if (wanted.length === 0) {
		return {};
	}
	const supabase = getSupabase();
	const { data } = await supabase
		.from('chess_profiles')
		.select('id, username')
		.in('id', wanted);
	const names: Record<string, string> = {};
	for (const row of data ?? []) {
		names[row.id] = row.username;
	}
	return names;
}
