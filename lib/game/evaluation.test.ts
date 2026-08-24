import { describe, expect, it } from 'vitest';
import {
	formatScore,
	parseInfoScore,
	toWhitePerspective,
	whiteWinPercent,
} from './evaluation';

describe('parseInfoScore', () => {
	it('parses a cp score with depth', () => {
		const line = 'info depth 15 seldepth 21 multipv 1 score cp 34 nodes 100 pv e2e4';
		expect(parseInfoScore(line)).toEqual({ cp: 34, depth: 15 });
	});

	it('parses negative cp', () => {
		expect(parseInfoScore('info depth 12 score cp -230 pv d7d5')).toEqual({ cp: -230, depth: 12 });
	});

	it('parses mate scores', () => {
		expect(parseInfoScore('info depth 20 score mate 3 pv h5f7')).toEqual({ mate: 3, depth: 20 });
		expect(parseInfoScore('info depth 20 score mate -2 pv a1a2')).toEqual({ mate: -2, depth: 20 });
	});

	it('returns null for bestmove and junk lines', () => {
		expect(parseInfoScore('bestmove e2e4')).toBeNull();
		expect(parseInfoScore('info string NNUE evaluation enabled')).toBeNull();
	});
});

describe('toWhitePerspective', () => {
	it('keeps scores when white to move', () => {
		expect(toWhitePerspective({ cp: 50, depth: 10 }, 'w')).toEqual({ cp: 50, depth: 10 });
	});

	it('negates when black to move', () => {
		expect(toWhitePerspective({ cp: 50, depth: 10 }, 'b')).toEqual({ cp: -50, depth: 10 });
		expect(toWhitePerspective({ mate: 2, depth: 10 }, 'b')).toEqual({ mate: -2, depth: 10 });
	});
});

describe('whiteWinPercent', () => {
	it('is 50 for an equal position', () => {
		expect(whiteWinPercent({ cp: 0, depth: 10 })).toBe(50);
	});

	it('rises for white advantage, falls for black', () => {
		expect(whiteWinPercent({ cp: 300, depth: 10 })).toBeGreaterThan(70);
		expect(whiteWinPercent({ cp: -300, depth: 10 })).toBeLessThan(30);
	});

	it('pins mate scores to the rails', () => {
		expect(whiteWinPercent({ mate: 2, depth: 10 })).toBe(100);
		expect(whiteWinPercent({ mate: -2, depth: 10 })).toBe(0);
	});
});

describe('formatScore', () => {
	it('formats pawns with sign', () => {
		expect(formatScore({ cp: 130, depth: 10 })).toBe('+1.3');
		expect(formatScore({ cp: -40, depth: 10 })).toBe('-0.4');
	});

	it('formats mate counts', () => {
		expect(formatScore({ mate: 3, depth: 10 })).toBe('#3');
		expect(formatScore({ mate: -2, depth: 10 })).toBe('#-2');
	});
});
