'use client';

// Responsive header: inline nav on desktop, a slide-in drawer on mobile.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthButton } from '@/components/AuthButton';

const NAV_LINKS = [
	{ href: '/puzzles', label: 'Puzzle' },
	{ href: '/games', label: 'My games' },
	{ href: '/leaderboard', label: 'Leaderboard' },
];

export function SiteHeader() {
	const [open, setOpen] = useState(false);
	const pathname = usePathname();

	// Close the drawer on route change
	useEffect(() => {
		setOpen(false);
	}, [pathname]);

	// Lock body scroll while the drawer is open
	useEffect(() => {
		document.body.style.overflow = open ? 'hidden' : '';
		return () => {
			document.body.style.overflow = '';
		};
	}, [open]);

	return (
		<header className="site-header">
			<div className="site-nav">
				<button
					type="button"
					className="nav-toggle"
					aria-label="Open menu"
					aria-expanded={open}
					onClick={() => setOpen(true)}
				>
					☰
				</button>
				<Link href="/" className="site-logo">
					♞ Chess Arena
				</Link>
				<nav className="nav-inline">
					{NAV_LINKS.map((link) => (
						<Link key={link.href} href={link.href} className="nav-link">
							{link.label}
						</Link>
					))}
				</nav>
			</div>

			<div className="auth-desktop">
				<AuthButton />
			</div>

			{open && (
				<>
					<div className="drawer-backdrop" onClick={() => setOpen(false)} />
					<aside className="drawer" role="dialog" aria-label="Menu">
						<div className="drawer-head">
							<span className="site-logo">♞ Chess Arena</span>
							<button
								type="button"
								className="nav-toggle"
								aria-label="Close menu"
								onClick={() => setOpen(false)}
							>
								✕
							</button>
						</div>
						<nav className="drawer-nav">
							<Link href="/" className="drawer-link">
								Home
							</Link>
							{NAV_LINKS.map((link) => (
								<Link key={link.href} href={link.href} className="drawer-link">
									{link.label}
								</Link>
							))}
						</nav>
						<div className="drawer-auth">
							<AuthButton />
						</div>
					</aside>
				</>
			)}
		</header>
	);
}
