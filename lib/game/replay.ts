// Rebuilds a chess.js game from stored SAN moves — pure logic (see AGENTS.md).

import { Chess } from 'chess.js';

/**
 * Replays SAN moves from the start position into a fresh Chess instance.
 * Throws if the stored history is corrupt (an illegal move), because playing
 * on from a broken position would corrupt the game further.
 */
export function buildGameFromSans(sans: readonly string[]): Chess {
	const game = new Chess();
	for (const san of sans) {
		try {
			game.move(san);
		} catch {
			throw new Error(`Stored game history is corrupt at move "${san}"`);
		}
	}
	return game;
}
