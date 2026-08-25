import { describe, expect, it } from 'vitest';
import { gradeMove, reviewText } from './moveReview';

describe('gradeMove', () => {
	it('marks the engine top move as best', () => {
		expect(gradeMove(40, true)).toBe('best');
	});

	it('grades by how much win% was dropped', () => {
		expect(gradeMove(0, false)).toBe('good');
		expect(gradeMove(3, false)).toBe('good');
		expect(gradeMove(8, false)).toBe('inaccuracy');
		expect(gradeMove(15, false)).toBe('mistake');
		expect(gradeMove(40, false)).toBe('blunder');
	});

	it('treats negative drops as good', () => {
		expect(gradeMove(-5, false)).toBe('good');
	});
});

describe('reviewText', () => {
	it('names the better move for mistakes and blunders', () => {
		expect(reviewText('mistake', 'Qh5', 'Nf3')).toContain('Nf3');
		expect(reviewText('blunder', 'Qh5', 'Nf3')).toContain('Nf3');
	});

	it('praises the played move when best', () => {
		expect(reviewText('best', 'Nf3', 'Nf3')).toContain('Nf3');
	});
});
