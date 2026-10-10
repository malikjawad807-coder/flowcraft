import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { MockDatabase } from './test-utils/mock-db.js';
import { Vault } from '@flowcart/vault';
import { deriveCsrfToken, hashToken } from '@flowcart/shared';

describe('Settings & Usage API Subsystem Tests (Phase 6)', () => {
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

  it('1. GET /api/settings returns settings without exposing personal API keys', async () => {
    mockDb.users.push({
      id: 'usr_set_1',
      email: 'settingsuser@example.com',
      role: 'user',
      timezone: 'America/New_York',
    });
    const { cookie } = createTestSession('usr_set_1');

    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe('settingsuser@example.com');
    expect(body.user.timezone).toBe('America/New_York');
    expect(body.settings.hasPersonalKey).toBe(false);
    expect(body.settings.autoSendEnabled).toBe(false);
    expect(body.settings.personalApiKey).toBeUndefined(); // Never exposed
  });

  it('2. PUT /api/settings updates provider, auto-send, and encrypts write-only personal key', async () => {
    mockDb.users.push({
      id: 'usr_set_2',
      email: 'apikeyuser@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie, csrfToken } = createTestSession('usr_set_2');

    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: {
        cookie,
        origin: appUrl,
        'x-csrf-token': csrfToken,
      },
      payload: {
        llmProvider: 'anthropic',
        personalApiKey: 'sk-ant-api03-secret-key-12345',
        autoSendEnabled: true,
        signature: '-- Best regards, Bob',
        name: 'Bob Vance',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.settings.llmProvider).toBe('anthropic');
    expect(body.settings.hasPersonalKey).toBe(true);
    expect(body.settings.autoSendEnabled).toBe(true);
    expect(body.settings.personalApiKey).toBeUndefined();

    // Verify key was encrypted in DB
    const savedSetting = mockDb.userSettings.find((s) => s.userId === 'usr_set_2');
    expect(savedSetting).toBeDefined();
    expect(savedSetting.llmKeyEnc).not.toBe('sk-ant-api03-secret-key-12345');
    expect(savedSetting.llmKeyEnc).toContain('.');

    // Verify decryption with vault AAD recovers original secret
    const decrypted = vault.decrypt(savedSetting.llmKeyEnc, 'user_settings:llm_key:usr_set_2');
    expect(decrypted).toBe('sk-ant-api03-secret-key-12345');
  });

  it('3. POST /api/settings/test-llm verifies connectivity', async () => {
    mockDb.users.push({
      id: 'usr_set_3',
      email: 'tester@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie, csrfToken } = createTestSession('usr_set_3');

    const res = await app.inject({
      method: 'POST',
      url: '/api/settings/test-llm',
      headers: {
        cookie,
        origin: appUrl,
        'x-csrf-token': csrfToken,
      },
      payload: {
        provider: 'mock',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.provider).toBe('mock');
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('4. GET /api/usage returns aggregated daily and purpose metrics', async () => {
    mockDb.users.push({
      id: 'usr_usage_1',
      email: 'usageuser@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie } = createTestSession('usr_usage_1');

    mockDb.usageEvents.push(
      {
        id: 1,
        userId: 'usr_usage_1',
        provider: 'openai',
        model: 'gpt-4o-mini',
        purpose: 'classify',
        tokensIn: 150,
        tokensOut: 30,
        at: new Date(),
      },
      {
        id: 2,
        userId: 'usr_usage_1',
        provider: 'openai',
        model: 'gpt-4o',
        purpose: 'agent',
        tokensIn: 800,
        tokensOut: 200,
        at: new Date(),
      }
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/usage',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.summary.totalTokensIn).toBe(950);
    expect(body.summary.totalTokensOut).toBe(230);
    expect(body.summary.totalTokens).toBe(1180);
    expect(body.summary.totalCalls).toBe(2);
    expect(body.byPurpose.classify.tokensIn).toBe(150);
    expect(body.byPurpose.agent.tokensIn).toBe(800);
    expect(body.daily).toHaveLength(1);
  });
});
