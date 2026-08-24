'use client';

import { useState } from 'react';
import { GameBoard } from '@/components/GameBoard';
import { ENGINE_LEVELS, type EngineLevelID } from '@/lib/game/levels';
import type { PlayerColor } from '@/lib/game/status';

type ColorChoice = PlayerColor | 'random';

export default function ComputerGamePage() {
	const [level, setLevel] = useState<EngineLevelID>('medium');
	const [colorChoice, setColorChoice] = useState<ColorChoice>('white');
	const [started, setStarted] = useState<{ level: EngineLevelID; color: PlayerColor } | null>(null);

	if (started) {
		return <GameBoard mode="computer" level={started.level} playerColor={started.color} />;
	}

	const start = () => {
		const color: PlayerColor =
			colorChoice === 'random'
				? (crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0 ? 'white' : 'black')
				: colorChoice;
		setStarted({ level, color });
	};

	return (
		<div className="setup">
			<h1 className="setup-title">Play vs computer</h1>

			<h2 className="setup-label">Difficulty</h2>
			<div className="level-grid">
				{ENGINE_LEVELS.map((candidate) => (
					<button
						key={candidate.id}
						type="button"
						className={`level-card${level === candidate.id ? ' level-card-active' : ''}`}
						onClick={() => setLevel(candidate.id)}
					>
						<span className="level-name">{candidate.label}</span>
						<span className="level-elo">~{candidate.approxElo} Elo</span>
						<span className="level-desc">{candidate.description}</span>
					</button>
				))}
			</div>

			<h2 className="setup-label">Your color</h2>
			<div className="color-row">
				{(['white', 'black', 'random'] as const).map((choice) => (
					<button
						key={choice}
						type="button"
						className={`btn color-btn${colorChoice === choice ? ' btn-active' : ''}`}
						onClick={() => setColorChoice(choice)}
					>
						{choice === 'white' ? '♔ White' : choice === 'black' ? '♚ Black' : '🎲 Random'}
					</button>
				))}
			</div>

			<button type="button" className="btn btn-primary btn-start" onClick={start}>
				Start game
			</button>
		</div>
	);
}
