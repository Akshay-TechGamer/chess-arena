// Quick-match access — everything goes through security-definer RPCs;
// the queue table itself is not client-accessible.

import { getSupabase } from './supabaseClient';

/** Returns the game id when paired immediately, null when enqueued. */
export async function quickMatch(): Promise<string | null> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('chess_quick_match');
	if (error) {
		throw new Error(`Quick match failed: ${error.message}`);
	}
	return data ?? null;
}

export async function cancelQuickMatch(): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase.rpc('chess_quick_match_cancel');
	if (error) {
		throw new Error(`Could not leave queue: ${error.message}`);
	}
}
