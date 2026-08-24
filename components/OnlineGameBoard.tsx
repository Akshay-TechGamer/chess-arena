'use client';

// Online multiplayer board. Loads the game, joins if invited, syncs moves
// over Realtime, and survives refresh (state rebuilt from chess_moves).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { ensureProfile, ensureSignedIn, getUsernames } from '@/lib/data/authRepo';
import {
	finishGame,
	getGame,
	joinGame,
	listMoves,
	recordMove,
	type GameResult,
	type GameRow,
	type MoveRow,
} from '@/lib/data/gamesRepo';
import { subscribeToGame } from '@/lib/realtime/gameChannel';
import { getGameStatus, type PlayerColor } from '@/lib/game/status';
import { MoveList } from '@/components/MoveList';
import { PromotionDialog } from '@/components/PromotionDialog';

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

function statusToResult(winner: PlayerColor | 'draw'): GameResult {
	if (winner === 'draw') {
		return 'draw';
	}
	return winner === 'white' ? 'white_win' : 'black_win';
}

export function OnlineGameBoard({ gameID }: { gameID: string }) {
	const [game] = useState(() => new Chess());
	const [fen, setFen] = useState(() => game.fen());
	const [phase, setPhase] = useState<Phase>('loading');
	const [errorMsg, setErrorMsg] = useState('');
	const [gameRow, setGameRow] = useState<GameRow | null>(null);
	const [myID, setMyID] = useState<string | null>(null);
	const [names, setNames] = useState<Record<string, string>>({});
	const [selected, setSelected] = useState<Square | null>(null);
	const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
	const [presenceCount, setPresenceCount] = useState(1);
	const [busy, setBusy] = useState(false);
	const [banner, setBanner] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const gameRowRef = useRef<GameRow | null>(null);
	gameRowRef.current = gameRow;

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
				await ensureProfile(user);
				let row = await getGame(gameID);
				if (!row) {
					throw new Error('Game not found — check the link.');
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
				setFen(game.fen());
				setGameRow(row);
				setMyID(user.id);
				setPhase('ready');
				getUsernames([row.white_id ?? '', row.black_id ?? '']).then((fetched) => {
					if (!cancelled) {
						setNames(fetched);
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

	// Realtime subscription: opponent moves, game updates, presence.
	useEffect(() => {
		if (!myID) {
			return;
		}
		const unsubscribe = subscribeToGame(gameID, myID, {
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
				// move.ply <= played: our own move echoing back — ignore
			},
			onGameUpdate: (row: GameRow) => {
				setGameRow(row);
				if (row.black_id && !names[row.black_id]) {
					getUsernames([row.black_id]).then((fetched) =>
						setNames((prev) => ({ ...prev, ...fetched })),
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
		});
		return unsubscribe;
		// names intentionally omitted: subscription must not restart on name loads
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [gameID, myID, game, resyncMoves]);

	const submitMove = useCallback(
		(from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
			if (!isMyTurn) {
				return false;
			}
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
					await recordMove({
						gameID,
						ply: game.history().length,
						san: game.history().slice(-1)[0],
						fenAfter: game.fen(),
						pgn: game.pgn(),
					});
					const after = getGameStatus(game);
					if (after.isOver && after.winner) {
						await finishGame(gameID, statusToResult(after.winner), after.reason ?? 'game_over');
					}
				} catch {
					game.undo();
					setFen(game.fen());
					setBanner('Move did not reach the server — try again.');
				} finally {
					setBusy(false);
				}
			})();
			return true;
		},
		[game, gameID, isMyTurn],
	);

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
		const winner: PlayerColor = myColor === 'white' ? 'black' : 'white';
		finishGame(gameID, statusToResult(winner), 'resignation').catch(() =>
			setBanner('Could not resign — try again.'),
		);
	}, [myColor, gameRow, gameID]);

	const copyInviteLink = useCallback(() => {
		const link = `${window.location.origin}/game/${gameID}`;
		navigator.clipboard.writeText(link).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}, [gameID]);

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
				<div className="invite-code">{gameRow.invite_code}</div>
				<button type="button" className="btn btn-primary" onClick={copyInviteLink}>
					{copied ? '✓ Copied!' : 'Copy invite link'}
				</button>
			</div>
		);
	}

	const whiteName = names[gameRow.white_id ?? ''] ?? 'White';
	const blackName = names[gameRow.black_id ?? ''] ?? 'Black';
	const opponentOnline = presenceCount >= 2;

	const statusText =
		gameRow.status === 'finished'
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

	return (
		<div className="game-layout">
			<div className="board-column">
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
				<div className={`status-banner${gameRow.status === 'finished' ? ' status-over' : ''}`}>
					{banner ?? statusText}
				</div>
				<MoveList moves={game.history()} />
				{gameRow.status === 'active' && myColor !== null && (
					<div className="button-row">
						<button type="button" className="btn" onClick={resign}>
							Resign
						</button>
					</div>
				)}
			</aside>
		</div>
	);
}
