// Difficulty levels for the vs-computer mode.
// Pure data + lookups — no React, no Supabase, no browser APIs (see AGENTS.md).

export type EngineLevelID = 'beginner' | 'easy' | 'medium' | 'hard' | 'max';

export interface EngineLevel {
	id: EngineLevelID;
	label: string;
	/** Stockfish "Skill Level" UCI option, 0 (weakest) to 20 (full strength). */
	skill: number;
	/** Thinking time per move, in milliseconds. */
	moveTimeMs: number;
	/** Rough playing strength, for display only. */
	approxElo: number;
	description: string;
}

export const ENGINE_LEVELS: readonly EngineLevel[] = [
	{
		id: 'beginner',
		label: 'Beginner',
		skill: 0,
		moveTimeMs: 250,
		approxElo: 600,
		description: 'Blunders often. Good for learning the moves.',
	},
	{
		id: 'easy',
		label: 'Easy',
		skill: 4,
		moveTimeMs: 400,
		approxElo: 1000,
		description: 'Casual play. Punishes big mistakes only.',
	},
	{
		id: 'medium',
		label: 'Medium',
		skill: 9,
		moveTimeMs: 700,
		approxElo: 1500,
		description: 'Solid club player. A real fight.',
	},
	{
		id: 'hard',
		label: 'Hard',
		skill: 14,
		moveTimeMs: 1000,
		approxElo: 2000,
		description: 'Strong tournament player. Expect punishment.',
	},
	{
		id: 'max',
		label: 'Maximum',
		skill: 20,
		moveTimeMs: 1500,
		approxElo: 2800,
		description: 'Full engine strength. Good luck.',
	},
];

export function isEngineLevelID(value: string): value is EngineLevelID {
	return ENGINE_LEVELS.some((level) => level.id === value);
}

export function getEngineLevel(id: EngineLevelID): EngineLevel {
	const level = ENGINE_LEVELS.find((candidate) => candidate.id === id);
	if (!level) {
		throw new Error(`Unknown engine level: ${id}`);
	}
	return level;
}
