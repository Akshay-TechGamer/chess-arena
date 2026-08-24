// Chess clock math — pure logic (see AGENTS.md).
//
// Storage model: every chess_moves row stores BOTH players' remaining ms
// AFTER that move. The side to move burns time measured from the previous
// move's created_at (or from game activation for white's first move).

export const UNLIMITED_TIME = 0;

export interface ClockSnapshot {
	whiteMs: number;
	blackMs: number;
}

export interface TimeControlOption {
	id: string;
	label: string;
	/** Starting time in seconds. UNLIMITED_TIME means no clocks. */
	baseSecs: number;
	/** Added to the mover's clock after each of their moves, in seconds. */
	incrementSecs: number;
}

export const TIME_CONTROLS: readonly TimeControlOption[] = [
	{ id: 'blitz3', label: '3 min', baseSecs: 180, incrementSecs: 0 },
	{ id: 'blitz5', label: '5 min', baseSecs: 300, incrementSecs: 0 },
	{ id: 'rapid10', label: '10 min', baseSecs: 600, incrementSecs: 0 },
	{ id: 'unlimited', label: 'No clock', baseSecs: UNLIMITED_TIME, incrementSecs: 0 },
];

/** Remaining time for the mover after spending elapsedMs, plus increment. */
export function msAfterMove(prevMs: number, elapsedMs: number, incrementMs: number): number {
	const spent = Math.max(0, elapsedMs);
	const left = Math.max(0, prevMs - spent);
	if (left === 0) {
		return 0; // flag fell — no increment resurrects a dead clock
	}
	return left + Math.max(0, incrementMs);
}

/**
 * Live clock display: takes the last stored snapshot (both clocks after the
 * last move, taken at lastMoveAtMs) and burns wall time for the side to move.
 * With no moves yet, pass the full time control as the snapshot and the game
 * activation time as lastMoveAtMs.
 */
export function liveClocks(
	stored: ClockSnapshot,
	sideToMove: 'w' | 'b',
	lastMoveAtMs: number,
	nowMs: number,
): ClockSnapshot {
	const elapsed = Math.max(0, nowMs - lastMoveAtMs);
	if (sideToMove === 'w') {
		return { whiteMs: Math.max(0, stored.whiteMs - elapsed), blackMs: stored.blackMs };
	}
	return { whiteMs: stored.whiteMs, blackMs: Math.max(0, stored.blackMs - elapsed) };
}

/** "4:03" under an hour, "1:04:03" above, "0:09.4" under 10 seconds. */
export function formatClock(ms: number): string {
	const clamped = Math.max(0, ms);
	const totalSeconds = Math.floor(clamped / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	if (totalSeconds < 10) {
		const tenths = Math.floor((clamped % 1000) / 100);
		return `0:0${seconds}.${tenths}`;
	}
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
