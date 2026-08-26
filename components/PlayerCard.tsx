'use client';

// A player strip shown above/below the board: avatar initial, name, an
// optional rating / turn line, and an optional clock. When it is this player's
// turn the card glows and the avatar shows a live dot (replaces the separate
// "to move" banner, especially on mobile).

import { formatClock } from '@/lib/game/clock';

interface PlayerCardProps {
	name: string;
	rating?: number | null;
	subtitle?: string;
	clockMs?: number | null;
	ticking?: boolean;
	you?: boolean;
	/** True when it is this player's turn — highlights the card + avatar dot. */
	active?: boolean;
	/** Shown in place of the rating when active, e.g. "White · your turn". */
	turnLabel?: string;
}

export function PlayerCard({
	name,
	rating,
	subtitle,
	clockMs,
	ticking,
	you,
	active,
	turnLabel,
}: PlayerCardProps) {
	const initial = name.trim().charAt(0).toUpperCase() || '?';
	const showTurn = active && turnLabel;
	const meta = showTurn ? turnLabel : rating != null ? `Rating ${rating}` : subtitle;
	const low = clockMs != null && clockMs < 30_000;
	return (
		<div className={`player-card${active ? ' player-card-active' : ''}`}>
			<div className="player-id">
				<span className={`player-avatar${you ? ' player-avatar-you' : ''}`}>
					{initial}
					{active && <span className="player-dot" aria-hidden="true" />}
				</span>
				<span className="player-meta">
					<span className="player-name">
						{name}
						{you && <span className="you-tag">you</span>}
					</span>
					{meta && (
						<span className={`player-sub${showTurn ? ' player-sub-turn' : ''}`}>{meta}</span>
					)}
				</span>
			</div>
			{clockMs != null && (
				<span className={`player-clock${ticking ? ' player-clock-ticking' : ''}${low ? ' player-clock-low' : ''}`}>
					{formatClock(clockMs)}
				</span>
			)}
		</div>
	);
}
