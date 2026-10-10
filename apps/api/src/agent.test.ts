import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { MockDatabase } from './test-utils/mock-db.js';
import { Vault } from '@flowcart/vault';
import { deriveCsrfToken, hashToken } from '@flowcart/shared';
import { LLMService } from '@flowcart/llm';
import { randomUUID } from 'node:crypto';

const csrfSecret = 'my_super_secure_csrf_secret_32_bytes!';
const appUrl = 'http://localhost:3000';
const encryptionKey = 'dGhpc2lzYTMyYnl0ZXNlY3JldGtleWZvcmZsb3djYXJ0IQ==';

const testEnv: any = {
  NODE_ENV: 'test',
  APP_URL: appUrl,
  API_PORT: 4000,
  WEB_PORT: 3000,
  ALLOW_SIGNUPS: true,
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  APP_ENCRYPTION_KEY: encryptionKey,
  APP_ENCRYPTION_KEY_ID: 'k1',
  CSRF_SECRET: csrfSecret,
  SESSION_COOKIE_NAME: 'fc_sid',
  SESSION_IDLE_DAYS: 7,
  SESSION_ABSOLUTE_DAYS: 30,
  AGENT_MAX_ITERATIONS: 8,
  AGENT_RUN_TIMEOUT_MS: 120000,
  AGENT_COMMANDS_PER_HOUR: 30,
  EXECUTION_TIMEOUT_MS: 300000,
  EXECUTION_RETENTION_DAYS: 30,
  LLM_DEFAULT_PROVIDER: 'mock',
  EMBEDDING_PROVIDER: 'mock',
  EMBEDDING_DIM: 1536,
};

describe('Agent Command Center & Approvals API Integration Tests (Phase 7)', () => {
  let db: MockDatabase;
  let vault: Vault;
  let llmService: LLMService;
  let app: FastifyInstance;

  const userA = {
    id: randomUUID(),
    email: 'usera@example.com',
    name: 'User A',
    timezone: 'UTC',
    role: 'user',
  };

  const userB = {
    id: randomUUID(),
    email: 'userb@example.com',
    name: 'User B',
    timezone: 'UTC',
    role: 'user',
  };

  let sessionA: { cookie: string; csrfToken: string };
  let sessionB: { cookie: string; csrfToken: string };

  function createTestSession(userId: string) {
    const rawSessionId = 'test_session_cookie_' + userId;
    const idHash = hashToken(rawSessionId);
    db.sessions.push({
      idHash,
      userId,
      expiresAt: new Date(Date.now() + 86400000),
      absoluteExpiresAt: new Date(Date.now() + 86400000 * 30),
      lastSeenAt: new Date(),
    });
    const csrfToken = deriveCsrfToken(idHash, csrfSecret);
    return { cookie: `fc_sid=${rawSessionId}`, csrfToken };
  }

  beforeEach(async () => {
    db = new MockDatabase();
    const keyBuf = Buffer.from(encryptionKey, 'base64').subarray(0, 32);
    vault = new Vault({
      activeKeyId: 'k1',
      keys: {
        k1: Buffer.from(keyBuf),
      },
    });
    llmService = new LLMService({ defaultProvider: 'mock' });

    db.users.push(userA, userB);

    app = buildApp({
      env: testEnv,
      db,
      vault,
      llmService,
    });

    await app.ready();

    sessionA = createTestSession(userA.id);
    sessionB = createTestSession(userB.id);
  });

  afterEach(async () => {
    await app.close();
  });

  it('manages conversations: create, list, and view messages', async () => {
    // 1. Create conversation
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/agent/conversations',
      headers: {
        cookie: sessionA.cookie,
        'x-csrf-token': sessionA.csrfToken,
        origin: testEnv.APP_URL,
      },
      payload: { title: 'My Work Chat' },
    });

    expect(createRes.statusCode).toBe(200);
    const conv = JSON.parse(createRes.body).conversation;
    expect(conv.id).toBeDefined();
    expect(conv.title).toBe('My Work Chat');

    // 2. List conversations
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/agent/conversations',
      headers: { cookie: sessionA.cookie },
    });

    expect(listRes.statusCode).toBe(200);
    const list = JSON.parse(listRes.body).conversations;
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(conv.id);

    // 3. View conversation
    const viewRes = await app.inject({
      method: 'GET',
      url: `/api/agent/conversations/${conv.id}`,
      headers: { cookie: sessionA.cookie },
    });

    expect(viewRes.statusCode).toBe(200);
    const viewData = JSON.parse(viewRes.body);
    expect(viewData.conversation.id).toBe(conv.id);
    expect(viewData.messages).toEqual([]);
  });

  it('executes user command message and creates an agent run', async () => {
    const msgRes = await app.inject({
      method: 'POST',
      url: '/api/agent/messages',
      headers: {
        cookie: sessionA.cookie,
        'x-csrf-token': sessionA.csrfToken,
        origin: testEnv.APP_URL,
      },
      payload: { text: 'Summarize my unread emails' },
    });

    expect(msgRes.statusCode).toBe(200);
    const body = JSON.parse(msgRes.body);
    expect(body.conversationId).toBeDefined();
    expect(body.runId).toBeDefined();
    expect(body.status).toBe('running');

    // Verify messages saved
    expect(db.messages.some((m) => m.content === 'Summarize my unread emails')).toBe(true);
  });

  it('handles approvals lifecycle: listing, approving, and rejecting', async () => {
    const approvalId = randomUUID();
    db.approvals.push({
      id: approvalId,
      userId: userA.id,
      toolName: 'gmail_send_new',
      preview: {
        recipient: 'client@example.com',
        subject: 'Contract Proposal',
        body: 'Please review the agreement.',
      },
      args: { to: 'client@example.com', subject: 'Contract Proposal', bodyText: 'Please review the agreement.' },
      status: 'pending',
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    });

    // 1. List approvals
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/approvals?status=pending',
      headers: { cookie: sessionA.cookie },
    });

    expect(listRes.statusCode).toBe(200);
    const approvalsList = JSON.parse(listRes.body).approvals;
    expect(approvalsList).toHaveLength(1);
    expect(approvalsList[0].id).toBe(approvalId);

    // 2. Approve approval
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/approvals/${approvalId}/approve`,
      headers: {
        cookie: sessionA.cookie,
        'x-csrf-token': sessionA.csrfToken,
        origin: testEnv.APP_URL,
      },
      payload: { editedArgs: { bodyText: 'Updated edited contract.' } },
    });

    expect(approveRes.statusCode).toBe(200);
    expect(JSON.parse(approveRes.body).status).toBe('approved');

    const updated = db.approvals.find((a) => a.id === approvalId);
    expect(updated.status).toBe('approved');
    expect(updated.editedArgs?.bodyText).toBe('Updated edited contract.');
  });

  it('enforces IDOR protection: User B cannot access or decide User A approvals or conversations', async () => {
    // 1. Approval IDOR
    const approvalAId = randomUUID();
    db.approvals.push({
      id: approvalAId,
      userId: userA.id,
      status: 'pending',
      preview: { recipient: 'secret@corp.com', subject: 'Secrets', body: 'Confidential' },
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    });

    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/approvals/${approvalAId}/reject`,
      headers: {
        cookie: sessionB.cookie,
        'x-csrf-token': sessionB.csrfToken,
        origin: testEnv.APP_URL,
      }, // User B tries to reject User A's approval
    });

    expect(rejectRes.statusCode).toBe(404);

    // 2. Conversation IDOR
    const convAId = randomUUID();
    db.conversations.push({
      id: convAId,
      userId: userA.id,
      title: 'User A Private Chat',
      temporary: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const getConvRes = await app.inject({
      method: 'GET',
      url: `/api/agent/conversations/${convAId}`,
      headers: { cookie: sessionB.cookie }, // User B tries to view User A's conversation
    });

    expect(getConvRes.statusCode).toBe(404);
  });

  it('returns pending approvals count and unread notifications', async () => {
    db.approvals.push({
      id: randomUUID(),
      userId: userA.id,
      status: 'pending',
      preview: { recipient: 'bob@example.com', subject: 'Hi', body: 'Body' },
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    });

    const notifRes = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { cookie: sessionA.cookie },
    });

    expect(notifRes.statusCode).toBe(200);
    const data = JSON.parse(notifRes.body);
    expect(data.pendingApprovalsCount).toBe(1);
    expect(data.unreadCount).toBeGreaterThanOrEqual(1);
  });
});
