'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureProfile, ensureSignedIn } from '@/lib/data/authRepo';
import { createOnlineGame, findGameByInviteCode } from '@/lib/data/gamesRepo';
import { cancelQuickMatch, quickMatch } from '@/lib/data/matchmakingRepo';
import { subscribeToMyNewGames } from '@/lib/realtime/gameChannel';
import { generateInviteCode, isValidInviteCode, normalizeInviteCode } from '@/lib/game/invite';

export default function OnlineLobbyPage() {
	const router = useRouter();
	const [creating, setCreating] = useState(false);
	const [joinCode, setJoinCode] = useState('');
	const [joining, setJoining] = useState(false);
	const [searching, setSearching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const cleanupRef = useRef<(() => void) | null>(null);

	// Leave the queue if the user navigates away mid-search.
	useEffect(() => {
		return () => {
			cleanupRef.current?.();
			cleanupRef.current = null;
		};
	}, []);

	const startQuickMatch = async () => {
		setError(null);
		setSearching(true);
		try {
			const user = await ensureSignedIn();
			await ensureProfile(user);
			const immediate = await quickMatch();
			if (immediate) {
				router.push(`/game/${immediate}`);
				return;
			}
			// Enqueued: wait for someone to pair with us (we will be white).
			const unsubscribe = subscribeToMyNewGames(user.id, (pairedGameID) => {
				cleanupRef.current?.();
				cleanupRef.current = null;
				router.push(`/game/${pairedGameID}`);
			});
			// Poll as a fallback in case the realtime event is missed.
			const poll = setInterval(async () => {
				try {
					const paired = await quickMatch();
					if (paired) {
						cleanupRef.current?.();
						cleanupRef.current = null;
						router.push(`/game/${paired}`);
					}
				} catch {
					// keep polling
				}
			}, 5000);
			cleanupRef.current = () => {
				clearInterval(poll);
				unsubscribe();
				void cancelQuickMatch();
			};
		} catch (matchError) {
			setError(matchError instanceof Error ? matchError.message : 'Quick match failed');
			setSearching(false);
		}
	};

	const stopQuickMatch = () => {
		cleanupRef.current?.();
		cleanupRef.current = null;
		setSearching(false);
	};

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

			<h2 className="setup-label">Quick match</h2>
			<p className="game-subtitle">Pairs you with the next player who is searching.</p>
			{searching ? (
				<div className="button-row">
					<button type="button" className="btn btn-primary btn-start" disabled>
						Searching for opponent…
					</button>
					<button type="button" className="btn" onClick={stopQuickMatch}>
						Cancel
					</button>
				</div>
			) : (
				<button type="button" className="btn btn-primary btn-start" onClick={startQuickMatch}>
					⚡ Quick match
				</button>
			)}

			<h2 className="setup-label">Start a game with a friend</h2>
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
