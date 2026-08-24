'use client';

import { useEffect, useRef } from 'react';

export function MoveList({ moves }: { moves: readonly string[] }) {
	const listRef = useRef<HTMLOListElement>(null);

	// Keep the newest move visible
	useEffect(() => {
		const list = listRef.current;
		if (list) {
			list.scrollTop = list.scrollHeight;
		}
	}, [moves.length]);

	const pairs: Array<{ moveNumber: number; white: string; black?: string }> = [];
	for (let i = 0; i < moves.length; i += 2) {
		pairs.push({ moveNumber: i / 2 + 1, white: moves[i], black: moves[i + 1] });
	}

	if (pairs.length === 0) {
		return <p className="move-list-empty">No moves yet</p>;
	}

	return (
		<ol ref={listRef} className="move-list">
			{pairs.map((pair) => (
				<li key={pair.moveNumber}>
					<span className="move-number">{pair.moveNumber}.</span>
					<span className="move-san">{pair.white}</span>
					<span className="move-san">{pair.black ?? ''}</span>
				</li>
			))}
		</ol>
	);
}
