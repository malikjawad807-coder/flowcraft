import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workflows, triggerState } from '@flowcart/db';

const { mockGmailClient } = vi.hoisted(() => ({
  mockGmailClient: {
    getProfile: vi.fn(),
    listHistory: vi.fn(),
    getMessage: vi.fn(),
  },
}));

vi.mock('@flowcart/gmail', async () => {
  const actual = await vi.importActual<any>('@flowcart/gmail');
  return {
    ...actual,
    GmailClient: vi.fn().mockImplementation(() => mockGmailClient),
  };
});

import { handleGmailPollJob } from './poller.js';

describe('Gmail Poller Subsystem (Section 7.10 & Phase 5)', () => {
  let mockDb: any;
  let mockRedis: any;
  let mockTokenService: any;
  let mockExecQueue: any;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockRedis = {
      set: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
    };

    mockExecQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job_123' }),
    };

    mockGmailClient.getProfile.mockResolvedValue({
      emailAddress: 'bot@flowcart.io',
      historyId: 'hist_100',
    });

    mockGmailClient.listHistory.mockResolvedValue({
      messageIds: ['msg_1', 'msg_2'],
      latestHistoryId: 'hist_105',
    });

    mockGmailClient.getMessage.mockImplementation(async (id: string) => ({
      messageId: id,
      threadId: `th_${id}`,
      from: { name: 'Customer', address: 'client@example.com' },
      to: ['bot@flowcart.io'],
      subject: `Test Inquiry ${id}`,
      labels: ['INBOX', 'UNREAD'],
      isBulk: false,
    }));

    mockTokenService = {
      getAuthenticatedClient: vi.fn().mockResolvedValue({}),
    };

    // Mock DB store
    const workflowsStore = [
      {
        id: 'wf_1',
        userId: 'usr_1',
        status: 'active',
        integrationId: 'conn_1',
        graph: {
          nodes: [
            {
              id: 'node_trigger',
              type: 'gmail.trigger',
              category: 'trigger',
              config: {
                query: 'is:unread',
                skipBulk: true,
                skipOwnMail: true,
                labelIds: ['INBOX'],
              },
            },
          ],
        },
      },
    ];

    let triggerStateStore: any[] = [{ workflowId: 'wf_1', cursor: 'hist_90' }];
    let processedMessagesStore: any[] = [];
    let executionsStore: any[] = [];

    mockDb = {
      select: () => ({
        from: (table: any) => ({
          where: (_condition: any) => ({
            limit: () => {
              if (table === workflows || (table as any)?._?.name === 'workflows') {
                return workflowsStore;
              }
              if (table === triggerState || (table as any)?._?.name === 'trigger_state') {
                return triggerStateStore;
              }
              return [];
            },
          }),
        }),
      }),
      insert: (table: any) => ({
        values: (val: any) => ({
          onConflictDoUpdate: async () => {
            triggerStateStore = [val];
            return [val];
          },
          onConflictDoNothing: () => ({
            returning: async () => {
              const exists = processedMessagesStore.some(
                (p) => p.workflowId === val.workflowId && p.gmailMessageId === val.gmailMessageId
              );
              if (exists) return [];
              processedMessagesStore.push(val);
              return [val];
            },
          }),
          returning: async () => {
            const row = { id: `exec_${Math.random().toString(36).substring(2, 7)}`, ...val };
            executionsStore.push(row);
            return [row];
          },
        }),
      }),
      update: () => ({
        set: (vals: any) => ({
          where: () => {
            if (triggerStateStore.length > 0) {
              triggerStateStore[0] = { ...triggerStateStore[0], ...vals };
            }
            return Promise.resolve();
          },
        }),
      }),
      _stores: {
        workflows: workflowsStore,
        triggerState: triggerStateStore,
        processedMessages: processedMessagesStore,
        executions: executionsStore,
      },
    };
  });

  it('1. Incremental poll enqueues new messages and advances cursor', async () => {
    const res = await handleGmailPollJob('wf_1', {
      db: mockDb,
      redis: mockRedis,
      tokenService: mockTokenService,
      execQueue: mockExecQueue,
      logger: mockLogger,
    });

    expect(res.polledCount).toBe(2);
    expect(res.enqueuedCount).toBe(2);

    // Verify executions enqueued with deterministic job IDs
    expect(mockExecQueue.add).toHaveBeenCalledTimes(2);
    expect(mockExecQueue.add).toHaveBeenCalledWith(
      'workflow-exec',
      expect.objectContaining({ workflowId: 'wf_1', messageId: 'msg_1' }),
      expect.objectContaining({ jobId: 'exec:wf_1:msg_1' })
    );

    // Verify Redis lock was released
    expect(mockRedis.del).toHaveBeenCalledWith('lock:poll:wf_1');
  });

  it('2. Loop prevention: skips self-sent email and SENT label', async () => {
    mockGmailClient.listHistory.mockResolvedValueOnce({
      messageIds: ['msg_self', 'msg_sent'],
      latestHistoryId: 'hist_105',
    });

    mockGmailClient.getMessage.mockImplementation(async (id: string) => {
      if (id === 'msg_self') {
        return {
          messageId: 'msg_self',
          threadId: 'th_1',
          from: { name: 'Bot', address: 'bot@flowcart.io' }, // Matches connected account
          labels: ['INBOX'],
          isBulk: false,
        };
      }
      return {
        messageId: 'msg_sent',
        threadId: 'th_2',
        from: { name: 'Alice', address: 'alice@external.com' },
        labels: ['SENT'], // SENT label
        isBulk: false,
      };
    });

    const res = await handleGmailPollJob('wf_1', {
      db: mockDb,
      redis: mockRedis,
      tokenService: mockTokenService,
      execQueue: mockExecQueue,
      logger: mockLogger,
    });

    expect(res.enqueuedCount).toBe(0);
    expect(mockExecQueue.add).not.toHaveBeenCalled();
  });

  it('3. Loop prevention: skips bulk emails and existing FlowCart/ labels', async () => {
    mockGmailClient.listHistory.mockResolvedValueOnce({
      messageIds: ['msg_bulk', 'msg_labeled'],
      latestHistoryId: 'hist_105',
    });

    mockGmailClient.getMessage.mockImplementation(async (id: string) => {
      if (id === 'msg_bulk') {
        return {
          messageId: 'msg_bulk',
          threadId: 'th_1',
          from: { name: 'Promo', address: 'marketing@newsletter.com' },
          labels: ['INBOX'],
          isBulk: true, // Bulk email
        };
      }
      return {
        messageId: 'msg_labeled',
        threadId: 'th_2',
        from: { name: 'User', address: 'user@external.com' },
        labels: ['INBOX', 'FlowCart/Processed'], // Already handled by FlowCart
        isBulk: false,
      };
    });

    const res = await handleGmailPollJob('wf_1', {
      db: mockDb,
      redis: mockRedis,
      tokenService: mockTokenService,
      execQueue: mockExecQueue,
      logger: mockLogger,
    });

    expect(res.enqueuedCount).toBe(0);
    expect(mockExecQueue.add).not.toHaveBeenCalled();
  });
});
