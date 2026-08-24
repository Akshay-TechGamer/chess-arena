import type { Metadata } from 'next';
import Link from 'next/link';
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
					<Link href="/" className="site-logo">
						♞ Chess Arena
					</Link>
				</header>
				<main className="container">{children}</main>
			</body>
		</html>
	);
}
