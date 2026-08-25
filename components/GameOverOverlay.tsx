'use client';

// End-of-game overlay: "Victory" for a win, "Game Over." for a loss, "Draw"
// for a draw — with an accuracy stats card. Used by online + vs-computer.

export type Outcome = 'win' | 'loss' | 'draw' | 'spectator';

export interface OverlayAction {
	label: string;
	onClick: () => void;
	primary?: boolean;
	disabled?: boolean;
}

export interface AccuracyRow {
	label: string;
	percent: number | null;
	highlight?: boolean;
}

export interface AccuracyDisplay {
	loading: boolean;
	progress: number;
	rows: AccuracyRow[];
}

interface GameOverOverlayProps {
	outcome: Outcome;
	reason: string;
	headline?: string;
	accuracy?: AccuracyDisplay;
	actions: OverlayAction[];
	onClose: () => void;
}

const TITLE: Record<Outcome, string> = {
	win: 'Victory',
	loss: 'Game Over.',
	draw: 'Draw',
	spectator: 'Game over',
};

const EMOJI: Record<Outcome, string> = {
	win: '🏆',
	loss: '💪',
	draw: '🤝',
	spectator: '♟️',
};

const SUBTEXT: Record<Outcome, string> = {
	win: 'Well played!',
	loss: 'Nice effort — review it to see the better moves.',
	draw: 'Evenly matched.',
	spectator: '',
};

function prettyReason(reason: string): string {
	const text = reason.replace(/_/g, ' ');
	return text.charAt(0).toUpperCase() + text.slice(1);
}

export function GameOverOverlay({
	outcome,
	reason,
	headline,
	accuracy,
	actions,
	onClose,
}: GameOverOverlayProps) {
	return (
		<div className="over-backdrop" onClick={onClose}>
			<div className={`over-card over-${outcome}`} onClick={(e) => e.stopPropagation()} role="dialog">
				<button type="button" className="over-close" aria-label="Close" onClick={onClose}>
					✕
				</button>
				<div className="over-emoji">{EMOJI[outcome]}</div>
				<h2 className="over-title">{TITLE[outcome]}</h2>
				{headline && <p className="over-headline">{headline}</p>}
				<p className="over-reason">{prettyReason(reason)}</p>
				{SUBTEXT[outcome] && <p className="over-sub">{SUBTEXT[outcome]}</p>}

				{accuracy && (
					<div className="over-stats">
						<div className="over-stats-head">
							<span>Accuracy</span>
							{accuracy.loading && <span className="over-stats-prog">{accuracy.progress}%</span>}
						</div>
						{accuracy.rows.map((row) => (
							<div key={row.label} className={`over-stat-row${row.highlight ? ' over-stat-me' : ''}`}>
								<span className="over-stat-label">{row.label}</span>
								<span className="over-stat-value">
									{row.percent == null
										? accuracy.loading
											? '…'
											: '—'
										: `${row.percent.toFixed(1)}%`}
								</span>
							</div>
						))}
					</div>
				)}

				<div className="over-actions">
					{actions.map((action) => (
						<button
							key={action.label}
							type="button"
							className={`btn${action.primary ? ' btn-primary' : ''}`}
							onClick={action.onClick}
							disabled={action.disabled}
						>
							{action.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
