// Thin browser-side wrapper around the Stockfish Web Worker.
// All UCI string handling lives in lib/game/uci.ts (pure + tested);
// this file only does worker plumbing, so it stays as small as possible.

import type { EngineLevel } from '@/lib/game/levels';
import {
	goCommand,
	parseBestMove,
	positionCommand,
	skillLevelCommand,
	type EngineMove,
} from '@/lib/game/uci';
import { parseInfoScore, type EngineScore } from '@/lib/game/evaluation';

export interface EngineEvaluation {
	/** Score from the side-to-move's perspective (UCI convention). */
	score: EngineScore;
	bestMove: EngineMove;
}

const ENGINE_URL = '/engine/stockfish.js';

export class StockfishEngine {
	private worker: Worker | null = null;
	private initPromise: Promise<void> | null = null;
	// UCI is stateful: only one search may run at a time, so calls queue up.
	private searchQueue: Promise<unknown> = Promise.resolve();

	private enqueue<T>(task: () => Promise<T>): Promise<T> {
		const next = this.searchQueue.then(task, task);
		this.searchQueue = next.catch(() => undefined);
		return next;
	}

	/** Boots the worker and waits for the UCI handshake. Safe to call twice. */
	init(): Promise<void> {
		if (this.initPromise) {
			return this.initPromise;
		}
		const worker = new Worker(ENGINE_URL);
		this.worker = worker;
		this.initPromise = new Promise<void>((resolve, reject) => {
			const onMessage = (event: MessageEvent<string>) => {
				if (typeof event.data === 'string' && event.data.startsWith('uciok')) {
					worker.removeEventListener('message', onMessage);
					resolve();
				}
			};
			worker.addEventListener('message', onMessage);
			worker.addEventListener('error', (event) => reject(event.error ?? new Error('Stockfish worker failed to load')), { once: true });
			worker.postMessage('uci');
		});
		return this.initPromise;
	}

	/** Asks the engine for its move in the given position at the given level. */
	getBestMove(fen: string, level: EngineLevel): Promise<EngineMove> {
		return this.enqueue(() => this.runBestMove(fen, level));
	}

	private async runBestMove(fen: string, level: EngineLevel): Promise<EngineMove> {
		await this.init();
		const worker = this.worker;
		if (!worker) {
			throw new Error('Engine disposed');
		}
		return new Promise<EngineMove>((resolve, reject) => {
			const onMessage = (event: MessageEvent<string>) => {
				if (typeof event.data !== 'string') {
					return;
				}
				const move = parseBestMove(event.data);
				if (move) {
					worker.removeEventListener('message', onMessage);
					resolve(move);
				} else if (event.data.startsWith('bestmove')) {
					// "bestmove (none)" — position already decided
					worker.removeEventListener('message', onMessage);
					reject(new Error('Engine has no legal move'));
				}
			};
			worker.addEventListener('message', onMessage);
			worker.postMessage(skillLevelCommand(level.skill));
			worker.postMessage(positionCommand(fen));
			worker.postMessage(goCommand(level.moveTimeMs));
		});
	}

	/** Full-strength evaluation of a position, for the analysis view. */
	evaluate(fen: string, moveTimeMs: number): Promise<EngineEvaluation> {
		return this.enqueue(() => this.runEvaluate(fen, moveTimeMs));
	}

	private async runEvaluate(fen: string, moveTimeMs: number): Promise<EngineEvaluation> {
		await this.init();
		const worker = this.worker;
		if (!worker) {
			throw new Error('Engine disposed');
		}
		return new Promise<EngineEvaluation>((resolve, reject) => {
			let lastScore: EngineScore | null = null;
			const onMessage = (event: MessageEvent<string>) => {
				if (typeof event.data !== 'string') {
					return;
				}
				const score = parseInfoScore(event.data);
				if (score) {
					lastScore = score;
					return;
				}
				if (event.data.startsWith('bestmove')) {
					worker.removeEventListener('message', onMessage);
					const bestMove = parseBestMove(event.data);
					if (bestMove && lastScore) {
						resolve({ score: lastScore, bestMove });
					} else {
						reject(new Error('Position is already decided'));
					}
				}
			};
			worker.addEventListener('message', onMessage);
			worker.postMessage(skillLevelCommand(20));
			worker.postMessage(positionCommand(fen));
			worker.postMessage(goCommand(moveTimeMs));
		});
	}

	dispose(): void {
		this.worker?.terminate();
		this.worker = null;
		this.initPromise = null;
	}
}
