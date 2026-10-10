import { describe, it, expect } from 'vitest';
import { validateEnv, envSchema } from './env.js';
import { randomBytes } from 'node:crypto';

describe('Environment Validation (Section 4)', () => {
  const validKey = randomBytes(32).toString('base64');
  const validBaseEnv = {
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:3000',
    API_PORT: '4000',
    WEB_PORT: '3000',
    DATABASE_URL: 'postgres://flowcart:pass@localhost:5432/flowcart',
    REDIS_URL: 'redis://localhost:6379',
    APP_ENCRYPTION_KEY: validKey,
    CSRF_SECRET: 'supersecretcsrfstringwithsufficientlength',
  };

  it('validates a complete valid environment configuration', () => {
    const env = validateEnv(validBaseEnv);
    expect(env.NODE_ENV).toBe('test');
    expect(env.API_PORT).toBe(4000);
    expect(env.APP_ENCRYPTION_KEY_ID).toBe('k1');
  });

  it('rejects an encryption key that is not exactly 32 bytes', () => {
    // 16 bytes key instead of 32
    const shortKey = randomBytes(16).toString('base64');
    expect(() =>
      validateEnv({
        ...validBaseEnv,
        APP_ENCRYPTION_KEY: shortKey,
      })
    ).toThrow(/APP_ENCRYPTION_KEY must be exactly 32 bytes/);
  });

  it('rejects missing DATABASE_URL or REDIS_URL', () => {
    expect(() =>
      validateEnv({
        ...validBaseEnv,
        DATABASE_URL: '',
      })
    ).toThrow(/DATABASE_URL is required/);

    expect(() =>
      validateEnv({
        ...validBaseEnv,
        REDIS_URL: '',
      })
    ).toThrow(/REDIS_URL is required/);
  });
});
