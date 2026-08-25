import { describe, expect, it } from 'vitest';
import { gameAccuracy, moveAccuracy } from './accuracy';

describe('moveAccuracy', () => {
	it('is ~100 when winning chances are unchanged', () => {
		expect(moveAccuracy(60, 60)).toBeGreaterThan(99);
	});

	it('drops as the mover throws away winning chances', () => {
		expect(moveAccuracy(80, 40)).toBeLessThan(30);
		expect(moveAccuracy(80, 75)).toBeGreaterThan(75);
	});

	it('does not reward a move that gained (drop clamped at 0)', () => {
		// gaining win% shouldn't push accuracy above 100
		expect(moveAccuracy(40, 90)).toBeGreaterThan(99);
		expect(moveAccuracy(40, 90)).toBeLessThanOrEqual(100);
	});

	it('stays within 0..100', () => {
		expect(moveAccuracy(100, 0)).toBeGreaterThanOrEqual(0);
		expect(moveAccuracy(100, 0)).toBeLessThanOrEqual(100);
	});
});

describe('gameAccuracy', () => {
	it('gives ~100 to both sides for a perfectly steady game', () => {
		// win% never changes → every move is accurate
		const steady = [50, 50, 50, 50, 50];
		const { white, black } = gameAccuracy(steady);
		expect(white).toBeGreaterThan(99);
		expect(black).toBeGreaterThan(99);
	});

	it('penalises the side that blundered', () => {
		// ply1 (white) 50->52 fine; ply2 (black) 52->90 = black blundered
		// (white win% shot up, so black lost chances)
		const { white, black } = gameAccuracy([50, 52, 90]);
		expect(white).toBeGreaterThan(95);
		expect(black! < white!).toBe(true);
		expect(black).toBeLessThan(50);
	});

	it('returns null for a side that never moved', () => {
		const { white, black } = gameAccuracy([50]); // no moves
		expect(white).toBeNull();
		expect(black).toBeNull();
	});

	it('handles a one-move game (white only)', () => {
		const { white, black } = gameAccuracy([50, 55]);
		expect(white).not.toBeNull();
		expect(black).toBeNull();
	});
});
