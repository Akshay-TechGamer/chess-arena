// Proxies the Lichess daily puzzle (avoids browser CORS, adds caching).
// Puzzle data © lichess.org, served under CC0.

import { NextResponse } from 'next/server';

// Run only at request time — never prerender at build (the build sandbox has
// no outbound network, so fetching Lichess during build fails the deploy).
export const dynamic = 'force-dynamic';

export async function GET() {
	const response = await fetch('https://lichess.org/api/puzzle/daily', {
		headers: { Accept: 'application/json' },
		// cache the upstream response for an hour at request time
		next: { revalidate: 3600 },
	});
	if (!response.ok) {
		return NextResponse.json(
			{ error: `Lichess responded ${response.status}` },
			{ status: 502 },
		);
	}
	const data = await response.json();
	return NextResponse.json(data);
}
