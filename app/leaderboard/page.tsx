'use client';

import { useEffect, useState } from 'react';
import { topProfiles, type LeaderboardRow } from '@/lib/data/profilesRepo';

const LEADERBOARD_SIZE = 25;

export default function LeaderboardPage() {
	const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
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
		<div className="setup">
			<h1 className="setup-title">Leaderboard</h1>
			{rows.length === 0 ? (
				<p className="game-subtitle">No rated games yet — finish an online game to appear here.</p>
			) : (
				<table className="board-table">
					<thead>
						<tr>
							<th>#</th>
							<th>Player</th>
							<th>Rating</th>
							<th>Games</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row, index) => (
							<tr key={row.username}>
								<td>{index + 1}</td>
								<td>{row.username}</td>
								<td>{row.elo_rating}</td>
								<td>{row.games_played}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
