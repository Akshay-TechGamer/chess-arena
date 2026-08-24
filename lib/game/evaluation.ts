// Evaluation helpers for the analysis view — pure logic (see AGENTS.md).

export interface EngineScore {
	/** Centipawns from the side-to-move's perspective (UCI convention). */
	cp?: number;
	/** Moves until mate, from the side-to-move's perspective. */
	mate?: number;
	depth: number;
}

const INFO_SCORE_PATTERN = /\binfo\b(?=.*\bdepth (\d+))(?=.*\bscore (cp|mate) (-?\d+))/;

/** Parses a UCI "info ... depth N ... score cp X" line; null for others. */
export function parseInfoScore(line: string): EngineScore | null {
	const match = INFO_SCORE_PATTERN.exec(line);
	if (!match) {
		return null;
	}
	const depth = Number(match[1]);
	const value = Number(match[3]);
	if (match[2] === 'mate') {
		return { mate: value, depth };
	}
	return { cp: value, depth };
}

/** Converts a side-to-move score to white's perspective. */
export function toWhitePerspective(score: EngineScore, sideToMove: 'w' | 'b'): EngineScore {
	if (sideToMove === 'w') {
		return score;
	}
	return {
		depth: score.depth,
		...(score.cp != null ? { cp: -score.cp } : {}),
		...(score.mate != null ? { mate: -score.mate } : {}),
	};
}

/**
 * White's winning chances as a percentage (0-100) for the eval bar.
 * Uses Lichess's logistic mapping from centipawns.
 */
export function whiteWinPercent(scoreForWhite: EngineScore): number {
	if (scoreForWhite.mate != null) {
		return scoreForWhite.mate > 0 ? 100 : 0;
	}
	const cp = scoreForWhite.cp ?? 0;
	const clamped = Math.max(-1500, Math.min(1500, cp));
	return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

/** "+1.3", "-0.4", "#3", "#-2" — the conventional short form. */
export function formatScore(scoreForWhite: EngineScore): string {
	if (scoreForWhite.mate != null) {
		return scoreForWhite.mate > 0 ? `#${scoreForWhite.mate}` : `#-${Math.abs(scoreForWhite.mate)}`;
	}
	const pawns = (scoreForWhite.cp ?? 0) / 100;
	return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}
