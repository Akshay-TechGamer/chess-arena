'use client';

// Desktop-only vertical icon rail (hidden on smaller screens, where the
// header's inline nav / drawer takes over).

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const RAIL_LINKS = [
	{ href: '/', label: 'Home', icon: '♞' },
	{ href: '/puzzles', label: 'Puzzle', icon: '🧩' },
	{ href: '/games', label: 'Games', icon: '📋' },
	{ href: '/leaderboard', label: 'Ranks', icon: '🏆' },
];

export function SideRail() {
	const pathname = usePathname();
	return (
		<nav className="side-rail" aria-label="Primary">
			{RAIL_LINKS.map((link) => {
				const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
				return (
					<Link
						key={link.href}
						href={link.href}
						className={`rail-item${active ? ' rail-item-active' : ''}`}
					>
						<span className="rail-icon">{link.icon}</span>
						<span className="rail-label">{link.label}</span>
					</Link>
				);
			})}
		</nav>
	);
}
