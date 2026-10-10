import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { MockDatabase } from './test-utils/mock-db.js';
import { deriveCsrfToken, hashToken, hashPassword } from '@flowcart/shared';

describe('Auth Subsystem Integration Tests (Section 6 & 17.3)', () => {
  let app: FastifyInstance;
  let mockDb: MockDatabase;
  const csrfSecret = 'my_super_secure_csrf_secret_32_bytes!';
  const appUrl = 'http://localhost:3000';

  beforeEach(async () => {
    mockDb = new MockDatabase();
    app = buildApp({
      env: {
        NODE_ENV: 'test',
        APP_URL: appUrl,
        API_PORT: 4000,
        WEB_PORT: 3000,
        ALLOW_SIGNUPS: true,
        DATABASE_URL: 'postgres://flowcart:pass@localhost:5432/flowcart',
        REDIS_URL: 'redis://localhost:6379',
        APP_ENCRYPTION_KEY: 'dGhpc2lzYTMyYnl0ZXNlY3JldGtleWZvcmZsb3djYXJ0IQ==',
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
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('blocks state-changing requests with invalid Origin (CSRF protection)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: {
        origin: 'https://evil-attacker.com',
      },
      payload: {
        email: 'alice@example.com',
        password: 'ValidPassword123!',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('CSRF_INVALID_ORIGIN');
  });

  it('signs up the first user as admin and creates email verification token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin: appUrl },
      payload: {
        email: 'alice@example.com',
        password: 'CorrectPassword123!',
        name: 'Alice Admin',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(mockDb.users.length).toBe(1);
    expect(mockDb.users[0].email).toBe('alice@example.com');
    expect(mockDb.users[0].role).toBe('admin'); // First user is admin
    expect(mockDb.emailTokens.length).toBe(1);
    expect(mockDb.emailTokens[0].purpose).toBe('verify');
  });

  it('rejects passwords shorter than 10 chars or on common-passwords list', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/signup',
      headers: { origin: appUrl },
      payload: {
        email: 'bob@example.com',
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('prevents login if email is unverified', async () => {
    const hash = await hashPassword('CorrectPassword123!');
    mockDb.users.push({
      id: 'usr_1',
      email: 'alice@example.com',
      passwordHash: hash,
      role: 'admin',
      failedLogins: 0,
      emailVerifiedAt: null, // Unverified
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: appUrl },
      payload: {
        email: 'alice@example.com',
        password: 'CorrectPassword123!',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('successfully logs in verified user and issues session cookie', async () => {
    const hash = await hashPassword('CorrectPassword123!');
    mockDb.users.push({
      id: 'usr_1',
      email: 'alice@example.com',
      name: 'Alice',
      passwordHash: hash,
      role: 'admin',
      failedLogins: 0,
      emailVerifiedAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: appUrl },
      payload: {
        email: 'alice@example.com',
        password: 'CorrectPassword123!',
      },
    });

    expect(res.statusCode).toBe(204);
    const cookieHeader = res.headers['set-cookie'] as string;
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain('fc_sid=');
    expect(cookieHeader).toContain('HttpOnly');
    expect(mockDb.sessions.length).toBe(1);
  });

  it('increments failed logins and locks account after 5 failed attempts', async () => {
    const hash = await hashPassword('CorrectPassword123!');
    mockDb.users.push({
      id: 'usr_1',
      email: 'alice@example.com',
      passwordHash: hash,
      role: 'admin',
      failedLogins: 4,
      emailVerifiedAt: new Date(),
    });

    // 5th failed attempt triggers lockout
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: appUrl },
      payload: {
        email: 'alice@example.com',
        password: 'WrongPassword!',
      },
    });

    expect(res.statusCode).toBe(401);
    expect(mockDb.users[0].failedLogins).toBe(5);
    expect(mockDb.users[0].lockedUntil).toBeDefined();

    // Subsequent attempt is blocked with 429 ACCOUNT_LOCKED
    const lockedRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { origin: appUrl },
      payload: {
        email: 'alice@example.com',
        password: 'CorrectPassword123!',
      },
    });

    expect(lockedRes.statusCode).toBe(429);
    const lockedBody = JSON.parse(lockedRes.body);
    expect(lockedBody.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('IDOR boundary test: User B cannot revoke User A session', async () => {
    // User A session
    const sessionCookieA = '1111111111111111111111111111111111111111111111111111111111111111';
    const sessionHashA = hashToken(sessionCookieA);
    mockDb.sessions.push({
      idHash: sessionHashA,
      userId: 'usr_A',
      expiresAt: new Date(Date.now() + 100000),
      absoluteExpiresAt: new Date(Date.now() + 100000),
      lastSeenAt: new Date(),
    });

    // User B session
    const sessionCookieB = '2222222222222222222222222222222222222222222222222222222222222222';
    const sessionHashB = hashToken(sessionCookieB);
    mockDb.sessions.push({
      idHash: sessionHashB,
      userId: 'usr_B',
      expiresAt: new Date(Date.now() + 100000),
      absoluteExpiresAt: new Date(Date.now() + 100000),
      lastSeenAt: new Date(),
    });

    mockDb.users.push(
      { id: 'usr_A', email: 'a@example.com', emailVerifiedAt: new Date() },
      { id: 'usr_B', email: 'b@example.com', emailVerifiedAt: new Date() }
    );

    const csrfB = deriveCsrfToken(sessionHashB, csrfSecret);

    // User B attempts to delete User A's session
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/auth/sessions/${sessionHashA}`,
      headers: {
        origin: appUrl,
        'x-csrf-token': csrfB,
        cookie: `fc_sid=${sessionCookieB}`,
      },
    });

    expect(res.statusCode).toBe(204);
    // User A's session MUST still exist in database
    const userASession = mockDb.sessions.find((s) => s.idHash === sessionHashA);
    expect(userASession).toBeDefined();
  });
});
