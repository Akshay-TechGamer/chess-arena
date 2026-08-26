import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Privacy Policy — Chess Arena',
	description: 'How Chess Arena handles your data and advertising cookies.',
};

export default function PrivacyPage() {
	return (
		<div className="doc-page">
			<h1 className="doc-title">Privacy Policy</h1>
			<p className="doc-updated">Last updated: 26 August 2026</p>

			<p>
				Chess Arena (&ldquo;we&rdquo;, &ldquo;the site&rdquo;) lets you play chess online,
				against the computer, or with a friend. This page explains what data we collect and how
				it is used.
			</p>

			<h2>What we store</h2>
			<ul>
				<li>
					<strong>Account and profile</strong>: if you sign in, we store your account id,
					username, and chess rating so games and leaderboards work. Guests get a temporary
					anonymous id.
				</li>
				<li>
					<strong>Game data</strong>: the moves, results, and chat of games you play, so games
					can resume and appear in your history.
				</li>
				<li>
					We never sell your personal data.
				</li>
			</ul>

			<h2>Advertising cookies</h2>
			<p>
				We use Google AdSense to show ads. Third-party vendors, including Google, use cookies to
				serve ads based on your prior visits to this and other websites. Google&rsquo;s use of
				advertising cookies enables it and its partners to serve ads to you based on your visits.
			</p>
			<ul>
				<li>
					You can opt out of personalised advertising by visiting{' '}
					<a href="https://www.google.com/settings/ads" target="_blank" rel="noreferrer noopener">
						Google Ads Settings
					</a>
					.
				</li>
				<li>
					You can opt out of some third-party vendor cookies at{' '}
					<a href="https://www.aboutads.info/choices/" target="_blank" rel="noreferrer noopener">
						aboutads.info/choices
					</a>
					.
				</li>
			</ul>

			<h2>Third-party services</h2>
			<ul>
				<li>Supabase — accounts, game storage, and realtime play.</li>
				<li>Google AdSense — advertising.</li>
				<li>Lichess — daily puzzle content.</li>
				<li>Vercel — hosting.</li>
			</ul>

			<h2>Contact</h2>
			<p>
				For any privacy question, contact the site owner. Using Chess Arena means you agree to
				this policy.
			</p>
		</div>
	);
}
