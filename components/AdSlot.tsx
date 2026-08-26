'use client';

// A single responsive Google AdSense display unit. Renders nothing until the
// publisher id (NEXT_PUBLIC_ADSENSE_CLIENT) and a slot id are configured, so the
// app stays ad-free locally and before AdSense approval.

import { useEffect } from 'react';

declare global {
	interface Window {
		adsbygoogle?: unknown[];
	}
}

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

interface AdSlotProps {
	/** The ad unit's slot id from the AdSense dashboard. */
	slot?: string;
	className?: string;
}

export function AdSlot({ slot, className }: AdSlotProps) {
	useEffect(() => {
		if (!CLIENT || !slot) {
			return;
		}
		try {
			(window.adsbygoogle = window.adsbygoogle || []).push({});
		} catch {
			// AdSense not loaded yet (e.g. blocked) — ignore.
		}
	}, [slot]);

	if (!CLIENT || !slot) {
		return null;
	}

	return (
		<div className={`ad-wrap${className ? ` ${className}` : ''}`}>
			<span className="ad-label">Advertisement</span>
			<ins
				className="adsbygoogle"
				style={{ display: 'block' }}
				data-ad-client={CLIENT}
				data-ad-slot={slot}
				data-ad-format="auto"
				data-full-width-responsive="true"
			/>
		</div>
	);
}
