'use client';

// Shared board for local 2-player and vs-computer games.
// UI only — chess rules come from chess.js, engine moves from lib/engine.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { DARK_SQUARE_STYLE, LIGHT_SQUARE_STYLE } from '@/lib/game/boardTheme';
import { StockfishEngine } from '@/lib/engine/stockfish';
import { useGameAccuracy } from '@/lib/engine/accuracyAnalysis';
import { getEngineLevel, type EngineLevelID } from '@/lib/game/levels';
import { getGameStatus, type PlayerColor } from '@/lib/game/status';
import { MoveList } from '@/components/MoveList';
import { PromotionDialog } from '@/components/PromotionDialog';
import { PlayerCard } from '@/components/PlayerCard';
import { GameOverOverlay, type Outcome } from '@/components/GameOverOverlay';
import { BottomSheet } from '@/components/BottomSheet';

export interface GameBoardProps {
	mode: 'local' | 'computer';
	level?: EngineLevelID;
	playerColor?: PlayerColor;
}

interface PendingPromotion {
	from: Square;
	to: Square;
}

export function GameBoard({ mode, level = 'medium', playerColor = 'white' }: GameBoardProps) {
	const [game] = useState(() => new Chess());
	const [fen, setFen] = useState(() => game.fen());
	const [selected, setSelected] = useState<Square | null>(null);
	const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
	const [thinking, setThinking] = useState(false);
	const [engineError, setEngineError] = useState<string | null>(null);
	const [overlayClosed, setOverlayClosed] = useState(false);
	const [flipped, setFlipped] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [movesOpen, setMovesOpen] = useState(false);
	const engineRef = useRef<StockfishEngine | null>(null);
	const router = useRouter();

	// On mobile, move history moves into a bottom sheet so the board fits without
	// a page scrollbar.
	useEffect(() => {
		const query = window.matchMedia('(max-width: 760px)');
		const update = () => setIsMobile(query.matches);
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	}, []);

	const status = getGameStatus(game);
	const history = game.history();
	const playerChar = playerColor === 'white' ? 'w' : 'b';
	const isPlayersTurn =
		!status.isOver && (mode === 'local' || (game.turn() === playerChar && !thinking));

	// All position FENs, once the game is over — feeds the accuracy analysis.
	const gameFens = useMemo(() => {
		if (!status.isOver) {
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
	}, [status.isOver, fen]);
	const accuracy = useGameAccuracy(gameFens, status.isOver && !overlayClosed);

	const syncPosition = useCallback(() => {
		setFen(game.fen());
		setSelected(null);
	}, [game]);

	const makeMove = useCallback(
		(from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
			try {
				game.move({ from, to, promotion });
			} catch {
				return false;
			}
			syncPosition();
			return true;
		},
		[game, syncPosition],
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

	// A human tried to play from → to (via drag or click).
	const tryHumanMove = useCallback(
		(from: Square, to: Square): boolean => {
			if (!isPlayersTurn || pendingPromotion) {
				return false;
			}
			if (isPromotionMove(from, to)) {
				setPendingPromotion({ from, to });
				return false; // piece snaps back; the dialog completes the move
			}
			return makeMove(from, to);
		},
		[isPlayersTurn, pendingPromotion, isPromotionMove, makeMove],
	);

	// Engine setup + engine replies (computer mode only).
	useEffect(() => {
		if (mode !== 'computer') {
			return;
		}
		if (!engineRef.current) {
			engineRef.current = new StockfishEngine();
		}
		if (status.isOver || game.turn() === playerChar) {
			return;
		}
		let cancelled = false;
		setThinking(true);
		engineRef.current
			.getBestMove(game.fen(), getEngineLevel(level))
			.then((engineMove) => {
				if (cancelled) {
					return;
				}
				game.move({
					from: engineMove.from,
					to: engineMove.to,
					promotion: engineMove.promotion ?? 'q',
				});
				syncPosition();
			})
			.catch(() => {
				if (!cancelled) {
					setEngineError('Engine failed to move. Refresh the page to retry.');
				}
			})
			.finally(() => {
				if (!cancelled) {
					setThinking(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [mode, fen, status.isOver, game, playerChar, level, syncPosition]);

	// Tear the worker down when leaving the page.
	useEffect(() => {
		return () => {
			engineRef.current?.dispose();
			engineRef.current = null;
		};
	}, []);

	const newGame = () => {
		game.reset();
		setPendingPromotion(null);
		setEngineError(null);
		setOverlayClosed(false);
		syncPosition();
	};

	// Hand the finished game to the analysis view (local games aren't in the DB).
	const reviewGame = () => {
		const label =
			mode === 'computer'
				? `You (${playerColor}) vs ${getEngineLevel(level).label} computer`
				: 'Local game';
		sessionStorage.setItem('chess-analyze-pgn', game.pgn());
		sessionStorage.setItem('chess-analyze-label', label);
		router.push('/analyze/local');
	};

	const undo = () => {
		if (thinking) {
			return;
		}
		// vs computer: take back the engine's reply too, so it's the human's turn again
		const plies = mode === 'computer' && game.turn() === playerChar ? 2 : 1;
		for (let i = 0; i < plies; i++) {
			game.undo();
		}
		setPendingPromotion(null);
		syncPosition();
	};

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

	const baseOrientation: PlayerColor = mode === 'computer' ? playerColor : 'white';
	const orientation: PlayerColor = flipped
		? baseOrientation === 'white'
			? 'black'
			: 'white'
		: baseOrientation;

	const boardOptions = {
		id: 'chess-arena-board',
			lightSquareStyle: LIGHT_SQUARE_STYLE,
			darkSquareStyle: DARK_SQUARE_STYLE,
		position: fen,
		boardOrientation: orientation,
		animationDurationInMs: 200,
		allowDragging: isPlayersTurn,
		squareStyles,
		canDragPiece: ({ piece }: { piece: { pieceType: string } }) =>
			isPlayersTurn && piece.pieceType.startsWith(game.turn()),
		onPieceDrop: ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
			if (!targetSquare) {
				return false;
			}
			return tryHumanMove(sourceSquare as Square, targetSquare as Square);
		},
		onSquareClick: ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
			if (pendingPromotion || !isPlayersTurn) {
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

	const subtitle =
		mode === 'computer'
			? `You are ${playerColor} vs ${getEngineLevel(level).label} computer`
			: 'Local two-player — pass the device between moves';

	const myOutcome: Outcome = !status.isOver
		? 'spectator'
		: status.winner === 'draw'
			? 'draw'
			: mode === 'local'
				? 'spectator'
				: status.winner === playerColor
					? 'win'
					: 'loss';

	const movesPanel = (
		<section className="mh-panel">
			<h3 className="mh-title">Move History</h3>
			<MoveList moves={history} />
		</section>
	);

	// Which card (top/bottom) is which colour, and whose turn it is — drives the
	// active card highlight that replaces the "to move" banner on mobile.
	const bottomSide: 'w' | 'b' = mode === 'computer' ? (playerColor === 'white' ? 'w' : 'b') : 'w';
	const topSide: 'w' | 'b' = bottomSide === 'w' ? 'b' : 'w';
	const topActive = !status.isOver && game.turn() === topSide;
	const bottomActive = !status.isOver && game.turn() === bottomSide;
	const turnLabelFor = (side: 'w' | 'b') => {
		if (mode === 'computer') {
			if (side === bottomSide) {
				return 'Your turn';
			}
			return thinking ? 'Thinking…' : `${side === 'w' ? 'White' : 'Black'} to move`;
		}
		return `${side === 'w' ? 'White' : 'Black'} to move`;
	};
	const showBanner = !isMobile || status.isOver || thinking || engineError !== null;

	return (
		<>
		<div className="game-layout">
			<div className="board-column">
				<PlayerCard
					name={mode === 'computer' ? `${getEngineLevel(level).label} bot` : 'Black'}
					active={topActive}
					turnLabel={topActive ? turnLabelFor(topSide) : undefined}
				/>
				<div className="board-wrap">
					<Chessboard options={boardOptions} />
					{pendingPromotion && (
						<PromotionDialog
							onPick={(piece) => {
								makeMove(pendingPromotion.from, pendingPromotion.to, piece);
								setPendingPromotion(null);
							}}
						/>
					)}
				</div>
				<PlayerCard
					name={mode === 'computer' ? 'You' : 'White'}
					you={mode === 'computer'}
					active={bottomActive}
					turnLabel={bottomActive ? turnLabelFor(bottomSide) : undefined}
				/>
			</div>
			<aside className="sidebar">
				<p className="game-subtitle">{subtitle}</p>
				{showBanner && (
					<div className={`status-banner${status.isOver ? ' status-over' : ''}`}>
						{engineError ?? (thinking ? 'Computer is thinking…' : status.text)}
					</div>
				)}
				{!isMobile && movesPanel}
				<div className="game-controls">
					<button
						type="button"
						className="gc-btn"
						onClick={undo}
						disabled={history.length === 0 || thinking}
					>
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M3 7v6h6" />
							<path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
						</svg>
						<span>Undo</span>
					</button>
					<button type="button" className="gc-btn gc-primary" onClick={newGame}>
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
							<path d="M21 3v5h-5" />
						</svg>
						<span>Restart</span>
					</button>
					<button
						type="button"
						className="gc-btn"
						onClick={() => setFlipped((value) => !value)}
					>
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M12 3v18" />
							<path d="m8 7 4-4 4 4" />
							<path d="m8 17 4 4 4-4" />
						</svg>
						<span>Flip Board</span>
					</button>
					{isMobile && (
						<button
							type="button"
							className="gc-btn"
							onClick={() => setMovesOpen(true)}
							aria-label="Move history"
						>
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<line x1="8" y1="6" x2="21" y2="6" />
								<line x1="8" y1="12" x2="21" y2="12" />
								<line x1="8" y1="18" x2="21" y2="18" />
								<line x1="3" y1="6" x2="3.01" y2="6" />
								<line x1="3" y1="12" x2="3.01" y2="12" />
								<line x1="3" y1="18" x2="3.01" y2="18" />
							</svg>
							<span>Moves</span>
						</button>
					)}
				</div>
			</aside>
		</div>

		{isMobile && movesOpen && (
			<BottomSheet onClose={() => setMovesOpen(false)}>{movesPanel}</BottomSheet>
		)}

		{status.isOver && !overlayClosed && (
			<GameOverOverlay
				outcome={myOutcome}
				reason={status.reason ?? 'game over'}
				headline={mode === 'local' ? status.text : undefined}
				accuracy={{
					loading: accuracy.loading,
					progress: accuracy.progress,
					rows:
						mode === 'local'
							? [
									{ label: 'White', percent: accuracy.result?.white ?? null },
									{ label: 'Black', percent: accuracy.result?.black ?? null },
								]
							: [
									{
										label: 'You',
										percent:
											(playerColor === 'white'
												? accuracy.result?.white
												: accuracy.result?.black) ?? null,
										highlight: true,
									},
									{
										label: `${getEngineLevel(level).label} bot`,
										percent:
											(playerColor === 'white'
												? accuracy.result?.black
												: accuracy.result?.white) ?? null,
									},
								],
				}}
				onClose={() => setOverlayClosed(true)}
				actions={[
					{ label: '↺ New game', onClick: newGame, primary: true },
					{ label: '🔍 Review game', onClick: reviewGame },
					{ label: '🏠 Home', onClick: () => router.push('/') },
				]}
			/>
		)}
		</>
	);
}
