import { describe, expect, it } from 'vitest';
import { buildGameFromSans } from './replay';

describe('buildGameFromSans', () => {
	it('returns the start position for no moves', () => {
		const game = buildGameFromSans([]);
		expect(game.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
	});

	it('replays a short opening correctly', () => {
		const game = buildGameFromSans(['e4', 'e5', 'Nf3', 'Nc6']);
		expect(game.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
		expect(game.turn()).toBe('w');
	});

	it('replays through checkmate', () => {
		const game = buildGameFromSans(['f3', 'e5', 'g4', 'Qh4#']);
		expect(game.isCheckmate()).toBe(true);
	});

	it('throws on a corrupt history', () => {
		expect(() => buildGameFromSans(['e4', 'e9'])).toThrow(/corrupt/);
	});
});
