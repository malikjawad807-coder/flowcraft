import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  generateEmailToken,
  hashToken,
  generateSession,
  deriveCsrfToken,
  verifyCsrfToken,
  signupSchema,
  normalizeEmail,
} from './auth.js';
import argon2 from 'argon2';

describe('Authentication & Cryptography Helpers (Section 6.1)', () => {
  const password = 'CorrectHorseBatteryStaple123!';

  it('normalizes emails by trimming and lowercasing', () => {
    expect(normalizeEmail('  User.NAME@Example.COM  ')).toBe('user.name@example.com');
  });

  it('hashes and verifies passwords using argon2id with strict parameters', async () => {
    const hash = await hashPassword(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, 'WrongPassword123!')).toBe(false);
  });

  it('detects when a hash needs re-hashing due to outdated parameters', async () => {
    // Generate with 1 iteration (outdated)
    const outdatedHash = await argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: 1,
      memoryCost: 1024,
      parallelism: 1,
    });
    expect(needsRehash(outdatedHash)).toBe(true);

    const modernHash = await hashPassword(password);
    expect(needsRehash(modernHash)).toBe(false);
  });

  it('rejects passwords shorter than 10 characters or in common password list', () => {
    // Too short (9 chars)
    expect(() =>
      signupSchema.parse({ email: 'test@example.com', password: 'Short1234' })
    ).toThrow(/at least 10 characters/);

    // Common password
    expect(() =>
      signupSchema.parse({ email: 'test@example.com', password: 'password123' })
    ).toThrow(/too common/);

    // Valid password
    const valid = signupSchema.parse({ email: 'test@example.com', password: 'SecurePassword123!' });
    expect(valid.email).toBe('test@example.com');
  });

  it('generates secure 32-byte tokens and sha256 hashes for email verification', () => {
    const { rawToken, tokenHash } = generateEmailToken();
    expect(typeof rawToken).toBe('string');
    expect(tokenHash).toBe(hashToken(rawToken));
    expect(rawToken.length).toBeGreaterThanOrEqual(40);
  });

  it('generates unique sessions with hex cookie values and sha256 id_hash', () => {
    const s1 = generateSession();
    const s2 = generateSession();
    expect(s1.cookieValue).not.toBe(s2.cookieValue);
    expect(s1.idHash).toBe(hashToken(s1.cookieValue));
  });

  it('derives and verifies HMAC-SHA256 CSRF tokens correctly', () => {
    const sessionId = 'session_hex_id_abc123';
    const csrfSecret = 'my_super_secure_csrf_secret_32_bytes!';

    const token = deriveCsrfToken(sessionId, csrfSecret);
    expect(verifyCsrfToken(token, sessionId, csrfSecret)).toBe(true);
    expect(verifyCsrfToken(token, 'different_session', csrfSecret)).toBe(false);
    expect(verifyCsrfToken(token, sessionId, 'wrong_secret')).toBe(false);
  });
});
