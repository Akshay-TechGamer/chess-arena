// Invite code generation — pure logic (see AGENTS.md).

// No 0/O/1/I/L — unambiguous when read aloud or typed from a phone screen.
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

/**
 * Generates an invite code like "K3XT7M".
 * randomValue: function returning a float in [0, 1) — injectable for tests.
 */
export function generateInviteCode(randomValue: () => number = Math.random): string {
	let code = '';
	for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
		const index = Math.floor(randomValue() * INVITE_ALPHABET.length);
		code += INVITE_ALPHABET[Math.min(index, INVITE_ALPHABET.length - 1)];
	}
	return code;
}

/** Normalizes user input: trims surrounding space and uppercases. */
export function normalizeInviteCode(input: string): string {
	return input.trim().toUpperCase();
}

export function isValidInviteCode(code: string): boolean {
	if (code.length !== INVITE_CODE_LENGTH) {
		return false;
	}
	for (const char of code) {
		if (!INVITE_ALPHABET.includes(char)) {
			return false;
		}
	}
	return true;
}
