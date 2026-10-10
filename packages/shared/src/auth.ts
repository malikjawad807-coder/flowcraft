import argon2 from 'argon2';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export * from './auth-schemas.js';

export const ARGON2_CONFIG = {
  type: 2 as const, // argon2id
  memoryCost: 19456, // 19 MiB
  timeCost: 2,       // 2 iterations
  parallelism: 1,    // 1 lane
};

/**
 * Hashes password using argon2id with strict parameters
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_CONFIG);
}

/**
 * Verifies password against argon2id hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Checks if the stored hash was generated with outdated parameters
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_CONFIG);
}

/**
 * Generates raw 32-byte URL-safe verification/reset token
 */
export function generateEmailToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Generates sha256 hash of a token
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a fresh 32-byte session cookie value and its sha256 id_hash
 */
export function generateSession(): { cookieValue: string; idHash: string } {
  const cookieValue = randomBytes(32).toString('hex');
  const idHash = hashToken(cookieValue);
  return { cookieValue, idHash };
}

/**
 * Derives CSRF token using HMAC-SHA256(sessionId, CSRF_SECRET)
 */
export function deriveCsrfToken(sessionId: string, csrfSecret: string): string {
  return createHmac('sha256', csrfSecret).update(sessionId).digest('hex');
}

/**
 * Constant-time verification of CSRF token
 */
export function verifyCsrfToken(token: string, sessionId: string, csrfSecret: string): boolean {
  if (!token || !sessionId || !csrfSecret) return false;
  try {
    const expected = deriveCsrfToken(sessionId, csrfSecret);
    const tokenBuf = Buffer.from(token, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (tokenBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(tokenBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Generates 10 cryptographically random recovery codes in format xxxxx-xxxxx
 */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString('hex'); // 10 alphanumeric hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

/**
 * Normalizes and computes SHA-256 hash of a recovery code
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return hashToken(normalized);
}



