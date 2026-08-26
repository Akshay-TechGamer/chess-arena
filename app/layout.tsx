import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import { SideRail } from '@/components/SideRail';
import './globals.css';

const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-mono' });

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
		<html lang="en" className={`${inter.variable} ${mono.variable}`}>
			<body>
				{adsenseClient && (
					<Script
						id="adsbygoogle-init"
						async
						src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
						crossOrigin="anonymous"
						strategy="afterInteractive"
					/>
				)}
				<SideRail />
				<SiteHeader />
				<main className="container">{children}</main>
			</body>
		</html>
	);
}
