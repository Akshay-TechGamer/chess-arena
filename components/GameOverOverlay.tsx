'use client';

// End-of-game overlay: celebratory for a win, encouraging for a loss, calm
// for a draw. Used by both the online board and the vs-computer board.

export type Outcome = 'win' | 'loss' | 'draw' | 'spectator';

export interface OverlayAction {
	label: string;
	onClick: () => void;
	primary?: boolean;
	disabled?: boolean;
}

interface GameOverOverlayProps {
	outcome: Outcome;
	/** Machine reason like "checkmate", "timeout", "resignation". */
	reason: string;
	/** Shown for spectators / draws, e.g. "White wins". */
	headline?: string;
	actions: OverlayAction[];
	onClose: () => void;
}

const TITLE: Record<Outcome, string> = {
	win: 'You won! 🎉',
	loss: 'You lost',
	draw: "It's a draw 🤝",
	spectator: 'Game over',
};

const EMOJI: Record<Outcome, string> = {
	win: '🏆',
	loss: '💪',
	draw: '🤝',
	spectator: '♟️',
};

const SUBTEXT: Record<Outcome, string> = {
	win: 'Well played. Want to go again?',
	loss: 'Good game — review it to see where it slipped and find the better moves.',
	draw: 'Evenly matched. Rematch?',
	spectator: '',
};

function prettyReason(reason: string): string {
	const text = reason.replace(/_/g, ' ');
	return text.charAt(0).toUpperCase() + text.slice(1);
}

export function GameOverOverlay({ outcome, reason, headline, actions, onClose }: GameOverOverlayProps) {
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
