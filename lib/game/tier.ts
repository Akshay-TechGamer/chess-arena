// Rating -> tier label for leaderboard chips. Pure logic.

export interface Tier {
	label: string;
	/** Rating floor for this tier. */
	min: number;
}

const TIERS: readonly Tier[] = [
	{ label: 'Grandmaster', min: 2400 },
	{ label: 'Master', min: 2200 },
	{ label: 'Expert', min: 2000 },
	{ label: 'Advanced', min: 1800 },
	{ label: 'Intermediate', min: 1600 },
	{ label: 'Improver', min: 1400 },
	{ label: 'Beginner', min: 0 },
];

export function tierFor(rating: number): string {
	return (TIERS.find((tier) => rating >= tier.min) ?? TIERS[TIERS.length - 1]).label;
}
