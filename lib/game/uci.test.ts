import { describe, expect, it } from 'vitest';
import { goCommand, parseBestMove, positionCommand, skillLevelCommand } from './uci';

describe('parseBestMove', () => {
	it('parses a plain best move', () => {
		expect(parseBestMove('bestmove e2e4')).toEqual({ from: 'e2', to: 'e4' });
	});

	it('parses a best move with ponder', () => {
		expect(parseBestMove('bestmove g8f6 ponder d2d4')).toEqual({ from: 'g8', to: 'f6' });
	});

	it('parses a promotion move', () => {
		expect(parseBestMove('bestmove e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
	});

	it('ignores surrounding whitespace', () => {
		expect(parseBestMove('  bestmove a7a5  ')).toEqual({ from: 'a7', to: 'a5' });
	});

	it('returns null for info lines', () => {
		expect(parseBestMove('info depth 10 score cp 34')).toBeNull();
	});

	it('returns null for bestmove (none)', () => {
		expect(parseBestMove('bestmove (none)')).toBeNull();
	});

	it('returns null for empty input', () => {
		expect(parseBestMove('')).toBeNull();
	});
});

describe('command builders', () => {
	it('builds a position command from a FEN', () => {
		const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
		expect(positionCommand(fen)).toBe(`position fen ${fen}`);
	});

	it('builds a go command with rounded move time', () => {
		expect(goCommand(700)).toBe('go movetime 700');
		expect(goCommand(699.6)).toBe('go movetime 700');
	});

	it('never emits a zero or negative move time', () => {
		expect(goCommand(0)).toBe('go movetime 1');
		expect(goCommand(-50)).toBe('go movetime 1');
	});

	it('clamps skill level into the 0-20 range', () => {
		expect(skillLevelCommand(9)).toBe('setoption name Skill Level value 9');
		expect(skillLevelCommand(-3)).toBe('setoption name Skill Level value 0');
		expect(skillLevelCommand(99)).toBe('setoption name Skill Level value 20');
	});
});
