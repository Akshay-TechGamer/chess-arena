import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron target (see "crons" in vercel.json) — runs daily, server-side.
//
// Purpose: touch the Supabase database so the free-tier project is not paused
// for inactivity. A lightweight HEAD count with the anon key is enough to
// register activity; RLS may hide rows, but the query still hits the DB.
// Same pattern as Chowka-Bhara / CareerMentor (shared Supabase project).
//
// When CRON_SECRET is set on Vercel, cron requests carry
// "Authorization: Bearer <CRON_SECRET>", so random visitors can't trigger it.

const KEEP_ALIVE_TABLE = 'chess_games';

export async function GET(req: Request) {
	const secret = process.env.CRON_SECRET;
	if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
		return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	}

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !anonKey) {
		return NextResponse.json(
			{ ok: false, error: 'Missing Supabase environment variables' },
			{ status: 500 },
		);
	}

	const supabase = createClient(url, anonKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

	try {
		const { count, error } = await supabase
			.from(KEEP_ALIVE_TABLE)
			.select('*', { count: 'exact', head: true });
		if (error) {
			throw error;
		}
		return NextResponse.json({
			ok: true,
			ranAt: new Date().toISOString(),
			table: KEEP_ALIVE_TABLE,
			rowCount: count ?? 0,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ ok: false, error: message }, { status: 500 });
	}
}
