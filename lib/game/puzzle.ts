// Lichess daily-puzzle helpers — pure logic (see AGENTS.md).
//
// The Lichess API gives us the game's SAN moves (game.pgn) plus the solution
// as UCI moves. The puzzle position is the game position where solution[0]
// is legal — usually after ALL pgn moves, but we fall back to dropping the
// last move to be robust against the API's off-by-one conventions.

import { Chess } from 'chess.js';
import type { EngineMove } from './uci';

export interface PuzzlePosition {
	fen: string;
	sideToMove: 'w' | 'b';
}

export function uciToMove(uci: string): EngineMove {
	const move: EngineMove = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
	if (uci.length > 4) {
		move.promotion = uci[4] as EngineMove['promotion'];
	}
	return move;
}

function isLegal(chess: Chess, move: EngineMove): boolean {
	return chess
		.moves({ verbose: true })
		.some(
			(candidate) =>
				candidate.from === move.from &&
				candidate.to === move.to &&
				(move.promotion == null || candidate.promotion === move.promotion),
		);
}

export function derivePuzzlePosition(pgnMoves: readonly string[], solutionUci: readonly string[]): PuzzlePosition {
	if (solutionUci.length === 0) {
		throw new Error('Puzzle has no solution moves');
	}
	const first = uciToMove(solutionUci[0]);

	const chess = new Chess();
	for (const san of pgnMoves) {
		chess.move(san);
	}
	if (isLegal(chess, first)) {
		return { fen: chess.fen(), sideToMove: chess.turn() };
	}

	// Fall back: position before the last game move
	chess.undo();
	if (isLegal(chess, first)) {
		return { fen: chess.fen(), sideToMove: chess.turn() };
	}
	throw new Error('Could not reconstruct puzzle position');
}

/** True when the played move matches the expected solution move. */
export function matchesSolution(played: EngineMove, expectedUci: string): boolean {
	const expected = uciToMove(expectedUci);
	return (
		played.from === expected.from &&
		played.to === expected.to &&
		(expected.promotion == null || played.promotion === expected.promotion)
	);
}
