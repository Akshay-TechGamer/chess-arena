'use client';

// Online multiplayer board. Loads the game, joins if invited, syncs moves
// over Realtime, and survives refresh (state rebuilt from chess_moves).
// Also carries the in-game chat and rematch flow over channel broadcasts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { DARK_SQUARE_STYLE, LIGHT_SQUARE_STYLE } from '@/lib/game/boardTheme';
import { useGameAccuracy } from '@/lib/engine/accuracyAnalysis';
import {
	ensureProfile,
	ensureSignedIn,
	getMyRating,
	getPlayerInfos,
	type PlayerInfo,
} from '@/lib/data/authRepo';
import {
	acceptDraw,
	claimTimeout,
	clearDraw,
	createRematchGame,
	getGame,
	joinGame,
	listMoves,
	offerDraw,
	playMove,
	resignGame,
	type GameRow,
	type MoveRow,
} from '@/lib/data/gamesRepo';
import {
	subscribeToGame,
	type ChatMessage,
	type GameChannelHandle,
	type RematchSignal,
} from '@/lib/realtime/gameChannel';
import { getGameStatus, type PlayerColor } from '@/lib/game/status';
import { UNLIMITED_TIME, liveClocks, type ClockSnapshot } from '@/lib/game/clock';
import { MoveList } from '@/components/MoveList';
import { PromotionDialog } from '@/components/PromotionDialog';
import { PlayerCard } from '@/components/PlayerCard';
import { GameOverOverlay, type Outcome } from '@/components/GameOverOverlay';

interface StoredClocks extends ClockSnapshot {
	/** Wall-clock ms when this snapshot was taken (last move / activation). */
	at: number;
}

type Phase = 'loading' | 'error' | 'ready';

interface PendingPromotion {
	from: Square;
	to: Square;
}

const RESULT_TEXT: Record<string, string> = {
	white_win: 'White wins',
	black_win: 'Black wins',
	draw: 'Draw',
};

export function OnlineGameBoard({ gameID }: { gameID: string }) {
	const router = useRouter();
	const [game] = useState(() => new Chess());
	const [fen, setFen] = useState(() => game.fen());
	const [phase, setPhase] = useState<Phase>('loading');
	const [errorMsg, setErrorMsg] = useState('');
	const [gameRow, setGameRow] = useState<GameRow | null>(null);
	const [myID, setMyID] = useState<string | null>(null);
	const [myUsername, setMyUsername] = useState('');
	const [infos, setInfos] = useState<Record<string, PlayerInfo>>({});
	const [selected, setSelected] = useState<Square | null>(null);
	const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
	const [presenceCount, setPresenceCount] = useState(1);
	const [busy, setBusy] = useState(false);
	const [banner, setBanner] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [chatInput, setChatInput] = useState('');
	const [incomingRematch, setIncomingRematch] = useState(false);
	const [rematchSent, setRematchSent] = useState(false);
	const [overlayClosed, setOverlayClosed] = useState(false);
	const [eloDelta, setEloDelta] = useState<number | null>(null);
	const ratingBeforeRef = useRef<number | null>(null);
	const [turnToast, setTurnToast] = useState<{ side: string; id: number } | null>(null);
	const toastTimerRef = useRef<number | null>(null);
	const chatBoxRef = useRef<HTMLDivElement>(null);

	const gameRowRef = useRef<GameRow | null>(null);
	gameRowRef.current = gameRow;
	const channelRef = useRef<GameChannelHandle | null>(null);
	const clocksRef = useRef<StoredClocks | null>(null);
	const timeoutClaimedRef = useRef(false);
	const [, setClockTick] = useState(0);

	const timed = (gameRow?.time_control_secs ?? UNLIMITED_TIME) !== UNLIMITED_TIME;

	// Accuracy analysis once the game is finished (top-level hook — must run
	// before any early return).
	const isFinishedTop = gameRow?.status === 'finished';
	const gameFens = useMemo(() => {
		if (!isFinishedTop) {
			return null;
		}
		const replay = new Chess();
		const list = [replay.fen()];
		for (const san of game.history()) {
			replay.move(san);
			list.push(replay.fen());
		}
		return list;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isFinishedTop, fen]);
	const accuracy = useGameAccuracy(gameFens, isFinishedTop && !overlayClosed);

	// Once the game finishes, the Elo trigger has run — fetch my new rating and
	// show the delta (only if we captured a "before" this session).
	useEffect(() => {
		if (!isFinishedTop || !myID || ratingBeforeRef.current === null) {
			return;
		}
		let cancelled = false;
		getMyRating(myID).then((after) => {
			if (!cancelled && after !== null && ratingBeforeRef.current !== null) {
				setEloDelta(after - ratingBeforeRef.current);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [isFinishedTop, myID]);

	const myColor: PlayerColor | null =
		myID && gameRow
			? myID === gameRow.white_id
				? 'white'
				: myID === gameRow.black_id
					? 'black'
					: null
			: null;

	const localStatus = getGameStatus(game);
	const isMyTurn =
		gameRow?.status === 'active' &&
		myColor !== null &&
		!busy &&
		!localStatus.isOver &&
		game.turn() === (myColor === 'white' ? 'w' : 'b');

	const resyncMoves = useCallback(async () => {
		const moves = await listMoves(gameID);
		game.reset();
		for (const move of moves) {
			game.move(move.san);
		}
		setFen(game.fen());
	}, [game, gameID]);

	// Initial load: sign in, load game, auto-join if invited, replay moves.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const user = await ensureSignedIn();
				const profile = await ensureProfile(user);
				let row = await getGame(gameID);
				if (!row) {
					throw new Error('Game not found — check the link.');
				}
				// Capture my rating before the result lands, for the Elo delta.
				if (row.status !== 'finished') {
					ratingBeforeRef.current = profile.elo_rating;
				}
				if (row.status === 'waiting' && !row.black_id && row.white_id !== user.id) {
					row = await joinGame(gameID, user.id);
				}
				const moves = await listMoves(gameID);
				if (cancelled) {
					return;
				}
				game.reset();
				for (const move of moves) {
					game.move(move.san);
				}
				const lastStored = moves[moves.length - 1];
				clocksRef.current = lastStored
					? {
							whiteMs: lastStored.white_ms_left,
							blackMs: lastStored.black_ms_left,
							at: Date.parse(lastStored.created_at),
						}
					: {
							whiteMs: row.time_control_secs * 1000,
							blackMs: row.time_control_secs * 1000,
							at: Date.parse(row.updated_at),
						};
				setFen(game.fen());
				setGameRow(row);
				setMyID(user.id);
				setMyUsername(profile.username);
				setPhase('ready');
				getPlayerInfos([row.white_id ?? '', row.black_id ?? '']).then((fetched) => {
					if (!cancelled) {
						setInfos(fetched);
					}
				});
			} catch (loadError) {
				if (!cancelled) {
					setErrorMsg(loadError instanceof Error ? loadError.message : 'Failed to load game');
					setPhase('error');
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [game, gameID]);

	// Realtime subscription: moves, game updates, presence, chat, rematch.
	useEffect(() => {
		if (!myID) {
			return;
		}
		const handle = subscribeToGame(gameID, myID, {
			onMove: (move: MoveRow) => {
				const played = game.history().length;
				if (move.ply === played + 1) {
					try {
						game.move(move.san);
						setFen(game.fen());
					} catch {
						void resyncMoves();
					}
				} else if (move.ply > played + 1) {
					void resyncMoves();
				}
				// move.ply <= played: our own move echoing back — clocks still
				// benefit from the server timestamp below
				if (move.ply === game.history().length) {
					clocksRef.current = {
						whiteMs: move.white_ms_left,
						blackMs: move.black_ms_left,
						at: Date.parse(move.created_at),
					};
				}
			},
			onGameUpdate: (row: GameRow) => {
				// Game just went active with no moves: start both clocks now.
				if (row.status === 'active' && game.history().length === 0) {
					clocksRef.current = {
						whiteMs: row.time_control_secs * 1000,
						blackMs: row.time_control_secs * 1000,
						at: Date.parse(row.updated_at),
					};
				}
				setGameRow(row);
				if (row.black_id && !infos[row.black_id]) {
					getPlayerInfos([row.black_id]).then((fetched) =>
						setInfos((prev) => ({ ...prev, ...fetched })),
					);
				}
			},
			onPresenceChange: (count) => {
				setPresenceCount(count);
				// Fallback for the waiting→active transition: the joiner's presence
				// proves the game changed even if the UPDATE event was missed
				// (cold channel, throttled background tab).
				if (count >= 2 && gameRowRef.current?.status === 'waiting') {
					getGame(gameID).then((fresh) => {
						if (fresh) {
							setGameRow(fresh);
						}
					});
				}
			},
			onChat: (message) => setChatMessages((prev) => [...prev.slice(-49), message]),
			onRematch: (signal: RematchSignal) => {
				if (signal.from === myID) {
					return;
				}
				if (signal.kind === 'offer') {
					setIncomingRematch(true);
				} else if (signal.kind === 'start' && signal.gameID) {
					router.push(`/game/${signal.gameID}`);
				}
			},
		});
		channelRef.current = handle;
		return () => {
			channelRef.current = null;
			handle.unsubscribe();
		};
		// names intentionally omitted: subscription must not restart on name loads
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [gameID, myID, game, resyncMoves, router]);

	const submitMove = useCallback(
		(from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
			if (!isMyTurn) {
				return false;
			}
			// Optimistic local apply; the server (play-move function) is the
			// authority — it validates legality, computes clocks server-side,
			// and finishes the game. Its move INSERT echoes back over realtime.
			try {
				game.move({ from, to, promotion });
			} catch {
				return false;
			}
			setFen(game.fen());
			setSelected(null);
			setBusy(true);
			setBanner(null);
			(async () => {
				try {
					await playMove(gameID, from, to, promotion);
				} catch (moveError) {
					game.undo();
					setFen(game.fen());
					setBanner(
						moveError instanceof Error ? moveError.message : 'Move did not reach the server.',
					);
				} finally {
					setBusy(false);
				}
			})();
			return true;
		},
		[game, gameID, isMyTurn],
	);

	// Clock tick + flag-fall claim (either player may claim the timeout).
	useEffect(() => {
		if (!timed || gameRow?.status !== 'active') {
			return;
		}
		const interval = setInterval(() => {
			setClockTick((tick) => tick + 1);
			const row = gameRowRef.current;
			const stored = clocksRef.current;
			if (!row || row.status !== 'active' || !stored || timeoutClaimedRef.current || !myColor) {
				return;
			}
			const live = liveClocks(stored, game.turn(), stored.at, Date.now());
			const flagged = game.turn() === 'w' ? live.whiteMs <= 0 : live.blackMs <= 0;
			if (flagged) {
				timeoutClaimedRef.current = true;
				// server re-verifies from stored clocks; no-op if time remains
				claimTimeout(gameID).catch(() => {
					timeoutClaimedRef.current = false;
				});
			}
		}, 300);
		return () => clearInterval(interval);
	}, [timed, gameRow?.status, game, gameID, myColor]);

	// Pop a live "whose turn" toast whenever the side to move changes.
	useEffect(() => {
		if (gameRow?.status !== 'active') {
			setTurnToast(null);
			return;
		}
		const side = game.turn() === 'w' ? 'White' : 'Black';
		setTurnToast((prev) => ({ side, id: (prev ? prev.id : 0) + 1 }));
		if (toastTimerRef.current) {
			window.clearTimeout(toastTimerRef.current);
		}
		toastTimerRef.current = window.setTimeout(() => setTurnToast(null), 2200);
		return () => {
			if (toastTimerRef.current) {
				window.clearTimeout(toastTimerRef.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fen, gameRow?.status]);

	const scrollToChat = useCallback(() => {
		chatBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}, []);

	const isPromotionMove = useCallback(
		(from: Square, to: Square): boolean => {
			const candidate = game
				.moves({ square: from, verbose: true })
				.find((move) => move.to === to);
			return Boolean(candidate && candidate.flags.includes('p'));
		},
		[game],
	);

	const tryHumanMove = useCallback(
		(from: Square, to: Square): boolean => {
			if (!isMyTurn || pendingPromotion) {
				return false;
			}
			if (isPromotionMove(from, to)) {
				setPendingPromotion({ from, to });
				return false;
			}
			return submitMove(from, to);
		},
		[isMyTurn, pendingPromotion, isPromotionMove, submitMove],
	);

	const resign = useCallback(() => {
		if (!myColor || !gameRow || gameRow.status !== 'active') {
			return;
		}
		if (!window.confirm('Resign this game?')) {
			return;
		}
		resignGame(gameID).catch(() => setBanner('Could not resign — try again.'));
	}, [myColor, gameRow, gameID]);

	const onOfferDraw = useCallback(() => {
		offerDraw(gameID).catch(() => setBanner('Could not offer a draw.'));
	}, [gameID]);
	const onAcceptDraw = useCallback(() => {
		acceptDraw(gameID).catch(() => setBanner('Could not accept the draw.'));
	}, [gameID]);
	const onDeclineDraw = useCallback(() => {
		clearDraw(gameID).catch(() => undefined);
	}, [gameID]);

	const copyInviteLink = useCallback(() => {
		const link = `${window.location.origin}/game/${gameID}`;
		navigator.clipboard.writeText(link).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}, [gameID]);

	const sendChat = useCallback(() => {
		const text = chatInput.trim().slice(0, 200);
		if (!text || !myID) {
			return;
		}
		const message: ChatMessage = { from: myID, username: myUsername, text };
		channelRef.current?.sendChat(message);
		setChatMessages((prev) => [...prev.slice(-49), message]);
		setChatInput('');
	}, [chatInput, myID, myUsername]);

	const offerRematch = useCallback(() => {
		if (!myID) {
			return;
		}
		channelRef.current?.sendRematch({ kind: 'offer', from: myID });
		setRematchSent(true);
	}, [myID]);

	const acceptRematch = useCallback(async () => {
		if (!myID || !gameRow?.white_id || !gameRow.black_id) {
			return;
		}
		try {
			// colors swap for the rematch
			const next = await createRematchGame(gameRow.black_id, gameRow.white_id);
			channelRef.current?.sendRematch({ kind: 'start', from: myID, gameID: next.id });
			router.push(`/game/${next.id}`);
		} catch {
			setBanner('Could not start rematch.');
		}
	}, [myID, gameRow, router]);

	if (phase === 'loading') {
		return <p className="page-note">Loading game…</p>;
	}
	if (phase === 'error' || !gameRow) {
		return <p className="page-note">⚠ {errorMsg}</p>;
	}

	// Waiting room: creator sees the invite code until the opponent joins.
	if (gameRow.status === 'waiting') {
		return (
			<div className="invite-panel">
				<h1 className="setup-title">Waiting for opponent…</h1>
				<p className="game-subtitle">Share this link — the game starts as soon as they open it.</p>
				<p className="game-subtitle">
					Time control:{' '}
					{gameRow.time_control_secs === UNLIMITED_TIME
						? 'no clock'
						: `${Math.round(gameRow.time_control_secs / 60)} min`}
				</p>
				<div className="invite-code">{gameRow.invite_code}</div>
				<button type="button" className="btn btn-primary" onClick={copyInviteLink}>
					{copied ? '✓ Copied!' : 'Copy invite link'}
				</button>
			</div>
		);
	}

	const whiteName = infos[gameRow.white_id ?? '']?.username ?? 'White';
	const blackName = infos[gameRow.black_id ?? '']?.username ?? 'Black';
	const ratingFor = (color: PlayerColor) =>
		infos[(color === 'white' ? gameRow.white_id : gameRow.black_id) ?? '']?.elo_rating ?? null;
	const opponentOnline = presenceCount >= 2;
	const finished = gameRow.status === 'finished';

	// Outcome from my seat's perspective (for the end-of-game overlay).
	const myOutcome: Outcome =
		myColor === null
			? 'spectator'
			: gameRow.result === 'draw'
				? 'draw'
				: gameRow.result === 'white_win'
					? myColor === 'white'
						? 'win'
						: 'loss'
					: myColor === 'black'
						? 'win'
						: 'loss';

	const statusText = finished
		? `${RESULT_TEXT[gameRow.result ?? ''] ?? 'Game over'} — ${(gameRow.result_reason ?? '').replace(/_/g, ' ')}`
		: busy
			? 'Sending move…'
			: localStatus.text;

	const legalTargets = selected
		? game.moves({ square: selected, verbose: true }).map((move) => move.to)
		: [];
	const lastMove = game.history({ verbose: true }).slice(-1)[0];
	const squareStyles: Record<string, React.CSSProperties> = {};
	if (lastMove) {
		squareStyles[lastMove.from] = { backgroundColor: 'rgba(155, 199, 0, 0.28)' };
		squareStyles[lastMove.to] = { backgroundColor: 'rgba(155, 199, 0, 0.38)' };
	}
	if (selected) {
		squareStyles[selected] = { backgroundColor: 'rgba(20, 85, 30, 0.5)' };
	}
	for (const target of legalTargets) {
		squareStyles[target] = {
			...squareStyles[target],
			backgroundImage: 'radial-gradient(circle, rgba(20, 85, 30, 0.55) 22%, transparent 25%)',
		};
	}

	const boardOptions = {
		id: 'chess-arena-online-board',
			lightSquareStyle: LIGHT_SQUARE_STYLE,
			darkSquareStyle: DARK_SQUARE_STYLE,
		position: fen,
		boardOrientation: myColor ?? ('white' as const),
		animationDurationInMs: 200,
		allowDragging: isMyTurn,
		squareStyles,
		canDragPiece: ({ piece }: { piece: { pieceType: string } }) =>
			isMyTurn && piece.pieceType.startsWith(game.turn()),
		onPieceDrop: ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
			if (!targetSquare) {
				return false;
			}
			return tryHumanMove(sourceSquare as Square, targetSquare as Square);
		},
		onSquareClick: ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
			if (pendingPromotion || !isMyTurn) {
				return;
			}
			if (selected && legalTargets.includes(square as Square)) {
				tryHumanMove(selected, square as Square);
				return;
			}
			if (piece && piece.pieceType.startsWith(game.turn())) {
				setSelected(square as Square);
			} else {
				setSelected(null);
			}
		},
	};

	const displayClocks =
		timed && clocksRef.current
			? gameRow.status === 'active'
				? liveClocks(clocksRef.current, game.turn(), clocksRef.current.at, Date.now())
				: { whiteMs: clocksRef.current.whiteMs, blackMs: clocksRef.current.blackMs }
			: null;
	const bottomColor: PlayerColor = myColor ?? 'white';
	const topColor: PlayerColor = bottomColor === 'white' ? 'black' : 'white';
	const clockFor = (color: PlayerColor) =>
		displayClocks === null ? null : color === 'white' ? displayClocks.whiteMs : displayClocks.blackMs;
	const nameFor = (color: PlayerColor) => (color === 'white' ? whiteName : blackName);
	const playerCard = (color: PlayerColor) => {
		const ms = clockFor(color);
		const ticking =
			gameRow.status === 'active' && game.turn() === (color === 'white' ? 'w' : 'b');
		return (
			<PlayerCard
				name={nameFor(color)}
				rating={ratingFor(color)}
				clockMs={ms}
				ticking={ticking}
				you={myColor === color}
			/>
		);
	};

	return (
		<>
		{turnToast && !finished && (
			<div className="turn-toast" key={turnToast.id} role="status">
				<span className="turn-dot" aria-hidden="true" />
				{turnToast.side}&rsquo;s turn
			</div>
		)}
		<div className="game-layout">
			<div className="board-column">
				{playerCard(topColor)}
				<div className="board-wrap">
					<Chessboard options={boardOptions} />
					{pendingPromotion && (
						<PromotionDialog
							onPick={(piece) => {
								submitMove(pendingPromotion.from, pendingPromotion.to, piece);
								setPendingPromotion(null);
							}}
						/>
					)}
				</div>
				{playerCard(bottomColor)}
			</div>
			<aside className="sidebar">
				<p className="game-subtitle">
					{whiteName} (white) vs {blackName} (black)
					{myColor === null && ' — spectating'}
				</p>
				{gameRow.status === 'active' && myColor !== null && (
					<p className={`presence ${opponentOnline ? 'presence-on' : 'presence-off'}`}>
						● Opponent {opponentOnline ? 'online' : 'offline'}
					</p>
				)}
				<div className={`status-banner${finished ? ' status-over' : ''}`}>
					<span className="status-left">
						{!finished && <span className="turn-live-dot" aria-hidden="true" />}
						{banner ?? statusText}
					</span>
					{!finished && (
						<svg
							className="status-clock"
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="9" />
							<path d="M12 7v5l3 2" />
						</svg>
					)}
				</div>
				{finished && (
					<div className="button-row">
						{myColor !== null &&
							(incomingRematch ? (
								<button type="button" className="btn btn-primary" onClick={acceptRematch}>
									✓ Accept rematch
								</button>
							) : (
								<button type="button" className="btn" onClick={offerRematch} disabled={rematchSent}>
									{rematchSent ? 'Rematch offered…' : 'Offer rematch'}
								</button>
							))}
						<button
							type="button"
							className="btn"
							onClick={() => router.push(`/analyze/${gameID}`)}
						>
							🔍 Analyze
						</button>
					</div>
				)}
				<section className="mh-panel">
					<h3 className="mh-title">Move History</h3>
					<MoveList moves={game.history()} />
				</section>
				{gameRow.status === 'active' && myColor !== null && (
					<>
						{gameRow.draw_offered_by && gameRow.draw_offered_by !== myID ? (
							<div className="draw-offer">
								<span>Opponent offers a draw</span>
								<div className="button-row">
									<button type="button" className="btn btn-primary" onClick={onAcceptDraw}>
										Accept draw
									</button>
									<button type="button" className="btn" onClick={onDeclineDraw}>
										Decline
									</button>
								</div>
							</div>
						) : (
							<>
								<div className="button-row game-actions">
									<button
										type="button"
										className="btn"
										onClick={onOfferDraw}
										disabled={gameRow.draw_offered_by === myID}
									>
										{gameRow.draw_offered_by === myID ? 'Draw offered…' : '½ Offer draw'}
									</button>
									<button type="button" className="btn" onClick={resign}>
										🏳 Resign
									</button>
								</div>
								<div className="mobile-controls">
									<button
										type="button"
										className="mc-btn mc-danger"
										onClick={resign}
										aria-label="Resign"
									>
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z" />
											<line x1="4" y1="22" x2="4" y2="15" />
										</svg>
										<span>Resign</span>
									</button>
									<button
										type="button"
										className="mc-btn"
										onClick={onOfferDraw}
										disabled={gameRow.draw_offered_by === myID}
										aria-label="Offer draw"
									>
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<path d="m11 17 2 2a1 1 0 1 0 3-3" />
											<path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
											<path d="m21 3 1 11h-2" />
											<path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
											<path d="M3 4h8" />
										</svg>
										<span>{gameRow.draw_offered_by === myID ? 'Offered' : 'Draw'}</span>
									</button>
									<button
										type="button"
										className="mc-btn"
										onClick={scrollToChat}
										aria-label="Go to chat"
									>
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
											<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
										</svg>
										<span>Chat</span>
									</button>
								</div>
							</>
						)}
					</>
				)}
				{myColor !== null && (
					<div className="chat-box" ref={chatBoxRef}>
						<div className="chat-head">
							<h3 className="chat-title">Live Chat</h3>
							<span className="chat-live-dot" aria-hidden="true" />
						</div>
						<div className="chat-messages">
							<div className="chat-msg chat-msg-system">
								<span className="chat-author">System</span>
								<div className="chat-bubble chat-bubble-system">
									Match started. Good luck to both players!
								</div>
							</div>
							{chatMessages.map((message, index) => {
								const mine = message.from === myID;
								return (
									<div
										key={index}
										className={`chat-msg ${mine ? 'chat-msg-me' : 'chat-msg-them'}`}
									>
										<span className="chat-author">{mine ? 'You' : message.username}</span>
										<div className={`chat-bubble ${mine ? 'chat-bubble-me' : 'chat-bubble-them'}`}>
											{message.text}
										</div>
									</div>
								);
							})}
						</div>
						<div className="chat-input-row">
							<input
								className="chat-input"
								value={chatInput}
								onChange={(event) => setChatInput(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === 'Enter') {
										sendChat();
									}
								}}
								placeholder="Type a message…"
								maxLength={200}
							/>
							<button
								type="button"
								className="chat-send"
								onClick={sendChat}
								aria-label="Send message"
							>
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M22 2 11 13" />
									<path d="M22 2 15 22l-4-9-9-4 20-7Z" />
								</svg>
							</button>
						</div>
					</div>
				)}
			</aside>
		</div>

		{finished && !overlayClosed && (
			<GameOverOverlay
				outcome={myOutcome}
				reason={gameRow.result_reason ?? 'game over'}
				headline={myColor === null ? statusText : undefined}
				accuracy={{
					loading: accuracy.loading,
					progress: accuracy.progress,
					rows:
						myColor === null
							? [
									{ label: 'White', percent: accuracy.result?.white ?? null },
									{ label: 'Black', percent: accuracy.result?.black ?? null },
								]
							: [
									{
										label: 'You',
										percent:
											(myColor === 'white'
												? accuracy.result?.white
												: accuracy.result?.black) ?? null,
										highlight: true,
									},
									{
										label: 'Opponent',
										percent:
											(myColor === 'white'
												? accuracy.result?.black
												: accuracy.result?.white) ?? null,
									},
								],
				}}
				eloDelta={myColor !== null ? eloDelta : null}
				onClose={() => setOverlayClosed(true)}
				actions={[
					...(myColor !== null
						? [
								incomingRematch
									? { label: '✓ Accept rematch', onClick: acceptRematch, primary: true }
									: {
											label: rematchSent ? 'Rematch offered…' : '↺ Play again',
											onClick: offerRematch,
											primary: true,
											disabled: rematchSent,
										},
							]
						: []),
					{ label: '🔍 Review game', onClick: () => router.push(`/analyze/${gameID}`) },
					{ label: '🏠 Home', onClick: () => router.push('/') },
				]}
			/>
		)}
		</>
	);
}
