import Link from 'next/link';

export default function Home() {
	return (
		<div className="home">
			<h1 className="home-title">Play chess</h1>
			<div className="menu-grid">
				<Link href="/play/computer" className="mode-card">
					<span className="mode-icon">🤖</span>
					<span className="mode-name">vs Computer</span>
					<span className="mode-desc">Five difficulty levels, powered by Stockfish</span>
				</Link>
				<Link href="/play/local" className="mode-card">
					<span className="mode-icon">🤝</span>
					<span className="mode-name">2 Players</span>
					<span className="mode-desc">Play a friend on this device</span>
				</Link>
				<div className="mode-card mode-card-disabled" aria-disabled="true">
					<span className="mode-icon">🌍</span>
					<span className="mode-name">Online</span>
					<span className="mode-desc">Coming soon — invite links and quick match</span>
				</div>
			</div>
		</div>
	);
}
