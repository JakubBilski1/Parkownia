/**
 * Password rules live apart from the hashing code on purpose: the registration
 * form needs the minimum length to warn while the user types, and importing it
 * from `password.ts` would drag the native Argon2 binding into the browser
 * bundle.
 */
export const PASSWORD_MIN_LENGTH = 10;

/** Argon2 hashes the whole input; an unbounded password is a free CPU amplifier. */
export const PASSWORD_MAX_LENGTH = 128;
