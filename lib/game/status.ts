// Derives a display-ready game status from a chess.js instance.
// Pure logic — no React, no Supabase (see AGENTS.md).

import type { Chess } from 'chess.js';

export type PlayerColor = 'white' | 'black';

export type GameOverReason =
	| 'checkmate'
	| 'stalemate'
	| 'insufficient_material'
	| 'threefold_repetition'
	| 'fifty_move_rule';

export interface GameStatus {
	isOver: boolean;
	/** 'white' | 'black' when someone won, 'draw' for draws, null while running. */
	winner: PlayerColor | 'draw' | null;
	reason: GameOverReason | null;
	turn: PlayerColor;
	inCheck: boolean;
	/** Human-readable one-liner, e.g. "Checkmate — White wins". */
	text: string;
}

export function getGameStatus(game: Chess): GameStatus {
	const turn: PlayerColor = game.turn() === 'w' ? 'white' : 'black';
	const inCheck = game.inCheck();

	if (game.isCheckmate()) {
		const winner: PlayerColor = turn === 'white' ? 'black' : 'white';
		return {
			isOver: true,
			winner,
			reason: 'checkmate',
			turn,
			inCheck,
			text: `Checkmate — ${capitalize(winner)} wins`,
		};
	}

	const drawReason = getDrawReason(game);
	if (drawReason) {
		return {
			isOver: true,
			winner: 'draw',
			reason: drawReason,
			turn,
			inCheck,
			text: `Draw — ${DRAW_REASON_TEXT[drawReason]}`,
		};
	}

	return {
		isOver: false,
		winner: null,
		reason: null,
		turn,
		inCheck,
		text: inCheck
			? `${capitalize(turn)} to move — check!`
			: `${capitalize(turn)} to move`,
	};
}

const DRAW_REASON_TEXT: Record<GameOverReason, string> = {
	checkmate: '', // never used for draws
	stalemate: 'stalemate',
	insufficient_material: 'insufficient material',
	threefold_repetition: 'threefold repetition',
	fifty_move_rule: 'fifty-move rule',
};

function getDrawReason(game: Chess): GameOverReason | null {
	if (game.isStalemate()) {
		return 'stalemate';
	}
	if (game.isInsufficientMaterial()) {
		return 'insufficient_material';
	}
	if (game.isThreefoldRepetition()) {
		return 'threefold_repetition';
	}
	if (game.isDraw()) {
		// chess.js isDraw() covers the 50-move rule once the cases above are excluded
		return 'fifty_move_rule';
	}
	return null;
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
