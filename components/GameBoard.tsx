'use client';

// Shared board for local 2-player and vs-computer games.
// UI only — chess rules come from chess.js, engine moves from lib/engine.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { StockfishEngine } from '@/lib/engine/stockfish';
import { getEngineLevel, type EngineLevelID } from '@/lib/game/levels';
import { getGameStatus, type PlayerColor } from '@/lib/game/status';
import { MoveList } from '@/components/MoveList';

export interface GameBoardProps {
	mode: 'local' | 'computer';
	level?: EngineLevelID;
	playerColor?: PlayerColor;
}

interface PendingPromotion {
	from: Square;
	to: Square;
}

const PROMOTION_PIECES: ReadonlyArray<{ piece: 'q' | 'r' | 'b' | 'n'; glyph: string; label: string }> = [
	{ piece: 'q', glyph: '♛', label: 'Queen' },
	{ piece: 'r', glyph: '♜', label: 'Rook' },
	{ piece: 'b', glyph: '♝', label: 'Bishop' },
	{ piece: 'n', glyph: '♞', label: 'Knight' },
];

export function GameBoard({ mode, level = 'medium', playerColor = 'white' }: GameBoardProps) {
	const [game] = useState(() => new Chess());
	const [fen, setFen] = useState(() => game.fen());
	const [selected, setSelected] = useState<Square | null>(null);
	const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
	const [thinking, setThinking] = useState(false);
	const [engineError, setEngineError] = useState<string | null>(null);
	const engineRef = useRef<StockfishEngine | null>(null);

	const status = getGameStatus(game);
	const history = game.history();
	const playerChar = playerColor === 'white' ? 'w' : 'b';
	const isPlayersTurn =
		!status.isOver && (mode === 'local' || (game.turn() === playerChar && !thinking));

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
		syncPosition();
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

	const boardOptions = {
		id: 'chess-arena-board',
		position: fen,
		boardOrientation: mode === 'computer' ? playerColor : 'white' as const,
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

	return (
		<div className="game-layout">
			<div className="board-column">
				<div className="board-wrap">
					<Chessboard options={boardOptions} />
					{pendingPromotion && (
						<div className="promo-overlay">
							<div className="promo-dialog">
								<p>Promote to</p>
								<div className="promo-choices">
									{PROMOTION_PIECES.map(({ piece, glyph, label }) => (
										<button
											key={piece}
											type="button"
											className="promo-btn"
											aria-label={label}
											onClick={() => {
												makeMove(pendingPromotion.from, pendingPromotion.to, piece);
												setPendingPromotion(null);
											}}
										>
											{glyph}
										</button>
									))}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
			<aside className="sidebar">
				<p className="game-subtitle">{subtitle}</p>
				<div className={`status-banner${status.isOver ? ' status-over' : ''}`}>
					{engineError ?? (thinking ? 'Computer is thinking…' : status.text)}
				</div>
				<MoveList moves={history} />
				<div className="button-row">
					<button type="button" className="btn" onClick={newGame}>
						New game
					</button>
					<button
						type="button"
						className="btn"
						onClick={undo}
						disabled={history.length === 0 || thinking}
					>
						Undo
					</button>
				</div>
			</aside>
		</div>
	);
}
