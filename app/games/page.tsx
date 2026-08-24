'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ensureProfile, ensureSignedIn, getUsernames } from '@/lib/data/authRepo';
import { listMyGames, type GameRow } from '@/lib/data/gamesRepo';

const HISTORY_SIZE = 50;

const RESULT_BADGE: Record<string, string> = {
	white_win: '1 – 0',
	black_win: '0 – 1',
	draw: '½ – ½',
};

export default function MyGamesPage() {
	const [games, setGames] = useState<GameRow[] | null>(null);
	const [names, setNames] = useState<Record<string, string>>({});
	const [myID, setMyID] = useState('');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const user = await ensureSignedIn();
				await ensureProfile(user);
				const rows = await listMyGames(user.id, HISTORY_SIZE);
				const ids = new Set<string>();
				for (const row of rows) {
					if (row.white_id) {
						ids.add(row.white_id);
					}
					if (row.black_id) {
						ids.add(row.black_id);
					}
				}
				setNames(await getUsernames([...ids]));
				setMyID(user.id);
				setGames(rows);
			} catch (loadError) {
				setError(loadError instanceof Error ? loadError.message : 'Failed to load');
			}
		})();
	}, []);

	if (error) {
		return <p className="page-note">⚠ {error}</p>;
	}
	if (!games) {
		return <p className="page-note">Loading your games…</p>;
	}

	return (
		<div className="setup">
			<h1 className="setup-title">My games</h1>
			{games.length === 0 ? (
				<p className="game-subtitle">
					No games yet — <Link href="/play/online">play one</Link>!
				</p>
			) : (
				<table className="board-table">
					<thead>
						<tr>
							<th>Opponent</th>
							<th>Color</th>
							<th>Result</th>
							<th>Status</th>
							<th>Date</th>
						</tr>
					</thead>
					<tbody>
						{games.map((row) => {
							const iAmWhite = row.white_id === myID;
							const opponentID = iAmWhite ? row.black_id : row.white_id;
							const opponent = names[opponentID ?? ''] ?? (row.mode === 'computer' ? 'Computer' : '—');
							return (
								<tr key={row.id}>
									<td>
										<Link href={`/game/${row.id}`}>{opponent}</Link>
									</td>
									<td>{iAmWhite ? '♔ White' : '♚ Black'}</td>
									<td>{RESULT_BADGE[row.result ?? ''] ?? '—'}</td>
									<td>{row.status}</td>
									<td>{new Date(row.created_at).toLocaleDateString()}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
		</div>
	);
}
