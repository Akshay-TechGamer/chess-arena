// The ONLY place a Supabase client is created (see AGENTS.md layering).
// All tables of this shared Supabase project are visible in the generated
// types, but chess-arena code must only ever touch the chess_* tables.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
	if (!client) {
		const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
		if (!url || !anonKey) {
			throw new Error('Supabase env vars missing — see .env.example');
		}
		client = createClient<Database>(url, anonKey);
	}
	return client;
}
