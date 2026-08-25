'use client';

// A player strip shown above/below the board: avatar initial, name, an
// optional rating line, and an optional clock.

import { formatClock } from '@/lib/game/clock';

interface PlayerCardProps {
	name: string;
	rating?: number | null;
	subtitle?: string;
	clockMs?: number | null;
	ticking?: boolean;
	you?: boolean;
}

export function PlayerCard({ name, rating, subtitle, clockMs, ticking, you }: PlayerCardProps) {
	const initial = name.trim().charAt(0).toUpperCase() || '?';
	const meta = rating != null ? `Rating ${rating}` : subtitle;
	const low = clockMs != null && clockMs < 30_000;
	return (
		<div className="player-card">
			<div className="player-id">
				<span className={`player-avatar${you ? ' player-avatar-you' : ''}`}>{initial}</span>
				<span className="player-meta">
					<span className="player-name">
						{name}
						{you && <span className="you-tag">you</span>}
					</span>
					{meta && <span className="player-sub">{meta}</span>}
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
