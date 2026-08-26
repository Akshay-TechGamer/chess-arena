'use client';

import { useEffect, useState } from 'react';
import { ensureSignedIn } from '@/lib/data/authRepo';
import { topProfiles, type LeaderboardRow } from '@/lib/data/profilesRepo';
import { tierFor } from '@/lib/game/tier';

const LEADERBOARD_SIZE = 25;

const RANK_CLASS = ['rank-gold', 'rank-silver', 'rank-bronze'];

export default function LeaderboardPage() {
	const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
	const [myID, setMyID] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		ensureSignedIn()
			.then((user) => setMyID(user.id))
			.catch(() => undefined);
		topProfiles(LEADERBOARD_SIZE)
			.then(setRows)
			.catch((loadError) =>
				setError(loadError instanceof Error ? loadError.message : 'Failed to load'),
			);
	}, []);

	if (error) {
		return <p className="page-note">⚠ {error}</p>;
	}
	if (!rows) {
		return <p className="page-note">Loading leaderboard…</p>;
	}

	return (
		<div className="lb">
			<h1 className="setup-title">Leaderboard</h1>
			<p className="game-subtitle">Global rankings for competitive play.</p>

			{rows.length === 0 ? (
				<p className="game-subtitle lb-empty">
					No rated games yet — finish an online game to appear here.
				</p>
			) : (
				<div className="lb-panel">
					<div className="lb-head">
						<span>#</span>
						<span>Player</span>
						<span className="lb-num">Rating</span>
						<span className="lb-num">Games</span>
					</div>
					{rows.map((row, index) => {
						const rank = index + 1;
						const isYou = row.id === myID;
						const rankClass = RANK_CLASS[index] ?? '';
						return (
							<div
								key={row.id}
								className={`lb-row ${rankClass}${isYou ? ' lb-you' : ''}`}
							>
								<span className={`rank-num rank-pos-${rank <= 3 ? rank : 'n'}`}>{rank}</span>
								<span className="lb-player">
									<span className="lb-avatar">{row.username.charAt(0).toUpperCase()}</span>
									<span className="lb-name">
										{row.username}
										{rank <= 6 && <span className="tier-chip">{tierFor(row.elo_rating)}</span>}
										{isYou && <span className="you-tag">you</span>}
									</span>
								</span>
								<span className={`lb-num lb-rating${rank <= 3 || isYou ? ' lb-rating-hot' : ''}`}>
									{row.elo_rating.toLocaleString()}
								</span>
								<span className="lb-num lb-games">{row.games_played.toLocaleString()}</span>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
