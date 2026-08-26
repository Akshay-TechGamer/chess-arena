'use client';

// Mobile-only bottom navigation bar (hidden on tablet/desktop, where the
// header inline nav / left rail take over).

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
	{ href: '/', label: 'Home', icon: '♞' },
	{ href: '/puzzles', label: 'Puzzle', icon: '🧩' },
	{ href: '/games', label: 'Games', icon: '📋' },
	{ href: '/leaderboard', label: 'Ranks', icon: '🏆' },
];

export function BottomNav() {
	const pathname = usePathname();
	return (
		<nav className="bottom-nav" aria-label="Primary">
			{LINKS.map((link) => {
				const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
				return (
					<Link
						key={link.href}
						href={link.href}
						className={`bottom-item${active ? ' bottom-item-active' : ''}`}
					>
						<span className="bottom-icon">{link.icon}</span>
						<span className="bottom-label">{link.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
