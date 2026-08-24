'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureProfile, ensureSignedIn } from '@/lib/data/authRepo';
import { createOnlineGame, findGameByInviteCode } from '@/lib/data/gamesRepo';
import { generateInviteCode, isValidInviteCode, normalizeInviteCode } from '@/lib/game/invite';

export default function OnlineLobbyPage() {
	const router = useRouter();
	const [creating, setCreating] = useState(false);
	const [joinCode, setJoinCode] = useState('');
	const [joining, setJoining] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const createGame = async () => {
		setCreating(true);
		setError(null);
		try {
			const user = await ensureSignedIn();
			await ensureProfile(user);
			const gameRow = await createOnlineGame(user.id, generateInviteCode());
			router.push(`/game/${gameRow.id}`);
		} catch (createError) {
			setError(createError instanceof Error ? createError.message : 'Could not create game');
			setCreating(false);
		}
	};

	const joinByCode = async () => {
		const code = normalizeInviteCode(joinCode);
		if (!isValidInviteCode(code)) {
			setError('Invite codes are 6 letters/numbers, e.g. K3XT7M');
			return;
		}
		setJoining(true);
		setError(null);
		try {
			const gameRow = await findGameByInviteCode(code);
			if (!gameRow) {
				setError('No game found with that code.');
				setJoining(false);
				return;
			}
			router.push(`/game/${gameRow.id}`);
		} catch (joinError) {
			setError(joinError instanceof Error ? joinError.message : 'Could not join game');
			setJoining(false);
		}
	};

	return (
		<div className="setup">
			<h1 className="setup-title">Play online</h1>

			<h2 className="setup-label">Start a game</h2>
			<p className="game-subtitle">
				You get a link to send to your friend. Game starts when they open it.
			</p>
			<button
				type="button"
				className="btn btn-primary btn-start"
				onClick={createGame}
				disabled={creating}
			>
				{creating ? 'Creating…' : 'Create game & get invite link'}
			</button>

			<h2 className="setup-label">Or join with a code</h2>
			<div className="join-row">
				<input
					className="join-input"
					value={joinCode}
					onChange={(event) => setJoinCode(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							void joinByCode();
						}
					}}
					placeholder="K3XT7M"
					maxLength={6}
					autoCapitalize="characters"
				/>
				<button type="button" className="btn" onClick={joinByCode} disabled={joining}>
					{joining ? 'Joining…' : 'Join'}
				</button>
			</div>

			{error && <p className="form-error">⚠ {error}</p>}
		</div>
	);
}
