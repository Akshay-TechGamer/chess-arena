// Server-authoritative move handler (anti-cheat).
// Validates that the caller is a player, it is their turn, and the move is
// legal (chess.js replays the stored history). Clocks are computed HERE from
// server timestamps, so clients cannot forge time. Direct table writes are
// blocked by RLS — this function's service role is the only writer.

import { Chess } from 'npm:chess.js@1.4.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
	});
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: CORS_HEADERS });
	}
	try {
		const { gameID, from, to, promotion } = await req.json();
		if (typeof gameID !== 'string' || typeof from !== 'string' || typeof to !== 'string') {
			return json({ error: 'bad request' }, 400);
		}

		// Who is calling? (JWT already verified by the platform)
		const authClient = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_ANON_KEY')!,
			{ global: { headers: { Authorization: req.headers.get('Authorization')! } } },
		);
		const { data: userData } = await authClient.auth.getUser();
		const user = userData?.user;
		if (!user) {
			return json({ error: 'not signed in' }, 401);
		}

		const admin = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
		);

		const { data: game } = await admin.from('chess_games').select().eq('id', gameID).single();
		if (!game || game.status !== 'active') {
			return json({ error: 'game is not active' }, 400);
		}
		const isWhite = game.white_id === user.id;
		const isBlack = game.black_id === user.id;
		if (!isWhite && !isBlack) {
			return json({ error: 'you are not a player in this game' }, 403);
		}

		const { data: moves } = await admin
			.from('chess_moves')
			.select('san, white_ms_left, black_ms_left, created_at, ply')
			.eq('game_id', gameID)
			.order('ply', { ascending: true });

		const chess = new Chess();
		for (const move of moves ?? []) {
			chess.move(move.san);
		}
		const whiteToMove = chess.turn() === 'w';
		if (whiteToMove !== isWhite) {
			return json({ error: 'not your turn' }, 400);
		}

		// Server-side clocks
		const baseMs = game.time_control_secs * 1000;
		const incrementMs = game.increment_secs * 1000;
		let whiteMs = 0;
		let blackMs = 0;
		if (baseMs > 0) {
			const last = (moves ?? [])[(moves ?? []).length - 1];
			const prevWhite = last ? last.white_ms_left : baseMs;
			const prevBlack = last ? last.black_ms_left : baseMs;
			const lastAt = Date.parse(last ? last.created_at : game.updated_at);
			const elapsed = Math.max(0, Date.now() - lastAt);
			const moverPrev = whiteToMove ? prevWhite : prevBlack;
			const moverLeft = Math.max(0, moverPrev - elapsed);
			if (moverLeft === 0) {
				// Their flag already fell — the move loses on time instead
				await admin
					.from('chess_games')
					.update({
						status: 'finished',
						result: whiteToMove ? 'black_win' : 'white_win',
						result_reason: 'timeout',
					})
					.eq('id', gameID)
					.eq('status', 'active');
				return json({ error: 'flag fell — you lost on time' }, 409);
			}
			whiteMs = whiteToMove ? moverLeft + incrementMs : prevWhite;
			blackMs = whiteToMove ? prevBlack : moverLeft + incrementMs;
		}

		// Legality — the heart of the anti-cheat
		let made;
		try {
			made = chess.move({ from, to, promotion: promotion ?? undefined });
		} catch {
			return json({ error: 'illegal move' }, 400);
		}

		const ply = (moves ?? []).length + 1;
		const { error: insertError } = await admin.from('chess_moves').insert({
			game_id: gameID,
			ply,
			san: made.san,
			fen_after: chess.fen(),
			white_ms_left: whiteMs,
			black_ms_left: blackMs,
		});
		if (insertError) {
			// unique (game_id, ply) — a concurrent submit already landed
			return json({ error: 'move already recorded' }, 409);
		}

		// A move clears any pending draw offer.
		const update: Record<string, unknown> = {
			fen: chess.fen(),
			pgn: chess.pgn(),
			draw_offered_by: null,
		};
		if (chess.isCheckmate()) {
			update.status = 'finished';
			update.result = whiteToMove ? 'white_win' : 'black_win';
			update.result_reason = 'checkmate';
		} else if (chess.isStalemate()) {
			update.status = 'finished';
			update.result = 'draw';
			update.result_reason = 'stalemate';
		} else if (chess.isInsufficientMaterial()) {
			update.status = 'finished';
			update.result = 'draw';
			update.result_reason = 'insufficient_material';
		} else if (chess.isThreefoldRepetition()) {
			update.status = 'finished';
			update.result = 'draw';
			update.result_reason = 'threefold_repetition';
		} else if (chess.isDraw()) {
			update.status = 'finished';
			update.result = 'draw';
			update.result_reason = 'fifty_move_rule';
		}
		await admin.from('chess_games').update(update).eq('id', gameID);

		return json({ ok: true, san: made.san, whiteMs, blackMs });
	} catch (error) {
		return json({ error: String(error) }, 500);
	}
});
