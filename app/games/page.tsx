'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ensureProfile, ensureSignedIn, getUsernames } from '@/lib/data/authRepo';
import { listMyGames, type GameRow } from '@/lib/data/gamesRepo';

const HISTORY_SIZE = 50;

const SCORE: Record<string, string> = {
	white_win: '1 – 0',
	black_win: '0 – 1',
	draw: '½ – ½',
};

type Outcome = 'win' | 'loss' | 'draw';
type Filter = 'all' | 'win' | 'loss';

const FILTERS: { id: Filter; label: string }[] = [
	{ id: 'all', label: 'All' },
	{ id: 'win', label: 'Wins' },
	{ id: 'loss', label: 'Losses' },
];

export default function MyGamesPage() {
	const router = useRouter();
	const [games, setGames] = useState<GameRow[] | null>(null);
	const [names, setNames] = useState<Record<string, string>>({});
	const [myID, setMyID] = useState('');
	const [filter, setFilter] = useState<Filter>('all');
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

	const outcomeOf = (row: GameRow): Outcome | null => {
		if (!row.result) {
			return null;
		}
		if (row.result === 'draw') {
			return 'draw';
		}
		const iAmWhite = row.white_id === myID;
		const whiteWon = row.result === 'white_win';
		return whiteWon === iAmWhite ? 'win' : 'loss';
	};

	const filtered = useMemo(() => {
		if (!games) {
			return [];
		}
		if (filter === 'all') {
			return games;
		}
		return games.filter((row) => outcomeOf(row) === filter);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [games, filter, myID]);

	if (error) {
		return <p className="page-note">⚠ {error}</p>;
	}
	if (!games) {
		return <p className="page-note">Loading your games…</p>;
	}

	return (
		<div className="mg">
			<div className="mg-header">
				<div>
					<h1 className="setup-title">My Games</h1>
					<p className="game-subtitle">Review your recent matches and analyze performance.</p>
				</div>
				<div className="mg-filter">
					{FILTERS.map((f) => (
						<button
							key={f.id}
							type="button"
							className={`chip${filter === f.id ? ' chip-on' : ''}`}
							onClick={() => setFilter(f.id)}
						>
							{f.label}
						</button>
					))}
				</div>
			</div>

			{filtered.length === 0 ? (
				<p className="game-subtitle mg-empty">
					{games.length === 0 ? (
						<>
							No games yet — <Link href="/play/online">play one</Link>!
						</>
					) : (
						'No games match this filter.'
					)}
				</p>
			) : (
				<div className="mg-list">
					{filtered.map((row) => {
						const iAmWhite = row.white_id === myID;
						const opponentID = iAmWhite ? row.black_id : row.white_id;
						const opponent =
							names[opponentID ?? ''] ?? (row.mode === 'computer' ? 'Computer' : '—');
						const outcome = outcomeOf(row);
						const score = SCORE[row.result ?? ''] ?? '—';
						const finished = row.status === 'finished';
						return (
							<div className={`mg-card${outcome ? ` mg-${outcome}` : ''}`} key={row.id}>
								<div className="mg-top">
									<span className="mg-color">
										<span className={`mg-dot mg-dot-${iAmWhite ? 'w' : 'b'}`} />
										{iAmWhite ? 'White' : 'Black'}
									</span>
									<span className="mg-date">{new Date(row.created_at).toLocaleDateString()}</span>
								</div>
								<div className="mg-mid">
									<div className="mg-block">
										<span className="mg-label">Opponent</span>
										<Link href={`/game/${row.id}`} className="mg-name">
											{opponent}
										</Link>
									</div>
									<div className="mg-block mg-block-right">
										<span className="mg-label">Result</span>
										<span className="mg-result">
											<span className="mg-score">{score}</span>
											{outcome ? (
												<span className={`mg-chip mg-chip-${outcome}`}>
													{outcome === 'win' ? 'WIN' : outcome === 'loss' ? 'LOSS' : 'DRAW'}
												</span>
											) : (
												<span className="mg-chip mg-chip-live">{row.status}</span>
											)}
										</span>
									</div>
								</div>
								<div className="mg-actions">
									{finished ? (
										<button
											type="button"
											className="btn btn-primary mg-analyze"
											onClick={() => router.push(`/analyze/${row.id}`)}
										>
											🔍 Analyze
										</button>
									) : (
										<button
											type="button"
											className="btn mg-analyze"
											onClick={() => router.push(`/game/${row.id}`)}
										>
											Open game
										</button>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
