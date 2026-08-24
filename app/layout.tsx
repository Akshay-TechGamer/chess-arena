import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthButton } from '@/components/AuthButton';
import './globals.css';

export const metadata: Metadata = {
	title: 'Chess Arena',
	description: 'Play chess online with friends or against the computer.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body>
				<header className="site-header">
					<div className="site-nav">
						<Link href="/" className="site-logo">
							♞ Chess Arena
						</Link>
						<Link href="/games" className="nav-link">
							My games
						</Link>
						<Link href="/leaderboard" className="nav-link">
							Leaderboard
						</Link>
					</div>
					<AuthButton />
				</header>
				<main className="container">{children}</main>
			</body>
		</html>
	);
}
