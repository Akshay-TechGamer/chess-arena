import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SideRail } from '@/components/SideRail';
import './globals.css';

export const metadata: Metadata = {
	title: 'Chess Arena',
	description: 'Play chess online with friends or against the computer.',
	manifest: '/manifest.webmanifest',
	appleWebApp: {
		capable: true,
		title: 'Chess Arena',
		statusBarStyle: 'black-translucent',
	},
};

export const viewport = {
	themeColor: '#051424',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body>
				<SideRail />
				<SiteHeader />
				<main className="container">{children}</main>
			</body>
		</html>
	);
}
