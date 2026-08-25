'use client';

// Post-game analysis: step through a stored game with a full-strength
// Stockfish evaluation, eval bar, and best-move hint at every position.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { DARK_SQUARE_STYLE, LIGHT_SQUARE_STYLE } from '@/lib/game/boardTheme';
import { getGame, listMoves } from '@/lib/data/gamesRepo';
import { getUsernames } from '@/lib/data/authRepo';
import { StockfishEngine } from '@/lib/engine/stockfish';
import {
	formatScore,
	toWhitePerspective,
	whiteWinPercent,
	type EngineScore,
} from '@/lib/game/evaluation';
import { GRADE_LABEL, gradeMove, reviewText, type MoveGrade } from '@/lib/game/moveReview';
import { MoveList } from '@/components/MoveList';

const EVAL_MOVETIME_MS = 600;
const EVAL_DEBOUNCE_MS = 250;

interface PositionEval {
	scoreForWhite: EngineScore;
	bestSan: string;
}

interface MoveReview {
	grade: MoveGrade;
	playedSan: string;
	bestSan: string;
	/** Best alternative move (green arrow). */
	bestFrom: string;
	bestTo: string;
	/** The move actually played (pink highlight). */
	playedFrom: string;
	playedTo: string;
}

export function AnalysisBoard({ gameID }: { gameID: string }) {
	const [sans, setSans] = useState<string[] | null>(null);
	const [players, setPlayers] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [ply, setPly] = useState(0);
	const [evaluation, setEvaluation] = useState<PositionEval | null>(null);
	const [review, setReview] = useState<MoveReview | null>(null);
	const [evaluating, setEvaluating] = useState(false);
	const engineRef = useRef<StockfishEngine | null>(null);

	// FEN of every position: fens[0] = start, fens[i] = after i plies.
	const fens = useMemo(() => {
		if (!sans) {
			return null;
		}
		const chess = new Chess();
		const list = [chess.fen()];
		for (const san of sans) {
			chess.move(san);
			list.push(chess.fen());
		}
		return list;
	}, [sans]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				// Local / vs-computer games are not saved to the DB — the board
				// hands the finished PGN over via sessionStorage.
				if (gameID === 'local') {
					const pgn = sessionStorage.getItem('chess-analyze-pgn') ?? '';
					const label = sessionStorage.getItem('chess-analyze-label') ?? 'Your game';
					const chess = new Chess();
					chess.loadPgn(pgn);
					if (cancelled) {
						return;
					}
					const history = chess.history();
					setSans(history);
					setPly(history.length);
					setPlayers(label);
					return;
				}
				const row = await getGame(gameID);
				if (!row) {
					throw new Error('Game not found');
				}
				const moves = await listMoves(gameID);
				const names = await getUsernames([row.white_id ?? '', row.black_id ?? '']);
				if (cancelled) {
					return;
				}
				setSans(moves.map((move) => move.san));
				setPly(moves.length);
				setPlayers(
					`${names[row.white_id ?? ''] ?? 'White'} vs ${names[row.black_id ?? ''] ?? 'Black'}`,
				);
			} catch (loadError) {
				if (!cancelled) {
					setError(loadError instanceof Error ? loadError.message : 'Failed to load game');
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [gameID]);

	// Engine lifecycle
	useEffect(() => {
		engineRef.current = new StockfishEngine();
		return () => {
			engineRef.current?.dispose();
			engineRef.current = null;
		};
	}, []);

	// Evaluate the shown position, and review the move that reached it.
	useEffect(() => {
		if (!fens || !sans) {
			return;
		}
		let cancelled = false;
		setEvaluating(true);
		const timer = setTimeout(async () => {
			const engine = engineRef.current;
			if (!engine) {
				return;
			}

			// 1) The shown position: eval bar + best next move.
			const shownFen = fens[ply];
			let shownWinAfterMover: number | null = null; // opponent-to-move win% here
			try {
				const result = await engine.evaluate(shownFen, EVAL_MOVETIME_MS);
				if (cancelled) {
					return;
				}
				const side = shownFen.split(' ')[1] as 'w' | 'b';
				const probe = new Chess(shownFen);
				const bestSan = probe.move({
					from: result.bestMove.from,
					to: result.bestMove.to,
					promotion: result.bestMove.promotion ?? 'q',
				}).san;
				setEvaluation({ scoreForWhite: toWhitePerspective(result.score, side), bestSan });
				shownWinAfterMover = whiteWinPercent(result.score); // side-to-move (opponent) win%
			} catch {
				if (cancelled) {
					return;
				}
				setEvaluation(null);
			}

			// 2) Review the move that led here (needs the previous position).
			if (ply < 1) {
				if (!cancelled) {
					setReview(null);
					setEvaluating(false);
				}
				return;
			}
			try {
				const prevFen = fens[ply - 1];
				const prevRes = await engine.evaluate(prevFen, EVAL_MOVETIME_MS);
				if (cancelled) {
					return;
				}
				const before = new Chess(prevFen);
				const played = before.move(sans[ply - 1]); // the move actually played
				const bestProbe = new Chess(prevFen);
				const best = bestProbe.move({
					from: prevRes.bestMove.from,
					to: prevRes.bestMove.to,
					promotion: prevRes.bestMove.promotion ?? 'q',
				});
				// win% for the mover before, and after the played move
				const winBefore = whiteWinPercent(prevRes.score); // mover to move at prevFen
				const chessAfter = new Chess(shownFen);
				const winAfter = chessAfter.isCheckmate()
					? 100 // the move delivered mate
					: shownWinAfterMover != null
						? 100 - shownWinAfterMover
						: winBefore;
				const grade = gradeMove(winBefore - winAfter, played.san === best.san);
				setReview({
					grade,
					playedSan: played.san,
					bestSan: best.san,
					bestFrom: best.from,
					bestTo: best.to,
					playedFrom: played.from,
					playedTo: played.to,
				});
			} catch {
				if (!cancelled) {
					setReview(null);
				}
			} finally {
				if (!cancelled) {
					setEvaluating(false);
				}
			}
		}, EVAL_DEBOUNCE_MS);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [fens, sans, ply]);

	const maxPly = sans?.length ?? 0;
	const step = useCallback(
		(delta: number) => {
			setPly((current) => Math.max(0, Math.min(maxPly, current + delta)));
		},
		[maxPly],
	);

	// Keyboard navigation
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'ArrowLeft') {
				step(-1);
			} else if (event.key === 'ArrowRight') {
				step(1);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [step]);

	if (error) {
		return <p className="page-note">⚠ {error}</p>;
	}
	if (!fens) {
		return <p className="page-note">Loading analysis…</p>;
	}

	const barPercent = evaluation ? whiteWinPercent(evaluation.scoreForWhite) : 50;

	// Pink highlight on the move that was played; green arrow for the better one.
	const squareStyles: Record<string, React.CSSProperties> = {};
	const arrows: Array<{ startSquare: string; endSquare: string; color: string }> = [];
	if (review) {
		squareStyles[review.playedFrom] = { backgroundColor: 'rgba(255, 120, 130, 0.45)' };
		squareStyles[review.playedTo] = { backgroundColor: 'rgba(255, 120, 130, 0.55)' };
		if (review.grade !== 'best') {
			arrows.push({ startSquare: review.bestFrom, endSquare: review.bestTo, color: '#5fbf6a' });
		}
	}

	return (
		<div className="game-layout">
			<div className="eval-bar" title="White's winning chances">
				<div
					className="eval-bar-white"
					style={{ height: `${barPercent}%`, ['--eval-fill' as string]: `${barPercent}%` }}
				/>
			</div>
			<div className="board-column">
				<div className="board-wrap">
					<Chessboard
						options={{
							id: 'chess-arena-analysis-board',
							lightSquareStyle: LIGHT_SQUARE_STYLE,
							darkSquareStyle: DARK_SQUARE_STYLE,
							position: fens[ply],
							allowDragging: false,
							animationDurationInMs: 150,
							squareStyles,
							arrows,
						}}
					/>
				</div>
				<div className="stepper-row">
					<button type="button" className="btn" onClick={() => setPly(0)} disabled={ply === 0}>
						⏮
					</button>
					<button type="button" className="btn" onClick={() => step(-1)} disabled={ply === 0}>
						◀
					</button>
					<span className="stepper-count">
						{ply} / {maxPly}
					</span>
					<button type="button" className="btn" onClick={() => step(1)} disabled={ply === maxPly}>
						▶
					</button>
					<button
						type="button"
						className="btn"
						onClick={() => setPly(maxPly)}
						disabled={ply === maxPly}
					>
						⏭
					</button>
				</div>
			</div>
			<aside className="sidebar">
				<p className="game-subtitle">{players}</p>
				<div className="status-banner">
					{evaluating
						? 'Evaluating…'
						: evaluation
							? `Eval ${formatScore(evaluation.scoreForWhite)} · Best: ${evaluation.bestSan}`
							: 'Game over position'}
				</div>
				{review && !evaluating && (
					<div className={`review-card review-${review.grade}`}>
						<div className="review-head">
							<span className="review-dot" />
							{review.grade === 'blunder' ? 'Missed win / Blunder' : GRADE_LABEL[review.grade]}
						</div>
						<p className="review-text">
							You played <b>{review.playedSan}</b>.{' '}
							{reviewText(review.grade, review.playedSan, review.bestSan)}
						</p>
					</div>
				)}
				<MoveList moves={sans ?? []} activePly={ply} onSelectPly={setPly} />
				<p className="game-subtitle">Tip: use ← → arrow keys to step through moves.</p>
			</aside>
		</div>
	);
}
