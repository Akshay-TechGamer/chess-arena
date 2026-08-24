import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { getGameStatus } from './status';

describe('getGameStatus', () => {
	it('reports white to move at the start', () => {
		const status = getGameStatus(new Chess());
		expect(status).toMatchObject({
			isOver: false,
			winner: null,
			reason: null,
			turn: 'white',
			inCheck: false,
			text: 'White to move',
		});
	});

	it('reports check while the game is running', () => {
		const game = new Chess();
		// 1. e4 f6 2. Qh5+ — black is in check
		game.move('e4');
		game.move('f6');
		game.move('Qh5+');
		const status = getGameStatus(game);
		expect(status.isOver).toBe(false);
		expect(status.inCheck).toBe(true);
		expect(status.text).toBe('Black to move — check!');
	});

	it("detects checkmate (fool's mate — black wins)", () => {
		const game = new Chess();
		game.move('f3');
		game.move('e5');
		game.move('g4');
		game.move('Qh4#');
		const status = getGameStatus(game);
		expect(status).toMatchObject({
			isOver: true,
			winner: 'black',
			reason: 'checkmate',
			text: 'Checkmate — Black wins',
		});
	});

	it('detects checkmate for white', () => {
		// Back-rank mate position, black just got mated
		const game = new Chess('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
		game.move('Ra8#');
		const status = getGameStatus(game);
		expect(status.winner).toBe('white');
		expect(status.reason).toBe('checkmate');
	});

	it('detects stalemate', () => {
		// Classic king + queen stalemate, black to move with no legal moves
		const game = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
		const status = getGameStatus(game);
		expect(status).toMatchObject({
			isOver: true,
			winner: 'draw',
			reason: 'stalemate',
			text: 'Draw — stalemate',
		});
	});

	it('detects insufficient material (king vs king)', () => {
		const game = new Chess('8/8/4k3/8/8/4K3/8/8 w - - 0 1');
		const status = getGameStatus(game);
		expect(status.isOver).toBe(true);
		expect(status.winner).toBe('draw');
		expect(status.reason).toBe('insufficient_material');
	});

	it('detects threefold repetition', () => {
		const game = new Chess();
		// Shuffle knights back and forth until the start position repeats 3x
		const shuffle = ['Nf3', 'Nf6', 'Ng1', 'Ng8'];
		for (let round = 0; round < 2; round++) {
			for (const move of shuffle) {
				game.move(move);
			}
		}
		const status = getGameStatus(game);
		expect(status.isOver).toBe(true);
		expect(status.winner).toBe('draw');
		expect(status.reason).toBe('threefold_repetition');
	});

	it('detects the fifty-move rule via the FEN half-move clock', () => {
		// Half-move clock at 100 = fifty full moves without pawn move or capture
		const game = new Chess('8/8/4k3/8/8/4K3/7R/8 w - - 100 80');
		const status = getGameStatus(game);
		expect(status.isOver).toBe(true);
		expect(status.winner).toBe('draw');
		expect(status.reason).toBe('fifty_move_rule');
	});
});
