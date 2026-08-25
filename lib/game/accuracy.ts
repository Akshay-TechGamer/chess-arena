// Game accuracy from engine evaluations — pure logic (see AGENTS.md).
//
// Method (Lichess-style): for each move, look at the mover's winning chances
// before and after the move. A move that keeps the same winning chances scores
// ~100%; a move that throws away a big chunk scores low. The per-move accuracy
// curve is Lichess's: 103.1668 * exp(-0.04354 * drop) - 3.1669.

/** Per-move accuracy from the mover's win% before and after (0-100 scale). */
export function moveAccuracy(winBefore: number, winAfter: number): number {
	const drop = Math.max(0, winBefore - winAfter);
	const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
	return Math.max(0, Math.min(100, raw));
}

export interface GameAccuracy {
	white: number | null;
	black: number | null;
}

/**
 * whiteWinPercents[i] = White's winning chances (0-100) at the position after
 * i plies (index 0 = start position, length = plies + 1). Returns each side's
 * average move accuracy, or null for a side that made no moves.
 */
export function gameAccuracy(whiteWinPercents: readonly number[]): GameAccuracy {
	const whiteScores: number[] = [];
	const blackScores: number[] = [];

	for (let ply = 1; ply < whiteWinPercents.length; ply++) {
		const before = whiteWinPercents[ply - 1];
		const after = whiteWinPercents[ply];
		const whiteMoved = ply % 2 === 1; // ply 1 = White's first move
		if (whiteMoved) {
			whiteScores.push(moveAccuracy(before, after));
		} else {
			// Black's win% is the mirror of White's.
			blackScores.push(moveAccuracy(100 - before, 100 - after));
		}
	}

	const mean = (values: number[]): number | null =>
		values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;

	return { white: mean(whiteScores), black: mean(blackScores) };
}
