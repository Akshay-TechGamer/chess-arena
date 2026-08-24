// Proxies the Lichess daily puzzle (avoids browser CORS, adds caching).
// Puzzle data © lichess.org, served under CC0.

import { NextResponse } from 'next/server';

export const revalidate = 3600; // one puzzle a day; re-fetch hourly is plenty

export async function GET() {
	const response = await fetch('https://lichess.org/api/puzzle/daily', {
		headers: { Accept: 'application/json' },
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
