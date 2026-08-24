// Helpers for talking UCI (Universal Chess Interface) to Stockfish.
// Pure string in / string out — fully unit-tested, no worker code here.

export interface EngineMove {
	from: string;
	to: string;
	promotion?: 'q' | 'r' | 'b' | 'n';
}

const BEST_MOVE_PATTERN = /^bestmove\s+([a-h][1-8])([a-h][1-8])([qrbn])?/;

/**
 * Parses a Stockfish `bestmove` line, e.g. "bestmove e2e4 ponder e7e5".
 * Returns null for non-bestmove lines and for "bestmove (none)"
 * (which Stockfish emits when the position is already decided).
 */
export function parseBestMove(line: string): EngineMove | null {
	const match = BEST_MOVE_PATTERN.exec(line.trim());
	if (!match) {
		return null;
	}
	const move: EngineMove = { from: match[1], to: match[2] };
	if (match[3]) {
		move.promotion = match[3] as EngineMove['promotion'];
	}
	return move;
}

export function positionCommand(fen: string): string {
	return `position fen ${fen}`;
}

export function goCommand(moveTimeMs: number): string {
	return `go movetime ${Math.max(1, Math.round(moveTimeMs))}`;
}

/** Stockfish accepts Skill Level 0-20; clamp anything outside. */
export function skillLevelCommand(skill: number): string {
	const clamped = Math.min(20, Math.max(0, Math.round(skill)));
	return `setoption name Skill Level value ${clamped}`;
}
