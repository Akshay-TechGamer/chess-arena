'use client';

// Runs Stockfish over every position of a game and computes each side's
// accuracy. Browser-only (spins up a Web Worker engine).

import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { StockfishEngine } from './stockfish';
import { toWhitePerspective, whiteWinPercent } from '@/lib/game/evaluation';
import { gameAccuracy, type GameAccuracy } from '@/lib/game/accuracy';

const ACCURACY_MOVETIME_MS = 300;

interface Cancel {
	cancelled: boolean;
}

async function analyzeAccuracy(
	fens: readonly string[],
	onProgress: (percent: number) => void,
	cancel: Cancel,
): Promise<GameAccuracy> {
	const engine = new StockfishEngine();
	try {
		const whiteWinPercents: number[] = [];
		for (let i = 0; i < fens.length; i++) {
			if (cancel.cancelled) {
				throw new Error('cancelled');
			}
			const fen = fens[i];
			const side = fen.split(' ')[1] as 'w' | 'b';
			let white: number;
			try {
				const result = await engine.evaluate(fen, ACCURACY_MOVETIME_MS);
				white = whiteWinPercent(toWhitePerspective(result.score, side));
			} catch {
				// Terminal position — the engine has no move to offer.
				const chess = new Chess(fen);
				if (chess.isCheckmate()) {
					white = side === 'w' ? 0 : 100; // side to move is mated
				} else {
					white = 50; // stalemate / draw
				}
			}
			whiteWinPercents.push(white);
			onProgress(Math.round(((i + 1) / fens.length) * 100));
		}
		return gameAccuracy(whiteWinPercents);
	} finally {
		engine.dispose();
	}
}

export interface AccuracyState {
	result: GameAccuracy | null;
	progress: number;
	loading: boolean;
}

/**
 * Computes white/black accuracy for the given position FENs once `enabled`.
 * `fens` should be a stable reference (memoize it) — the analysis restarts
 * whenever it changes.
 */
export function useGameAccuracy(fens: readonly string[] | null, enabled: boolean): AccuracyState {
	const [result, setResult] = useState<GameAccuracy | null>(null);
	const [progress, setProgress] = useState(0);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!enabled || !fens || fens.length < 2) {
			return;
		}
		const cancel: Cancel = { cancelled: false };
		setLoading(true);
		setProgress(0);
		setResult(null);
		analyzeAccuracy(fens, setProgress, cancel)
			.then((accuracy) => {
				if (!cancel.cancelled) {
					setResult(accuracy);
					setLoading(false);
				}
			})
			.catch(() => {
				if (!cancel.cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancel.cancelled = true;
		};
	}, [enabled, fens]);

	return { result, progress, loading };
}
