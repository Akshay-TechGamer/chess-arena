// Grading a played move from how much winning % it gave up — pure logic.

export type MoveGrade = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export const GRADE_LABEL: Record<MoveGrade, string> = {
	best: 'Best move',
	good: 'Good move',
	inaccuracy: 'Inaccuracy',
	mistake: 'Mistake',
	blunder: 'Blunder',
};

/** dropPercent = the mover's win% before minus after (0-100). */
export function gradeMove(dropPercent: number, playedIsBest: boolean): MoveGrade {
	if (playedIsBest) {
		return 'best';
	}
	const drop = Math.max(0, dropPercent);
	if (drop >= 25) {
		return 'blunder';
	}
	if (drop >= 12) {
		return 'mistake';
	}
	if (drop >= 6) {
		return 'inaccuracy';
	}
	return 'good';
}

export function reviewText(grade: MoveGrade, playedSan: string, bestSan: string): string {
	switch (grade) {
		case 'best':
			return `${playedSan} was the top choice — well spotted.`;
		case 'good':
			return `${playedSan} keeps things on track.`;
		case 'inaccuracy':
			return `${bestSan} would have been a touch better.`;
		case 'mistake':
			return `${bestSan} was stronger here.`;
		case 'blunder':
			return `${bestSan} was much stronger — this gave up a big edge.`;
	}
}
