'use client';

// Header auth widget: shows who you are, offers Google sign-in and sign-out.
// Guests keep playing anonymously; Google gives them a permanent identity.

import { useEffect, useState } from 'react';
import { ensureProfile, isGuestUser } from '@/lib/data/authRepo';
import { getSupabase } from '@/lib/data/supabaseClient';

interface AuthView {
	username: string;
	isGuest: boolean;
}

export function AuthButton() {
	const [view, setView] = useState<AuthView | null>(null);

	useEffect(() => {
		const supabase = getSupabase();
		let cancelled = false;

		const refresh = async () => {
			const { data } = await supabase.auth.getSession();
			const user = data.session?.user;
			if (!user) {
				if (!cancelled) {
					setView(null);
				}
				return;
			}
			const profile = await ensureProfile(user);
			if (!cancelled) {
				setView({ username: profile.username, isGuest: isGuestUser(user) });
			}
		};

		void refresh();
		const { data: sub } = supabase.auth.onAuthStateChange(() => {
			void refresh();
		});
		return () => {
			cancelled = true;
			sub.subscription.unsubscribe();
		};
	}, []);

	const signInWithGoogle = () => {
		void getSupabase().auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: window.location.href },
		});
	};

	const signOut = () => {
		void getSupabase()
			.auth.signOut()
			.then(() => setView(null));
	};

	return (
		<div className="auth-box">
			{view && <span className="auth-name">♟ {view.username}</span>}
			{(!view || view.isGuest) && (
				<button type="button" className="btn btn-small" onClick={signInWithGoogle}>
					Sign in with Google
				</button>
			)}
			{view && !view.isGuest && (
				<button type="button" className="btn btn-small" onClick={signOut}>
					Sign out
				</button>
			)}
		</div>
	);
}
