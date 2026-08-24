import { describe, expect, it } from 'vitest';
import {
	INVITE_ALPHABET,
	INVITE_CODE_LENGTH,
	generateInviteCode,
	isValidInviteCode,
	normalizeInviteCode,
} from './invite';

describe('generateInviteCode', () => {
	it('generates codes of the right length and alphabet', () => {
		const code = generateInviteCode();
		expect(code).toHaveLength(INVITE_CODE_LENGTH);
		expect(isValidInviteCode(code)).toBe(true);
	});

	it('is deterministic for an injected random source', () => {
		expect(generateInviteCode(() => 0)).toBe('AAAAAA');
		const last = INVITE_ALPHABET[INVITE_ALPHABET.length - 1];
		expect(generateInviteCode(() => 0.999999)).toBe(last.repeat(INVITE_CODE_LENGTH));
	});

	it('never emits ambiguous characters', () => {
		for (let i = 0; i < 200; i++) {
			expect(generateInviteCode()).not.toMatch(/[0O1IL]/);
		}
	});
});

describe('normalizeInviteCode', () => {
	it('trims and uppercases', () => {
		expect(normalizeInviteCode('  k3xt7m ')).toBe('K3XT7M');
	});
});

describe('isValidInviteCode', () => {
	it('accepts a valid code', () => {
		expect(isValidInviteCode('K3XT7M')).toBe(true);
	});

	it('rejects wrong length', () => {
		expect(isValidInviteCode('K3X')).toBe(false);
		expect(isValidInviteCode('K3XT7MA')).toBe(false);
	});

	it('rejects characters outside the alphabet', () => {
		expect(isValidInviteCode('K3XT70')).toBe(false);
		expect(isValidInviteCode('k3xt7m')).toBe(false);
	});
});
