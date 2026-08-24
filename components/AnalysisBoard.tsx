'use client';

// Post-game analysis: step through a stored game with a full-strength
// Stockfish evaluation, eval bar, and best-move hint at every position.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { getGame, listMoves } from '@/lib/data/gamesRepo';
import { getUsernames } from '@/lib/data/authRepo';
import { StockfishEngine } from '@/lib/engine/stockfish';
import {
	formatScore,
	toWhitePerspective,
	whiteWinPercent,
	type EngineScore,
} from '@/lib/game/evaluation';
import { MoveList } from '@/components/MoveList';

const EVAL_MOVETIME_MS = 900;
const EVAL_DEBOUNCE_MS = 250;

interface PositionEval {
	scoreForWhite: EngineScore;
	bestSan: string;
}

export function AnalysisBoard({ gameID }: { gameID: string }) {
	const [sans, setSans] = useState<string[] | null>(null);
	const [players, setPlayers] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [ply, setPly] = useState(0);
	const [evaluation, setEvaluation] = useState<PositionEval | null>(null);
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

	// Evaluate the shown position (debounced so fast stepping stays smooth).
	useEffect(() => {
		if (!fens) {
			return;
		}
		const fen = fens[ply];
		let cancelled = false;
		setEvaluating(true);
		const timer = setTimeout(() => {
			engineRef.current
				?.evaluate(fen, EVAL_MOVETIME_MS)
				.then((result) => {
					if (cancelled) {
						return;
					}
					const sideToMove = fen.split(' ')[1] as 'w' | 'b';
					const probe = new Chess(fen);
					const bestSan = probe.move({
						from: result.bestMove.from,
						to: result.bestMove.to,
						promotion: result.bestMove.promotion ?? 'q',
					}).san;
					setEvaluation({
						scoreForWhite: toWhitePerspective(result.score, sideToMove),
						bestSan,
					});
					setEvaluating(false);
				})
				.catch(() => {
					if (!cancelled) {
						// Terminal position (mate/stalemate) — no move to suggest
						setEvaluation(null);
						setEvaluating(false);
					}
				});
		}, EVAL_DEBOUNCE_MS);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [fens, ply]);

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

	return (
		<div className="game-layout">
			<div className="eval-bar" title="White's winning chances">
				<div className="eval-bar-white" style={{ height: `${barPercent}%` }} />
			</div>
			<div className="board-column">
				<div className="board-wrap">
					<Chessboard
						options={{
							id: 'chess-arena-analysis-board',
							position: fens[ply],
							allowDragging: false,
							animationDurationInMs: 150,
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
				<MoveList moves={sans ?? []} activePly={ply} onSelectPly={setPly} />
				<p className="game-subtitle">Tip: use ← → arrow keys to step through moves.</p>
			</aside>
		</div>
	);
}
