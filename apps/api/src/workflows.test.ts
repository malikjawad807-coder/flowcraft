import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { MockDatabase } from './test-utils/mock-db.js';
import { Vault } from '@flowcart/vault';
import { deriveCsrfToken, hashToken } from '@flowcart/shared';
import { GmailTokenService } from './services/gmail-token.service.js';

describe('Workflow & Execution Subsystem Tests (Section 8 & Phase 4)', () => {
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

  it('1. GET /api/sample-emails returns sample email library', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sample-emails',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.sampleEmails).toHaveLength(4);
    expect(body.sampleEmails[0].id).toBe('support_question');
  });

  it('2. POST /api/workflows creates a workflow and saves initial version', async () => {
    mockDb.users.push({
      id: 'usr_wf_1',
      email: 'creator@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie, csrfToken } = createTestSession('usr_wf_1');

    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows',
      headers: {
        cookie,
        origin: appUrl,
        'x-csrf-token': csrfToken,
      },
      payload: {
        name: 'Auto-Triage Pipeline',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.workflow.name).toBe('Auto-Triage Pipeline');
    expect(body.workflow.version).toBe(1);
    expect(body.workflow.isActive).toBe(false);

    // Verify version 1 snapshot saved in DB
    expect(mockDb.workflowVersions).toHaveLength(1);
    expect(mockDb.workflowVersions[0].version).toBe(1);
  });

  it('3. GET /api/workflows and GET /api/workflows/:id respect user ownership', async () => {
    mockDb.users.push(
      { id: 'usr_1', email: 'user1@example.com', role: 'user', timezone: 'UTC' },
      { id: 'usr_2', email: 'user2@example.com', role: 'user', timezone: 'UTC' }
    );

    mockDb.workflows.push({
      id: 'wf_100',
      userId: 'usr_1',
      name: 'User 1 Workflow',
      isActive: false,
      version: 1,
      graph: { nodes: [], edges: [] },
    });

    const user1Session = createTestSession('usr_1');
    const user2Session = createTestSession('usr_2');

    // User 1 can fetch their workflow
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/workflows/wf_100',
      headers: { cookie: user1Session.cookie },
    });
    expect(res1.statusCode).toBe(200);
    expect(JSON.parse(res1.body).workflow.name).toBe('User 1 Workflow');

    // User 2 gets 404 (multi-tenant boundary)
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/workflows/wf_100',
      headers: { cookie: user2Session.cookie },
    });
    expect(res2.statusCode).toBe(404);
  });

  it('4. PUT /api/workflows/:id validates graph and bumps version', async () => {
    mockDb.users.push({
      id: 'usr_editor',
      email: 'editor@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie, csrfToken } = createTestSession('usr_editor');

    mockDb.workflows.push({
      id: 'wf_to_update',
      userId: 'usr_editor',
      name: 'Initial Name',
      isActive: false,
      version: 1,
      graph: {
        nodes: [
          {
            id: 'n1',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            config: {},
            settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
          },
        ],
        edges: [],
      },
    });

    // Update with valid new graph
    const res = await app.inject({
      method: 'PUT',
      url: '/api/workflows/wf_to_update',
      headers: {
        cookie,
        origin: appUrl,
        'x-csrf-token': csrfToken,
      },
      payload: {
        name: 'Updated Name',
        graph: {
          nodes: [
            {
              id: 'n1',
              type: 'manual.trigger',
              name: 'Start',
              position: { x: 0, y: 0 },
              config: {},
              settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
            },
            {
              id: 'n2',
              type: 'data.set',
              name: 'Add Metadata',
              position: { x: 200, y: 0 },
              config: { fields: [{ name: 'status', value: 'processed' }] },
              settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
            },
          ],
          edges: [{ id: 'e1', source: 'n1', sourceHandle: 'main', target: 'n2' }],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workflow.name).toBe('Updated Name');
    expect(body.workflow.version).toBe(2);

    // Verify version 2 snapshot added
    const version2 = mockDb.workflowVersions.find(
      (v) => v.workflowId === 'wf_to_update' && v.version === 2
    );
    expect(version2).toBeDefined();
  });

  it('5. POST /api/workflows/:id/toggle toggles active state', async () => {
    mockDb.users.push({
      id: 'usr_toggler',
      email: 'toggler@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie, csrfToken } = createTestSession('usr_toggler');

    mockDb.workflows.push({
      id: 'wf_toggle',
      userId: 'usr_toggler',
      name: 'Toggleable',
      isActive: false,
      version: 1,
      graph: {
        nodes: [
          {
            id: 'n1',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            config: {},
            settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
          },
        ],
        edges: [],
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows/wf_toggle/toggle',
      headers: {
        cookie,
        origin: appUrl,
        'x-csrf-token': csrfToken,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).workflow.isActive).toBe(true);
  });

  it('6. POST /api/workflows/:id/test-run executes graph and records steps', async () => {
    mockDb.users.push({
      id: 'usr_runner',
      email: 'runner@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie, csrfToken } = createTestSession('usr_runner');

    mockDb.workflows.push({
      id: 'wf_test_run',
      userId: 'usr_runner',
      name: 'Triage Flow',
      isActive: false,
      version: 1,
      graph: {
        nodes: [
          {
            id: 'n_trig',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            config: {},
            settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
          },
          {
            id: 'n_set',
            type: 'data.set',
            name: 'Set Sender Info',
            position: { x: 200, y: 0 },
            config: {
              fields: [
                { name: 'senderEmail', value: '{{ json.from.email }}' },
                { name: 'senderSubject', value: '{{ json.subject }}' },
              ],
              keepOthers: true,
            },
            settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
          },
        ],
        edges: [{ id: 'e1', source: 'n_trig', sourceHandle: 'main', target: 'n_set' }],
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows/wf_test_run/test-run',
      headers: {
        cookie,
        origin: appUrl,
        'x-csrf-token': csrfToken,
      },
      payload: {
        sampleEmailId: 'support_question',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.result.status).toBe('success');
    expect(body.result.steps).toHaveLength(2);

    const setStep = body.result.steps.find((s: any) => s.nodeId === 'n_set');
    expect(setStep.output.main[0].json.senderEmail).toBe('sarah.connor@cyberdyne.org');
    expect(setStep.output.main[0].json.senderSubject).toBe('Cannot connect my Google account on Safari');

    // Verify executions and steps persisted in database
    expect(mockDb.executions).toHaveLength(1);
    expect(mockDb.executions[0].status).toBe('success');
    expect(mockDb.executionSteps).toHaveLength(2);
  });

  it('7. POST /api/workflows/:id/activate fails if workflow contains Gmail nodes without connected Gmail', async () => {
    mockDb.users.push({
      id: 'usr_gmail_act',
      email: 'gmailact@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie, csrfToken } = createTestSession('usr_gmail_act');

    mockDb.workflows.push({
      id: 'wf_gmail_nodes',
      userId: 'usr_gmail_act',
      name: 'Gmail Auto-Reply',
      isActive: false,
      status: 'inactive',
      version: 1,
      graph: {
        nodes: [
          {
            id: 'n_gmail_trig',
            type: 'gmail.trigger',
            name: 'Gmail Trigger',
            position: { x: 0, y: 0 },
            config: { query: 'is:unread', pollSeconds: 60, skipBulk: true, skipOwnMail: true },
            settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
          },
        ],
        edges: [],
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows/wf_gmail_nodes/activate',
      headers: {
        cookie,
        origin: appUrl,
        'x-csrf-token': csrfToken,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('GMAIL_ACCOUNT_REQUIRED');
  });

  it('8. POST /api/workflows/:id/activate succeeds when active Gmail account is connected', async () => {
    mockDb.users.push({
      id: 'usr_gmail_ok',
      email: 'gmailok@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie, csrfToken } = createTestSession('usr_gmail_ok');

    // Add active integration for this user
    mockDb.integrations.push({
      id: 'integ_gmail_1',
      userId: 'usr_gmail_ok',
      provider: 'gmail',
      accountEmail: 'gmailok@gmail.com',
      status: 'active',
    });

    mockDb.workflows.push({
      id: 'wf_gmail_ok',
      userId: 'usr_gmail_ok',
      name: 'Gmail Production Pipeline',
      isActive: false,
      status: 'inactive',
      version: 1,
      graph: {
        nodes: [
          {
            id: 'n_trig',
            type: 'gmail.trigger',
            name: 'Gmail Trigger',
            position: { x: 0, y: 0 },
            config: { query: 'is:unread', pollSeconds: 60, skipBulk: true, skipOwnMail: true },
            settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
          },
        ],
        edges: [],
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows/wf_gmail_ok/activate',
      headers: {
        cookie,
        origin: appUrl,
        'x-csrf-token': csrfToken,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workflow.isActive).toBe(true);
    expect(body.workflow.status).toBe('active');
    expect(body.workflow.integrationId).toBe('integ_gmail_1');
  });

  it('9. POST /api/workflows/:id/deactivate deactivates an active workflow', async () => {
    mockDb.users.push({
      id: 'usr_deact',
      email: 'deact@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie, csrfToken } = createTestSession('usr_deact');

    mockDb.workflows.push({
      id: 'wf_to_deact',
      userId: 'usr_deact',
      name: 'Running Pipeline',
      isActive: true,
      status: 'active',
      version: 1,
      graph: { nodes: [], edges: [] },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/workflows/wf_to_deact/deactivate',
      headers: {
        cookie,
        origin: appUrl,
        'x-csrf-token': csrfToken,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.workflow.isActive).toBe(false);
    expect(body.workflow.status).toBe('inactive');
  });

  it('10. GET /api/executions filters by workflowId and status', async () => {
    mockDb.users.push({
      id: 'usr_exec_filter',
      email: 'execfilter@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie } = createTestSession('usr_exec_filter');

    mockDb.executions.push(
      {
        id: 'ex_1',
        workflowId: 'wf_a',
        userId: 'usr_exec_filter',
        mode: 'live',
        status: 'success',
        createdAt: new Date(),
      },
      {
        id: 'ex_2',
        workflowId: 'wf_a',
        userId: 'usr_exec_filter',
        mode: 'live',
        status: 'failed',
        createdAt: new Date(),
      },
      {
        id: 'ex_3',
        workflowId: 'wf_b',
        userId: 'usr_exec_filter',
        mode: 'test',
        status: 'success',
        createdAt: new Date(),
      }
    );

    // Filter by workflowId
    const resWf = await app.inject({
      method: 'GET',
      url: '/api/executions?workflowId=wf_a',
      headers: { cookie },
    });
    expect(resWf.statusCode).toBe(200);
    const bodyWf = JSON.parse(resWf.body);
    expect(bodyWf.executions).toHaveLength(2);

    // Filter by status
    const resFailed = await app.inject({
      method: 'GET',
      url: '/api/executions?status=failed',
      headers: { cookie },
    });
    expect(resFailed.statusCode).toBe(200);
    const bodyFailed = JSON.parse(resFailed.body);
    expect(bodyFailed.executions).toHaveLength(1);
    expect(bodyFailed.executions[0].id).toBe('ex_2');
  });

  it('11. GET /api/executions/:id returns execution and steps', async () => {
    mockDb.users.push({
      id: 'usr_exec_detail',
      email: 'execdetail@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie } = createTestSession('usr_exec_detail');

    mockDb.executions.push({
      id: 'ex_detail_100',
      workflowId: 'wf_xyz',
      userId: 'usr_exec_detail',
      mode: 'live',
      status: 'success',
      createdAt: new Date(),
    });

    mockDb.executionSteps.push({
      id: 'step_1',
      executionId: 'ex_detail_100',
      nodeId: 'n1',
      nodeType: 'gmail.trigger',
      itemIndex: 0,
      status: 'success',
      input: { query: 'is:unread' },
      output: { id: 'msg_123' },
      attempts: 1,
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/executions/ex_detail_100',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.execution.id).toBe('ex_detail_100');
    expect(body.steps).toHaveLength(1);
    expect(body.steps[0].nodeType).toBe('gmail.trigger');
  });

  it('12. POST /api/executions/:id/retry triggers retry execution', async () => {
    mockDb.users.push({
      id: 'usr_retry',
      email: 'retry@example.com',
      role: 'user',
      timezone: 'UTC',
    });
    const { cookie, csrfToken } = createTestSession('usr_retry');

    mockDb.workflows.push({
      id: 'wf_for_retry',
      userId: 'usr_retry',
      name: 'Retryable Flow',
      isActive: true,
      status: 'active',
      version: 1,
      graph: {
        nodes: [
          {
            id: 'n_start',
            type: 'manual.trigger',
            name: 'Start',
            position: { x: 0, y: 0 },
            config: {},
            settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
          },
        ],
        edges: [],
      },
    });

    mockDb.executions.push({
      id: 'ex_failed_1',
      workflowId: 'wf_for_retry',
      userId: 'usr_retry',
      mode: 'live',
      status: 'failed',
      triggerData: [{ subject: 'Retry Me' }],
      createdAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/executions/ex_failed_1/retry',
      headers: {
        cookie,
        origin: appUrl,
        'x-csrf-token': csrfToken,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.execution).toBeDefined();
    expect(body.execution.status).toBe('queued');
    expect(body.execution.workflowId).toBe('wf_for_retry');
  });
});
