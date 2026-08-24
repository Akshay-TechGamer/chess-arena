import { describe, expect, it } from 'vitest';
import { derivePuzzlePosition, matchesSolution, uciToMove } from './puzzle';

describe('uciToMove', () => {
	it('splits from/to squares', () => {
		expect(uciToMove('e2e4')).toEqual({ from: 'e2', to: 'e4' });
	});

	it('carries promotions', () => {
		expect(uciToMove('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
	});
});

describe('derivePuzzlePosition', () => {
	// Scholar's mate setup: after these moves White plays Qxf7#
	const pgn = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6'];

	it('uses the position after all pgn moves when the solution fits', () => {
		const position = derivePuzzlePosition(pgn, ['h5f7']);
		expect(position.sideToMove).toBe('w');
		expect(position.fen).toContain('r1bqkb1r');
	});

	it('falls back to dropping the last move when needed', () => {
		// Extra trailing move makes h5f7 illegal until we undo it
		const position = derivePuzzlePosition([...pgn, 'Qxf7#'], ['h5f7']);
		expect(position.sideToMove).toBe('w');
	});

	it('throws when the solution never fits', () => {
		expect(() => derivePuzzlePosition(pgn, ['a1a8'])).toThrow(/reconstruct/);
	});

	it('throws on an empty solution', () => {
		expect(() => derivePuzzlePosition(pgn, [])).toThrow(/no solution/);
	});
});

describe('matchesSolution', () => {
	it('matches plain moves', () => {
		expect(matchesSolution({ from: 'e2', to: 'e4' }, 'e2e4')).toBe(true);
		expect(matchesSolution({ from: 'e2', to: 'e3' }, 'e2e4')).toBe(false);
	});

	it('requires matching promotion when the solution has one', () => {
		expect(matchesSolution({ from: 'e7', to: 'e8', promotion: 'q' }, 'e7e8q')).toBe(true);
		expect(matchesSolution({ from: 'e7', to: 'e8', promotion: 'r' }, 'e7e8q')).toBe(false);
	});
});
