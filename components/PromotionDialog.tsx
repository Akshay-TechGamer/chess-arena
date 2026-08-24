'use client';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const PROMOTION_PIECES: ReadonlyArray<{ piece: PromotionPiece; glyph: string; label: string }> = [
	{ piece: 'q', glyph: '♛', label: 'Queen' },
	{ piece: 'r', glyph: '♜', label: 'Rook' },
	{ piece: 'b', glyph: '♝', label: 'Bishop' },
	{ piece: 'n', glyph: '♞', label: 'Knight' },
];

export function PromotionDialog({ onPick }: { onPick: (piece: PromotionPiece) => void }) {
	return (
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
							onClick={() => onPick(piece)}
						>
							{glyph}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
