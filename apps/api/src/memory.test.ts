import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { MockDatabase } from './test-utils/mock-db.js';
import { Vault } from '@flowcart/vault';
import { deriveCsrfToken, hashToken } from '@flowcart/shared';

describe('Memory API Subsystem Tests (Phase 8)', () => {
  let app: FastifyInstance;
  let mockDb: MockDatabase;
  let vault: Vault;

  const csrfSecret = 'my_super_secure_csrf_secret_32_bytes!';
  const appUrl = 'http://localhost:3000';
  const encryptionKey = 'dGhpc2lzYTMyYnl0ZXNlY3JldGtleWZvcmZsb3djYXJ0IQ==';

  const testEnv: any = {
    NODE_ENV: 'test',
    APP_URL: appUrl,
    API_PORT: 4000,
    WEB_PORT: 3000,
    ALLOW_SIGNUPS: true,
    DATABASE_URL: 'postgres://flowcart:pass@localhost:5432/flowcart',
    REDIS_URL: 'redis://localhost:6379',
    APP_ENCRYPTION_KEY: encryptionKey,
    APP_ENCRYPTION_KEY_ID: 'k1',
    CSRF_SECRET: csrfSecret,
    SESSION_COOKIE_NAME: 'fc_sid',
    SESSION_IDLE_DAYS: 7,
    SESSION_ABSOLUTE_DAYS: 30,
    GOOGLE_CLIENT_ID: 'mock-google-client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'mock-google-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:4000/api/connections/gmail/callback',
    LLM_DEFAULT_PROVIDER: 'mock',
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
  };

  beforeEach(async () => {
    mockDb = new MockDatabase();
    const keyBuf = Buffer.from(encryptionKey, 'base64').subarray(0, 32);
    vault = new Vault({
      activeKeyId: 'k1',
      keys: {
        k1: Buffer.from(keyBuf),
      },
    });

    app = buildApp({
      env: testEnv,
      db: mockDb,
      vault,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  function createTestSession(userId: string) {
    const rawSessionId = 'test_session_cookie_' + userId;
    const idHash = hashToken(rawSessionId);
    mockDb.sessions.push({
      idHash,
      userId,
      expiresAt: new Date(Date.now() + 86400000),
      absoluteExpiresAt: new Date(Date.now() + 86400000 * 30),
      lastSeenAt: new Date(),
    });
    const csrfToken = deriveCsrfToken(idHash, csrfSecret);
    return { cookie: `fc_sid=${rawSessionId}`, csrfToken };
  }

  it('1. Rejects memory creation containing sensitive credit card or password information', async () => {
    mockDb.users.push({ id: 'usr_mem_1', email: 'user1@example.com', role: 'user' });
    const { cookie, csrfToken } = createTestSession('usr_mem_1');

    // Luhn credit card
    const cardRes = await app.inject({
      method: 'POST',
      url: '/api/memories',
      headers: { cookie, origin: appUrl, 'x-csrf-token': csrfToken },
      payload: {
        text: 'User credit card is 4532015012345674 for billing',
        category: 'preference',
      },
    });
    expect(cardRes.statusCode).toBe(400);
    expect(JSON.parse(cardRes.body).error.code).toBe('INVALID_MEMORY');

    // Password
    const pwRes = await app.inject({
      method: 'POST',
      url: '/api/memories',
      headers: { cookie, origin: appUrl, 'x-csrf-token': csrfToken },
      payload: {
        text: 'User password is SuperSecretPassword123!',
        category: 'profile',
      },
    });
    expect(pwRes.statusCode).toBe(400);
    expect(JSON.parse(pwRes.body).error.code).toBe('INVALID_MEMORY');
  });

  it('2. Successfully creates manual memory and returns 201', async () => {
    mockDb.users.push({ id: 'usr_mem_2', email: 'user2@example.com', role: 'user' });
    const { cookie, csrfToken } = createTestSession('usr_mem_2');

    const res = await app.inject({
      method: 'POST',
      url: '/api/memories',
      headers: { cookie, origin: appUrl, 'x-csrf-token': csrfToken },
      payload: {
        text: 'User prefers concise, bullet-pointed email responses.',
        category: 'style',
        importance: 4,
        pinned: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.memory.text).toBe('User prefers concise, bullet-pointed email responses.');
    expect(body.memory.category).toBe('style');
    expect(body.memory.importance).toBe(4);
    expect(body.memory.pinned).toBe(true);
    expect(body.memory.source).toBe('manual');
    expect(body.action).toBe('created');
  });

  it('3. Enforces strict user isolation on GET /api/memories', async () => {
    mockDb.users.push(
      { id: 'usr_mem_a', email: 'usera@example.com', role: 'user' },
      { id: 'usr_mem_b', email: 'userb@example.com', role: 'user' }
    );

    mockDb.memories.push(
      {
        id: 'mem_a_1',
        userId: 'usr_mem_a',
        text: 'User A works from London GMT timezone.',
        category: 'profile',
        importance: 5,
        pinned: false,
        source: 'manual',
        useCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'mem_b_1',
        userId: 'usr_mem_b',
        text: 'User B never checks email on weekends.',
        category: 'rule',
        importance: 5,
        pinned: true,
        source: 'manual',
        useCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );

    const sessionA = createTestSession('usr_mem_a');
    const resA = await app.inject({
      method: 'GET',
      url: '/api/memories',
      headers: { cookie: sessionA.cookie },
    });

    expect(resA.statusCode).toBe(200);
    const bodyA = JSON.parse(resA.body);
    expect(bodyA.total).toBe(1);
    expect(bodyA.memories).toHaveLength(1);
    expect(bodyA.memories[0].text).toContain('London');
    expect(bodyA.memories[0].text).not.toContain('weekends');

    const sessionB = createTestSession('usr_mem_b');
    const resB = await app.inject({
      method: 'GET',
      url: '/api/memory', // Test alias /api/memory
      headers: { cookie: sessionB.cookie },
    });

    expect(resB.statusCode).toBe(200);
    const bodyB = JSON.parse(resB.body);
    expect(bodyB.total).toBe(1);
    expect(bodyB.memories[0].text).toContain('weekends');
  });

  it('4. Filters memories by category and search query', async () => {
    mockDb.users.push({ id: 'usr_mem_3', email: 'user3@example.com', role: 'user' });
    const { cookie } = createTestSession('usr_mem_3');

    mockDb.memories.push(
      {
        id: 'mem_3_1',
        userId: 'usr_mem_3',
        text: 'User is CTO of Acme Corp.',
        category: 'profile',
        importance: 5,
        pinned: true,
        source: 'manual',
        useCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'mem_3_2',
        userId: 'usr_mem_3',
        text: 'Always sign emails with Kind regards, Malik.',
        category: 'style',
        importance: 4,
        pinned: false,
        source: 'manual',
        useCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );

    // Query by category
    const catRes = await app.inject({
      method: 'GET',
      url: '/api/memories?category=style',
      headers: { cookie },
    });
    expect(catRes.statusCode).toBe(200);
    const catBody = JSON.parse(catRes.body);
    expect(catBody.memories).toHaveLength(1);
    expect(catBody.memories[0].category).toBe('style');

    // Query by search keyword
    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/memories?q=CTO',
      headers: { cookie },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchBody = JSON.parse(searchRes.body);
    expect(searchBody.memories).toHaveLength(1);
    expect(searchBody.memories[0].text).toContain('CTO');
  });

  it('5. PATCH updates memory text and pin status with validation', async () => {
    mockDb.users.push({ id: 'usr_mem_4', email: 'user4@example.com', role: 'user' });
    const { cookie, csrfToken } = createTestSession('usr_mem_4');

    mockDb.memories.push({
      id: 'mem_4_1',
      userId: 'usr_mem_4',
      text: 'Draft replies in English.',
      category: 'style',
      importance: 3,
      pinned: false,
      source: 'manual',
      useCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const updateRes = await app.inject({
      method: 'PATCH',
      url: '/api/memories/mem_4_1',
      headers: { cookie, origin: appUrl, 'x-csrf-token': csrfToken },
      payload: {
        text: 'Draft replies in English and French.',
        pinned: true,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const body = JSON.parse(updateRes.body);
    expect(body.memory.text).toBe('Draft replies in English and French.');
    expect(body.memory.pinned).toBe(true);
  });

  it('6. DELETE physically removes memory from database', async () => {
    mockDb.users.push({ id: 'usr_mem_5', email: 'user5@example.com', role: 'user' });
    const { cookie, csrfToken } = createTestSession('usr_mem_5');

    mockDb.memories.push({
      id: 'mem_5_delete',
      userId: 'usr_mem_5',
      text: 'Temporary project alpha details.',
      category: 'project',
      importance: 2,
      pinned: false,
      source: 'manual',
      useCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/memories/mem_5_delete',
      headers: { cookie, origin: appUrl, 'x-csrf-token': csrfToken },
    });

    expect(delRes.statusCode).toBe(200);
    expect(JSON.parse(delRes.body).success).toBe(true);
    expect(mockDb.memories.find((m) => m.id === 'mem_5_delete')).toBeUndefined();
  });

  it('7. Forget Everything requires typed FORGET confirmation and records audit entry', async () => {
    mockDb.users.push({ id: 'usr_mem_6', email: 'user6@example.com', role: 'user' });
    const { cookie, csrfToken } = createTestSession('usr_mem_6');

    mockDb.memories.push(
      {
        id: 'mem_6_a',
        userId: 'usr_mem_6',
        text: 'User rule 1',
        category: 'rule',
        importance: 3,
        pinned: false,
        source: 'manual',
        useCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'mem_6_b',
        userId: 'usr_mem_6',
        text: 'User rule 2',
        category: 'rule',
        importance: 3,
        pinned: false,
        source: 'manual',
        useCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );

    // Fail without FORGET
    const wrongRes = await app.inject({
      method: 'DELETE',
      url: '/api/memories',
      headers: { cookie, origin: appUrl, 'x-csrf-token': csrfToken },
      payload: { confirm: 'yes' },
    });
    expect(wrongRes.statusCode).toBe(400);
    expect(JSON.parse(wrongRes.body).error.code).toBe('CONFIRMATION_REQUIRED');
    expect(mockDb.memories.filter((m) => m.userId === 'usr_mem_6')).toHaveLength(2);

    // Succeed with typed FORGET
    const okRes = await app.inject({
      method: 'DELETE',
      url: '/api/memories',
      headers: { cookie, origin: appUrl, 'x-csrf-token': csrfToken },
      payload: { confirm: 'FORGET' },
    });
    expect(okRes.statusCode).toBe(200);
    const okBody = JSON.parse(okRes.body);
    expect(okBody.success).toBe(true);
    expect(okBody.count).toBe(2);

    // Memories wiped
    expect(mockDb.memories.filter((m) => m.userId === 'usr_mem_6')).toHaveLength(0);

    // Audit log entry written
    const auditEntry = mockDb.auditLog.find((a) => a.userId === 'usr_mem_6');
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.action).toBe('forget_all_memories');
    expect(auditEntry?.detail?.deletedCount).toBe(2);
  });

  it('8. GET /api/memories/export exports all user memories as JSON', async () => {
    mockDb.users.push({ id: 'usr_mem_7', email: 'user7@example.com', role: 'user' });
    const { cookie } = createTestSession('usr_mem_7');

    mockDb.memories.push({
      id: 'mem_7_export',
      userId: 'usr_mem_7',
      text: 'Exportable memory about project gamma.',
      category: 'project',
      importance: 4,
      pinned: true,
      source: 'manual',
      useCount: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const exportRes = await app.inject({
      method: 'GET',
      url: '/api/memories/export',
      headers: { cookie },
    });

    expect(exportRes.statusCode).toBe(200);
    const body = JSON.parse(exportRes.body);
    expect(body.count).toBe(1);
    expect(body.exportedAt).toBeDefined();
    expect(body.memories[0].text).toBe('Exportable memory about project gamma.');
    expect(body.memories[0].embedding).toBeUndefined(); // vector omitted from clean export
  });
});
