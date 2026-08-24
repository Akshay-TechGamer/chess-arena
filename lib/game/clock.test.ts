import { describe, expect, it } from 'vitest';
import { formatClock, liveClocks, msAfterMove } from './clock';

describe('msAfterMove', () => {
	it('subtracts elapsed time and adds increment', () => {
		expect(msAfterMove(60_000, 5_000, 2_000)).toBe(57_000);
	});

	it('never goes negative', () => {
		expect(msAfterMove(3_000, 10_000, 0)).toBe(0);
	});

	it('does not resurrect a dead clock with increment', () => {
		expect(msAfterMove(3_000, 10_000, 2_000)).toBe(0);
	});

	it('ignores negative elapsed (clock skew)', () => {
		expect(msAfterMove(60_000, -500, 0)).toBe(60_000);
	});
});

describe('liveClocks', () => {
	const stored = { whiteMs: 60_000, blackMs: 45_000 };

	it('burns time only for the side to move', () => {
		const live = liveClocks(stored, 'w', 1_000, 11_000);
		expect(live).toEqual({ whiteMs: 50_000, blackMs: 45_000 });
	});

	it('burns black time when black is to move', () => {
		const live = liveClocks(stored, 'b', 1_000, 6_000);
		expect(live).toEqual({ whiteMs: 60_000, blackMs: 40_000 });
	});

	it('clamps at zero when the flag fell', () => {
		const live = liveClocks(stored, 'w', 0, 120_000);
		expect(live.whiteMs).toBe(0);
	});
});

describe('formatClock', () => {
	it('formats minutes and seconds', () => {
		expect(formatClock(4 * 60_000 + 3_000)).toBe('4:03');
	});

	it('formats hours', () => {
		expect(formatClock(3_843_000)).toBe('1:04:03');
	});

	it('shows tenths under ten seconds', () => {
		expect(formatClock(9_400)).toBe('0:09.4');
	});

	it('clamps negatives to zero', () => {
		expect(formatClock(-500)).toBe('0:00.0');
	});
});
