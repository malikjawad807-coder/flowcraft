import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { MockDatabase } from './test-utils/mock-db.js';
import { Vault } from '@flowcart/vault';
import { deriveCsrfToken, hashToken, hashPassword } from '@flowcart/shared';
import { GmailTokenService } from './services/gmail-token.service.js';
import * as gmailPackage from '@flowcart/gmail';

describe('Gmail Connection Subsystem Tests (Section 7 & 17.4)', () => {
  let app: FastifyInstance;
  let mockDb: MockDatabase;
  let vault: Vault;
  let gmailTokenService: GmailTokenService;

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
    gmailTokenService = new GmailTokenService(mockDb, vault, testEnv);

    app = buildApp({
      env: testEnv,
      db: mockDb,
      vault,
      gmailTokenService,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
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

  it('1. GET /api/connections/gmail/auth-url generates consent URL with PKCE and state token', async () => {
    mockDb.users.push({
      id: 'usr_1',
      email: 'user1@example.com',
      role: 'user',
    });
    const { cookie } = createTestSession('usr_1');

    const res = await app.inject({
      method: 'GET',
      url: '/api/connections/gmail/auth-url',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.authUrl).toBeDefined();
    expect(body.authUrl).toContain('accounts.google.com');
    expect(body.authUrl).toContain('access_type=offline');
    expect(body.authUrl).toContain('prompt=consent');
    expect(body.authUrl).toContain('code_challenge=');

    // Verify state was saved with encrypted code verifier
    expect(mockDb.oauthStates.length).toBe(1);
    expect(mockDb.oauthStates[0].userId).toBe('usr_1');
    expect(mockDb.oauthStates[0].codeVerifierEnc).toBeDefined();
  });

  it('2. GET /api/connections/gmail/callback handles token exchange, profile lookup, and vault encryption', async () => {
    mockDb.users.push({
      id: 'usr_1',
      email: 'user1@example.com',
      role: 'user',
    });

    const rawState = 'state_xyz123';
    const stateHash = hashToken(rawState);
    const codeVerifierEnc = vault.encrypt('mock_verifier_123', 'usr_1:oauth_code_verifier');

    mockDb.oauthStates.push({
      stateHash,
      userId: 'usr_1',
      codeVerifierEnc,
      purpose: 'gmail_connect',
      expiresAt: new Date(Date.now() + 600000),
    });

    // Mock exchangeCodeForTokens and getProfile from @flowcart/gmail
    vi.spyOn(gmailPackage, 'exchangeCodeForTokens').mockResolvedValueOnce({
      access_token: 'mock_access_token_1',
      refresh_token: 'mock_refresh_token_1',
      expiry_date: Date.now() + 3600000,
      scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
    });

    vi.spyOn(gmailPackage, 'getProfile').mockResolvedValueOnce({
      emailAddress: 'alice.work@gmail.com',
      messagesTotal: 100,
      threadsTotal: 50,
      historyId: '1',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/connections/gmail/callback?code=google_auth_code_123&state=${rawState}`,
    });

    // Should redirect user back to settings with success query
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('/settings/connections?connected=gmail');
    expect(res.headers.location).toContain('alice.work%40gmail.com');

    // Integration record saved
    expect(mockDb.integrations.length).toBe(1);
    const saved = mockDb.integrations[0];
    expect(saved.userId).toBe('usr_1');
    expect(saved.accountEmail).toBe('alice.work@gmail.com');
    expect(saved.status).toBe('active');

    // Refresh token is encrypted in vault with AAD
    const decrypted = vault.decrypt(saved.refreshTokenEnc, 'usr_1:gmail_refresh_token');
    expect(decrypted).toBe('mock_refresh_token_1');

    // Used state must be deleted
    expect(mockDb.oauthStates.length).toBe(0);
  });

  it('2b. GET /api/integrations/google/callback also works as an alias callback route', async () => {
    const rawState = 'state_alias_test';
    const stateHash = hashToken(rawState);
    const codeVerifierEnc = vault.encrypt('mock_verifier_alias', 'usr_1:oauth_code_verifier');

    mockDb.oauthStates.push({
      stateHash,
      userId: 'usr_1',
      codeVerifierEnc,
      purpose: 'gmail_connect',
      expiresAt: new Date(Date.now() + 600000),
    });

    vi.spyOn(gmailPackage, 'exchangeCodeForTokens').mockResolvedValueOnce({
      access_token: 'mock_access_token_alias',
      refresh_token: 'mock_refresh_token_alias',
      expiry_date: Date.now() + 3600000,
      scope: 'https://www.googleapis.com/auth/gmail.send',
    });

    vi.spyOn(gmailPackage, 'getProfile').mockResolvedValueOnce({
      emailAddress: 'bob.alias@gmail.com',
      messagesTotal: 50,
      threadsTotal: 25,
      historyId: '2',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/integrations/google/callback?code=google_auth_code_alias&state=${rawState}`,
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('/settings/connections?connected=gmail');
    expect(res.headers.location).toContain('bob.alias%40gmail.com');
  });

  it('3. GET /api/connections lists user connections and redacts secrets', async () => {
    mockDb.users.push({ id: 'usr_1', email: 'user1@example.com', role: 'user' });
    const { cookie } = createTestSession('usr_1');

    mockDb.integrations.push({
      id: 'conn_1',
      userId: 'usr_1',
      provider: 'google',
      accountEmail: 'alice@company.com',
      scopes: ['gmail.send'],
      refreshTokenEnc: 'enc_secret_123',
      accessTokenEnc: 'enc_access_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/connections',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.length).toBe(1);
    expect(body[0].accountEmail).toBe('alice@company.com');
    expect(body[0].refreshTokenEnc).toBeUndefined();
    expect(body[0].accessTokenEnc).toBeUndefined();
  });

  it('4. Mutex: 5 concurrent token requests only execute a single refresh call', async () => {
    const rawRefreshToken = 'valid_refresh_token_abc';
    const refreshTokenEnc = vault.encrypt(rawRefreshToken, 'usr_1:gmail_refresh_token');

    mockDb.integrations.push({
      id: 'conn_1',
      userId: 'usr_1',
      provider: 'google',
      accountEmail: 'alice@company.com',
      scopes: ['gmail.send'],
      refreshTokenEnc,
      accessTokenEnc: null,
      accessExpiresAt: null, // Expired / missing
      status: 'active',
    });

    let refreshCallCount = 0;
    vi.spyOn(gmailPackage, 'createOAuth2Client').mockReturnValue({
      setCredentials: vi.fn(),
      refreshAccessToken: vi.fn().mockImplementation(async () => {
        refreshCallCount++;
        // Small artificial delay to test concurrency
        await new Promise((r) => setTimeout(r, 25));
        return {
          credentials: {
            access_token: 'brand_new_access_token_' + refreshCallCount,
            expiry_date: Date.now() + 3600000,
          },
        };
      }),
    } as any);

    // Launch 5 concurrent getAccessToken calls simultaneously
    const results = await Promise.all([
      gmailTokenService.getAccessToken('conn_1', 'usr_1'),
      gmailTokenService.getAccessToken('conn_1', 'usr_1'),
      gmailTokenService.getAccessToken('conn_1', 'usr_1'),
      gmailTokenService.getAccessToken('conn_1', 'usr_1'),
      gmailTokenService.getAccessToken('conn_1', 'usr_1'),
    ]);

    // Mutex ensured exactly ONE refresh occurred
    expect(refreshCallCount).toBe(1);
    // All 5 callers received the exact same access token
    expect(results.every((token) => token === 'brand_new_access_token_1')).toBe(true);
  });

  it('5. Marks integration status as revoked when Google returns invalid_grant', async () => {
    const rawRefreshToken = 'revoked_token_xyz';
    const refreshTokenEnc = vault.encrypt(rawRefreshToken, 'usr_1:gmail_refresh_token');

    mockDb.integrations.push({
      id: 'conn_1',
      userId: 'usr_1',
      provider: 'google',
      accountEmail: 'alice@company.com',
      scopes: ['gmail.send'],
      refreshTokenEnc,
      status: 'active',
    });

    vi.spyOn(gmailPackage, 'createOAuth2Client').mockReturnValue({
      setCredentials: vi.fn(),
      refreshAccessToken: vi.fn().mockRejectedValue(new Error('invalid_grant: Token has been expired or revoked')),
    } as any);

    await expect(gmailTokenService.getAccessToken('conn_1', 'usr_1')).rejects.toThrow(
      /revoked/i
    );

    // Database record must have updated to 'revoked'
    expect(mockDb.integrations[0].status).toBe('revoked');
  });

  it('6. IDOR boundary: User B cannot test or disconnect User A connection', async () => {
    mockDb.users.push({ id: 'usr_A', email: 'a@example.com', role: 'user' });
    mockDb.users.push({ id: 'usr_B', email: 'b@example.com', role: 'user' });

    mockDb.integrations.push({
      id: 'conn_A',
      userId: 'usr_A',
      provider: 'google',
      accountEmail: 'a@company.com',
      scopes: [],
      refreshTokenEnc: 'enc',
      status: 'active',
    });

    const userB = createTestSession('usr_B');

    // User B tries to test User A's connection
    const testRes = await app.inject({
      method: 'POST',
      url: '/api/connections/conn_A/test',
      headers: {
        cookie: userB.cookie,
        origin: appUrl,
        'x-csrf-token': userB.csrfToken,
      },
    });

    expect(testRes.statusCode).toBe(404);

    // User B tries to delete User A's connection
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/connections/conn_A',
      headers: {
        cookie: userB.cookie,
        origin: appUrl,
        'x-csrf-token': userB.csrfToken,
      },
    });

    expect(delRes.statusCode).toBe(404);
    // User A's connection must NOT be deleted
    expect(mockDb.integrations.length).toBe(1);
  });
});
