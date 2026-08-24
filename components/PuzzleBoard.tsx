'use client';

// Daily puzzle from Lichess: find the winning line. You play one side;
// the opponent's replies play automatically.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { derivePuzzlePosition, matchesSolution, uciToMove } from '@/lib/game/puzzle';
import type { EngineMove } from '@/lib/game/uci';

interface DailyPuzzle {
	game: { pgn: string };
	puzzle: { id: string; rating: number; solution: string[]; themes: string[] };
}

type PuzzleState = 'loading' | 'error' | 'playing' | 'wrong' | 'solved';

const OPPONENT_REPLY_DELAY_MS = 450;
const WRONG_MOVE_UNDO_DELAY_MS = 700;

export function PuzzleBoard() {
	const [game] = useState(() => new Chess());
	const [fen, setFen] = useState(() => game.fen());
	const [state, setState] = useState<PuzzleState>('loading');
	const [errorMsg, setErrorMsg] = useState('');
	const [rating, setRating] = useState(0);
	const [playerSide, setPlayerSide] = useState<'w' | 'b'>('w');
	const [solutionStep, setSolutionStep] = useState(0);
	const [hintSan, setHintSan] = useState<string | null>(null);
	const [selected, setSelected] = useState<Square | null>(null);
	const solutionRef = useRef<string[]>([]);
	const startFenRef = useRef('');

	const loadPuzzle = useCallback(async () => {
		setState('loading');
		setHintSan(null);
		setSolutionStep(0);
		try {
			const response = await fetch('/api/puzzle/daily');
			if (!response.ok) {
				throw new Error('Could not fetch the daily puzzle');
			}
			const data = (await response.json()) as DailyPuzzle;
			const pgnMoves = data.game.pgn.trim().split(/\s+/);
			const position = derivePuzzlePosition(pgnMoves, data.puzzle.solution);
			solutionRef.current = data.puzzle.solution;
			startFenRef.current = position.fen;
			game.load(position.fen);
			setFen(game.fen());
			setPlayerSide(position.sideToMove);
			setRating(data.puzzle.rating);
			setState('playing');
		} catch (loadError) {
			setErrorMsg(loadError instanceof Error ? loadError.message : 'Failed to load puzzle');
			setState('error');
		}
	}, [game]);

	useEffect(() => {
		void loadPuzzle();
	}, [loadPuzzle]);

	const playOpponentReply = useCallback(
		(step: number) => {
			const reply = solutionRef.current[step];
			if (!reply) {
				return;
			}
			setTimeout(() => {
				const move = uciToMove(reply);
				game.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
				setFen(game.fen());
			}, OPPONENT_REPLY_DELAY_MS);
		},
		[game],
	);

	const tryMove = useCallback(
		(from: Square, to: Square): boolean => {
			if (state !== 'playing' || game.turn() !== playerSide) {
				return false;
			}
			let made: { san: string; promotion?: string };
			try {
				made = game.move({ from, to, promotion: 'q' });
			} catch {
				return false;
			}
			setFen(game.fen());
			setSelected(null);
			const played: EngineMove = { from, to, promotion: (made.promotion as EngineMove['promotion']) ?? undefined };
			const expected = solutionRef.current[solutionStep];

			// Any checkmate counts as solved (Lichess convention), else must match
			if (matchesSolution(played, expected) || game.isCheckmate()) {
				const nextStep = solutionStep + 2;
				if (nextStep > solutionRef.current.length) {
					setState('solved');
					return true;
				}
				playOpponentReply(solutionStep + 1);
				setSolutionStep(nextStep);
				if (nextStep >= solutionRef.current.length) {
					setState('solved');
				}
				setHintSan(null);
				return true;
			}

			setState('wrong');
			setTimeout(() => {
				game.undo();
				setFen(game.fen());
				setState('playing');
			}, WRONG_MOVE_UNDO_DELAY_MS);
			return true;
		},
		[state, game, playerSide, solutionStep, playOpponentReply],
	);

	const showHint = useCallback(() => {
		const expected = solutionRef.current[solutionStep];
		if (!expected) {
			return;
		}
		const probe = new Chess(game.fen());
		const move = uciToMove(expected);
		setHintSan(probe.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' }).san);
	}, [game, solutionStep]);

	const reset = useCallback(() => {
		game.load(startFenRef.current);
		setFen(game.fen());
		setSolutionStep(0);
		setHintSan(null);
		setState('playing');
	}, [game]);

	if (state === 'loading') {
		return <p className="page-note">Loading today’s puzzle…</p>;
	}
	if (state === 'error') {
		return <p className="page-note">⚠ {errorMsg}</p>;
	}

	const legalTargets = selected
		? game.moves({ square: selected, verbose: true }).map((move) => move.to)
		: [];
	const squareStyles: Record<string, React.CSSProperties> = {};
	if (selected) {
		squareStyles[selected] = { backgroundColor: 'rgba(20, 85, 30, 0.5)' };
	}
	for (const target of legalTargets) {
		squareStyles[target] = {
			backgroundImage: 'radial-gradient(circle, rgba(20, 85, 30, 0.55) 22%, transparent 25%)',
		};
	}

	const statusText =
		state === 'solved'
			? '🎉 Solved! Great job.'
			: state === 'wrong'
				? '✗ Not that one — try again'
				: `${playerSide === 'w' ? 'White' : 'Black'} to move — find the best move`;

	return (
		<div className="game-layout">
			<div className="board-column">
				<div className="board-wrap">
					<Chessboard
						options={{
							id: 'chess-arena-puzzle-board',
							position: fen,
							boardOrientation: playerSide === 'w' ? 'white' : 'black',
							animationDurationInMs: 200,
							allowDragging: state === 'playing' && game.turn() === playerSide,
							squareStyles,
							canDragPiece: ({ piece }: { piece: { pieceType: string } }) =>
								state === 'playing' && piece.pieceType.startsWith(playerSide),
							onPieceDrop: ({
								sourceSquare,
								targetSquare,
							}: {
								sourceSquare: string;
								targetSquare: string | null;
							}) => {
								if (!targetSquare) {
									return false;
								}
								return tryMove(sourceSquare as Square, targetSquare as Square);
							},
							onSquareClick: ({
								square,
								piece,
							}: {
								square: string;
								piece: { pieceType: string } | null;
							}) => {
								if (state !== 'playing') {
									return;
								}
								if (selected && legalTargets.includes(square as Square)) {
									tryMove(selected, square as Square);
									return;
								}
								if (piece && piece.pieceType.startsWith(playerSide)) {
									setSelected(square as Square);
								} else {
									setSelected(null);
								}
							},
						}}
					/>
				</div>
			</div>
			<aside className="sidebar">
				<p className="game-subtitle">Daily puzzle · rating ~{rating} · from Lichess</p>
				<div className={`status-banner${state === 'solved' ? ' status-over' : ''}`}>{statusText}</div>
				{hintSan && <p className="game-subtitle">Hint: {hintSan}</p>}
				<div className="button-row">
					<button type="button" className="btn" onClick={showHint} disabled={state !== 'playing'}>
						💡 Hint
					</button>
					<button type="button" className="btn" onClick={reset}>
						↺ Reset
					</button>
				</div>
			</aside>
		</div>
	);
}
