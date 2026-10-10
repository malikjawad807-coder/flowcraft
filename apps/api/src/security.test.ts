import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';

import { FastifyInstance } from 'fastify';
import { authenticator } from 'otplib';
import { buildApp } from './app.js';
import { MockDatabase } from './test-utils/mock-db.js';
import { Vault } from '@flowcart/vault';
import { deriveCsrfToken, hashToken, hashPassword } from '@flowcart/shared';

describe('Phase 9 Security, MFA & Admin Integration Tests (Section 12, 16 & 17.5)', () => {
  let app: FastifyInstance;
  let mockDb: MockDatabase;
  let vault: Vault;
  const csrfSecret = 'my_super_secure_csrf_secret_32_bytes!';
  const appUrl = 'http://localhost:3000';
  const keyBuf = Buffer.alloc(32, 1);
  const keyB64 = keyBuf.toString('base64');

  beforeEach(async () => {
    mockDb = new MockDatabase();
    vault = new Vault({
      activeKeyId: 'k1',
      keys: {
        k1: keyBuf,
      },
    });


    app = buildApp({
      env: {
        NODE_ENV: 'test',
        APP_URL: appUrl,
        API_PORT: 4000,
        WEB_PORT: 3000,
        ALLOW_SIGNUPS: true,
        DATABASE_URL: 'postgres://flowcart:pass@localhost:5432/flowcart',
        REDIS_URL: 'redis://localhost:6379',
        APP_ENCRYPTION_KEY: keyB64,
        APP_ENCRYPTION_KEY_ID: 'k1',
        CSRF_SECRET: csrfSecret,
        SESSION_COOKIE_NAME: 'fc_sid',
        SESSION_IDLE_DAYS: 7,
        SESSION_ABSOLUTE_DAYS: 30,
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        GOOGLE_REDIRECT_URI: '',
        LLM_DEFAULT_PROVIDER: 'openai',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
        GOOGLE_API_KEY: '',
        OLLAMA_BASE_URL: 'http://localhost:11434',
        LLM_MODEL_AGENT: 'gpt-4o',
        LLM_MODEL_FAST: 'gpt-4o-mini',
        EMBEDDING_PROVIDER: 'openai',
        EMBEDDING_MODEL: 'text-embedding-3-small',
        EMBEDDING_DIM: 1536,
        AGENT_MAX_ITERATIONS: 8,
        AGENT_RUN_TIMEOUT_MS: 120000,
        AGENT_COMMANDS_PER_HOUR: 30,
        EXECUTION_TIMEOUT_MS: 300000,
        EXECUTION_RETENTION_DAYS: 30,
        SMTP_HOST: '',
        SMTP_PORT: 587,
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_FROM: 'FlowCart <no-reply@localhost>',
      },
      db: mockDb,
      vault,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // Helper to create an active user session in mockDb
  async function createTestSession(userRole: 'admin' | 'user' = 'user') {
    const userId = randomUUID();
    const cookieVal = `mock_cookie_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const idHash = hashToken(cookieVal);
    const pwdHash = await hashPassword('SecurePassword123!');

    const user = {
      id: userId,
      email: `${userId}@example.com`,
      name: 'Test Subject',
      role: userRole,
      passwordHash: pwdHash,
      emailVerifiedAt: new Date(),
      disabledAt: null,
      failedLogins: 0,
      lockedUntil: null,
      timezone: 'UTC',
      createdAt: new Date(),
    };
    mockDb.users.push(user);

    const session = {
      idHash,
      userId,
      createdAt: new Date(),
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
      absoluteExpiresAt: new Date(Date.now() + 30 * 86400 * 1000),
      ip: '127.0.0.1',
      userAgent: 'Vitest/1.0',
    };
    mockDb.sessions.push(session);

    const csrf = deriveCsrfToken(idHash, csrfSecret);

    return {
      user,
      cookie: `fc_sid=${cookieVal}`,
      cookieVal,
      idHash,
      csrf,
    };
  }

  describe('1. Transport & CSRF Security (Section 12.1 & 17.5)', () => {
    it('enforces required security headers on responses (CSP, nosniff, etc.)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('rejects state-changing requests when Origin header is wrong (CSRF)', async () => {
      const session = await createTestSession();

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/profile',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: 'https://malicious-website.com',
        },
        payload: { name: 'Attacker' },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('CSRF_INVALID_ORIGIN');
    });

    it('rejects state-changing requests when CSRF token is missing (CSRF)', async () => {
      const session = await createTestSession();

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/auth/profile',
        headers: {
          cookie: session.cookie,
          origin: appUrl,
        },
        payload: { name: 'No CSRF' },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('CSRF_INVALID_TOKEN');
    });

    it('sets HttpOnly, Path=/, and SameSite=lax on session cookies', async () => {
      const pwd = await hashPassword('CorrectPassword123!');
      mockDb.users.push({
        id: randomUUID(),
        email: 'cookie@example.com',
        passwordHash: pwd,
        role: 'user',
        emailVerifiedAt: new Date(),
        failedLogins: 0,
        disabledAt: null,
        lockedUntil: null,
        createdAt: new Date(),
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: appUrl },
        payload: {
          email: 'cookie@example.com',
          password: 'CorrectPassword123!',
        },
      });

      expect(res.statusCode).toBe(204);
      const setCookie = res.headers['set-cookie'] as string;
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/');
    });
  });

  describe('2. TOTP MFA Subsystem (Section 6.8 & 13)', () => {
    it('sets up MFA returning a valid secret and QR code data URL', async () => {
      const session = await createTestSession();

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/setup',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.secret).toBeDefined();
      expect(body.qrCode).toMatch(/^data:image\/png;base64,/);

      // Verify staged in mockDb mfaFactors table
      const factor = mockDb.mfaFactors.find((f) => f.userId === session.user.id);
      expect(factor).toBeDefined();
      expect(factor.enabledAt).toBeNull();
    });

    it('rejects MFA enable with an invalid code', async () => {
      const session = await createTestSession();

      // Setup first
      await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/setup',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/enable',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
        payload: { code: '000000' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('INVALID_MFA_CODE');
    });

    it('enables MFA with valid code, returning 10 recovery codes', async () => {
      const session = await createTestSession();

      const setupRes = await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/setup',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
      });
      const { secret } = JSON.parse(setupRes.body);

      // Generate a valid TOTP token using otplib authenticator
      const validToken = authenticator.generate(secret);

      const enableRes = await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/enable',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
        payload: { code: validToken },
      });

      expect(enableRes.statusCode).toBe(200);
      const enableBody = JSON.parse(enableRes.body);
      expect(enableBody.recoveryCodes).toHaveLength(10);

      const factor = mockDb.mfaFactors.find((f) => f.userId === session.user.id);
      expect(factor.enabledAt).not.toBeNull();
      expect(factor.recoveryHashes).toHaveLength(10);
    });

    it('requires MFA code during login when enabled and verifies valid TOTP', async () => {
      const session = await createTestSession();

      // Setup and enable MFA
      const setupRes = await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/setup',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
      });
      const { secret } = JSON.parse(setupRes.body);
      const validToken = authenticator.generate(secret);
      await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/enable',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
        payload: { code: validToken },
      });

      // 1. Attempt login without MFA code -> returns 401 MFA_REQUIRED
      const step1Res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: appUrl },
        payload: {
          email: session.user.email,
          password: 'SecurePassword123!',
        },
      });
      expect(step1Res.statusCode).toBe(401);
      expect(JSON.parse(step1Res.body).error.code).toBe('MFA_REQUIRED');

      // 2. Attempt login with valid TOTP code -> returns 204
      const freshToken = authenticator.generate(secret);
      const step2Res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: appUrl },
        payload: {
          email: session.user.email,
          password: 'SecurePassword123!',
          totp: freshToken,
        },
      });
      expect(step2Res.statusCode).toBe(204);
    });

    it('allows login with a recovery code and consumes it as one-time use', async () => {
      const session = await createTestSession();

      const setupRes = await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/setup',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
      });
      const { secret } = JSON.parse(setupRes.body);
      const validToken = authenticator.generate(secret);

      const enableRes = await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/enable',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
        payload: { code: validToken },
      });
      const { recoveryCodes } = JSON.parse(enableRes.body);
      const testCode = recoveryCodes[0];

      // Login using recovery code
      const recLoginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: appUrl },
        payload: {
          email: session.user.email,
          password: 'SecurePassword123!',
          recoveryCode: testCode,
        },
      });
      expect(recLoginRes.statusCode).toBe(204);

      // Verify the recovery code has been consumed (remaining length = 9)
      const factor = mockDb.mfaFactors.find((f) => f.userId === session.user.id);
      expect(factor.recoveryHashes).toHaveLength(9);

      // Second attempt with the same code must fail
      const reuseRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: appUrl },
        payload: {
          email: session.user.email,
          password: 'SecurePassword123!',
          recoveryCode: testCode,
        },
      });
      expect(reuseRes.statusCode).toBe(401);
      expect(JSON.parse(reuseRes.body).error.code).toBe('INVALID_MFA_CODE');
    });

    it('disables MFA when verified with current password', async () => {
      const session = await createTestSession();

      // Setup and enable
      const setupRes = await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/setup',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
      });
      const { secret } = JSON.parse(setupRes.body);
      await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/enable',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
        payload: { code: authenticator.generate(secret) },
      });

      // Disable with wrong password -> fails
      const failRes = await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/disable',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
        payload: { password: 'WrongPassword!' },
      });
      expect(failRes.statusCode).toBe(401);

      // Disable with correct password -> succeeds
      const okRes = await app.inject({
        method: 'POST',
        url: '/api/auth/mfa/disable',
        headers: {
          cookie: session.cookie,
          'x-csrf-token': session.csrf,
          origin: appUrl,
        },
        payload: { password: 'SecurePassword123!' },
      });
      expect(okRes.statusCode).toBe(204);
      expect(mockDb.mfaFactors.find((f) => f.userId === session.user.id)).toBeUndefined();
    });
  });

  describe('3. Admin Endpoints & Role Authorization (Section 12.9 & 13)', () => {
    it('blocks regular non-admin users from accessing /api/admin/* (403 FORBIDDEN)', async () => {
      const userSession = await createTestSession('user');

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: {
          cookie: userSession.cookie,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error.code).toBe('FORBIDDEN');
    });

    it('allows admin users to view users list and queue stats', async () => {
      const adminSession = await createTestSession('admin');

      const usersRes = await app.inject({
        method: 'GET',
        url: '/api/admin/users',
        headers: {
          cookie: adminSession.cookie,
        },
      });
      expect(usersRes.statusCode).toBe(200);
      const userList = JSON.parse(usersRes.body).users;
      expect(Array.isArray(userList)).toBe(true);

      const queuesRes = await app.inject({
        method: 'GET',
        url: '/api/admin/queues',
        headers: {
          cookie: adminSession.cookie,
        },
      });
      expect(queuesRes.statusCode).toBe(200);
      const qBody = JSON.parse(queuesRes.body);
      expect(qBody.uptimeSeconds).toBeDefined();
    });

    it('admin can disable a user, revoking their active sessions', async () => {
      const adminSession = await createTestSession('admin');
      const targetUserSession = await createTestSession('user');

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/users/${targetUserSession.user.id}/disable`,
        headers: {
          cookie: adminSession.cookie,
          'x-csrf-token': adminSession.csrf,
          origin: appUrl,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);

      // Verify sessions purged for disabled user
      expect(mockDb.sessions.filter((s) => s.userId === targetUserSession.user.id)).toHaveLength(0);

      // Verify disabled user cannot access protected endpoints
      const checkRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: targetUserSession.cookie,
        },
      });
      expect(checkRes.statusCode).toBe(401);
    });

    it('admin cannot disable their own account', async () => {
      const adminSession = await createTestSession('admin');

      const res = await app.inject({
        method: 'POST',
        url: `/api/admin/users/${adminSession.user.id}/disable`,
        headers: {
          cookie: adminSession.cookie,
          'x-csrf-token': adminSession.csrf,
          origin: appUrl,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error.code).toBe('CANNOT_DISABLE_SELF');
    });

    it('admin can re-enable a disabled user', async () => {
      const adminSession = await createTestSession('admin');
      const targetUserSession = await createTestSession('user');

      // Disable
      await app.inject({
        method: 'POST',
        url: `/api/admin/users/${targetUserSession.user.id}/disable`,
        headers: {
          cookie: adminSession.cookie,
          'x-csrf-token': adminSession.csrf,
          origin: appUrl,
        },
      });

      // Re-enable
      const enableRes = await app.inject({
        method: 'POST',
        url: `/api/admin/users/${targetUserSession.user.id}/enable`,
        headers: {
          cookie: adminSession.cookie,
          'x-csrf-token': adminSession.csrf,
          origin: appUrl,
        },
      });

      expect(enableRes.statusCode).toBe(200);
      expect(JSON.parse(enableRes.body).success).toBe(true);

      const refreshedUser = mockDb.users.find((u) => u.id === targetUserSession.user.id);
      expect(refreshedUser.disabledAt).toBeNull();
    });
  });

  describe('4. Additional Section 17.5 Security Invariants', () => {
    it('rate limiting triggers and returns Retry-After header', async () => {
      // Consume login rate limits for a given IP
      for (let i = 0; i < 10; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/auth/login',
          headers: { origin: appUrl },
          payload: {
            email: 'ratelimit@example.com',
            password: 'WrongPassword123!',
          },
        });
      }

      // The 11th attempt must be rejected with 429 and Retry-After header
      const limitedRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: appUrl },
        payload: {
          email: 'ratelimit@example.com',
          password: 'WrongPassword123!',
        },
      });

      expect(limitedRes.statusCode).toBe(429);
      expect(limitedRes.headers['retry-after']).toBeDefined();
      expect(Number(limitedRes.headers['retry-after'])).toBeGreaterThan(0);
      expect(JSON.parse(limitedRes.body).error.code).toBe('RATE_LIMITED');
    });

    it('handles SQL injection strings in search queries safely without SQL errors', async () => {
      const session = await createTestSession();

      // Send classic SQL injection payloads into memory search
      const sqlInjections = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "UNION SELECT null, null, null--",
        "1' OR 1=1 /*",
      ];

      for (const payload of sqlInjections) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/memories?q=${encodeURIComponent(payload)}`,
          headers: {
            cookie: session.cookie,
          },
        });

        // Must return 200 with an empty or clean array, never a 500 SQL syntax error
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(Array.isArray(body.memories)).toBe(true);
      }
    });

    it('generates a fresh session ID on every login (session rotation)', async () => {
      const pwd = await hashPassword('RotationPassword123!');
      const userEmail = 'rotation@example.com';
      mockDb.users.push({
        id: randomUUID(),
        email: userEmail,
        passwordHash: pwd,
        role: 'user',
        emailVerifiedAt: new Date(),
        failedLogins: 0,
        disabledAt: null,
        lockedUntil: null,
        createdAt: new Date(),
      });

      // Login attempt 1
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: appUrl },
        payload: { email: userEmail, password: 'RotationPassword123!' },
      });
      expect(res1.statusCode).toBe(204);
      const cookie1 = res1.headers['set-cookie'];

      // Login attempt 2
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: appUrl },
        payload: { email: userEmail, password: 'RotationPassword123!' },
      });
      expect(res2.statusCode).toBe(204);
      const cookie2 = res2.headers['set-cookie'];

      // Cookies must be distinct random tokens
      expect(cookie1).not.toEqual(cookie2);
    });
  });
});

