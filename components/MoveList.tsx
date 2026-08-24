'use client';

import { useEffect, useRef } from 'react';

interface MoveListProps {
	moves: readonly string[];
	/** 1-based ply currently shown (analysis mode). Highlights that move. */
	activePly?: number;
	/** When set, moves become clickable and report their 1-based ply. */
	onSelectPly?: (ply: number) => void;
}

export function MoveList({ moves, activePly, onSelectPly }: MoveListProps) {
	const listRef = useRef<HTMLOListElement>(null);

	// Keep the newest move visible (only when not navigating history)
	useEffect(() => {
		const list = listRef.current;
		if (list && activePly === undefined) {
			list.scrollTop = list.scrollHeight;
		}
	}, [moves.length, activePly]);

	const pairs: Array<{ moveNumber: number; white: string; black?: string }> = [];
	for (let i = 0; i < moves.length; i += 2) {
		pairs.push({ moveNumber: i / 2 + 1, white: moves[i], black: moves[i + 1] });
	}

	if (pairs.length === 0) {
		return <p className="move-list-empty">No moves yet</p>;
	}

	const renderSan = (san: string | undefined, ply: number) => {
		if (!san) {
			return <span className="move-san" />;
		}
		if (!onSelectPly) {
			return <span className="move-san">{san}</span>;
		}
		return (
			<button
				type="button"
				className={`move-san move-san-btn${activePly === ply ? ' move-san-active' : ''}`}
				onClick={() => onSelectPly(ply)}
			>
				{san}
			</button>
		);
	};

	return (
		<ol ref={listRef} className="move-list">
			{pairs.map((pair) => (
				<li key={pair.moveNumber}>
					<span className="move-number">{pair.moveNumber}.</span>
					{renderSan(pair.white, pair.moveNumber * 2 - 1)}
					{renderSan(pair.black, pair.moveNumber * 2)}
				</li>
			))}
		</ol>
	);
}
