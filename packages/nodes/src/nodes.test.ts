import { describe, it, expect, vi } from 'vitest';
import {
  manualTriggerNode,
  gmailTriggerNode,
  logicFilterNode,
  logicIfNode,
  logicSwitchNode,
  dataSetNode,
  utilLogNode,
  gmailCreateDraftNode,
  gmailReplyNode,
  gmailAddLabelNode,
  gmailUpdateNode,
  aiClassifyNode,
  aiAgentNode,
  controlApprovalNode,
  NodeExecutionContext,
} from './index.js';

const mockContext: NodeExecutionContext = {
  userId: 'usr_test',
  executionId: 'exec_test',
  nodeId: 'node_test',
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
};

describe('Core Nodes (Section 8.7)', () => {
  it('manual.trigger passes items or creates default trigger item', async () => {
    const res1 = await manualTriggerNode.run(mockContext, [], {});
    expect(res1.main).toHaveLength(1);
    expect(res1.main[0].json.mode).toBe('manual');

    const res2 = await manualTriggerNode.run(
      mockContext,
      [{ json: { id: 10 } }],
      {}
    );
    expect(res2.main[0].json.id).toBe(10);
  });

  it('logic.filter drops items not matching condition', async () => {
    const items = [
      { json: { category: 'sales', amount: 100 } },
      { json: { category: 'support', amount: 20 } },
      { json: { category: 'sales', amount: 500 } },
    ];

    const res = await logicFilterNode.run(mockContext, items, {
      combinator: 'and',
      conditions: [{ field: 'category', op: 'equals', value: 'sales' }],
    });

    expect(res.pass).toHaveLength(2);
    expect(res.pass[0].json.amount).toBe(100);
    expect(res.pass[1].json.amount).toBe(500);
  });

  it('logic.if splits items into true and false handles', async () => {
    const items = [
      { json: { isBulk: true, email: 'promo@news.com' } },
      { json: { isBulk: false, email: 'ceo@partner.com' } },
    ];

    const res = await logicIfNode.run(mockContext, items, {
      combinator: 'and',
      conditions: [{ field: 'isBulk', op: 'equals', value: true }],
    });

    expect(res.true).toHaveLength(1);
    expect(res.true[0].json.email).toBe('promo@news.com');

    expect(res.false).toHaveLength(1);
    expect(res.false[0].json.email).toBe('ceo@partner.com');
  });

  it('logic.switch routes items to first matching branch or fallback', async () => {
    const items = [
      { json: { priority: 'high', score: 90 } },
      { json: { priority: 'medium', score: 50 } },
      { json: { priority: 'low', score: 10 } },
    ];

    const res = await logicSwitchNode.run(mockContext, items, {
      rules: [
        {
          name: 'ruleHigh',
          combinator: 'and',
          conditions: [{ field: 'priority', op: 'equals', value: 'high' }],
        },
        {
          name: 'ruleMedium',
          combinator: 'and',
          conditions: [{ field: 'priority', op: 'equals', value: 'medium' }],
        },
      ],
    });

    expect(res.ruleHigh).toHaveLength(1);
    expect(res.ruleMedium).toHaveLength(1);
    expect(res.fallback).toHaveLength(1);
    expect(res.fallback[0].json.priority).toBe('low');
  });

  it('data.set updates item fields while preserving existing keys', async () => {
    const items = [{ json: { original: 'value', count: 1 } }];

    const res = await dataSetNode.run(mockContext, items, {
      fields: [
        { name: 'addedField', value: 'hello' },
        { name: 'count', value: 2 },
      ],
      keepOthers: true,
    });

    expect(res.main[0].json).toEqual({
      original: 'value',
      count: 2,
      addedField: 'hello',
    });
  });

  it('util.log passes items through untouched', async () => {
    const items = [{ json: { ping: 'pong' } }];
    const res = await utilLogNode.run(mockContext, items, {
      message: 'Processing item',
      level: 'info',
    });

    expect(res.main).toEqual(items);
  });

  describe('Gmail Nodes (Section 7 & 8)', () => {
    const mockEmailItem = {
      json: {
        messageId: 'msg_abc123',
        threadId: 'th_xyz789',
        subject: 'Inquiry regarding FlowCart',
        from: { name: 'Lead', address: 'lead@corp.com' },
        replyTo: 'custom-reply@corp.com',
        headers: {
          messageIdHeader: '<msg_abc123@corp.com>',
          references: '<initial@corp.com>',
        },
      },
    };

    it('gmail.trigger returns incoming items or default mock sandbox email', async () => {
      const res = await gmailTriggerNode.run(mockContext, [], {
        query: 'is:unread',
        labelIds: ['INBOX'],
        pollSeconds: 60,
        skipBulk: true,
        skipOwnMail: true,
        ignoredSenders: [],
      });
      expect(res.main).toHaveLength(1);
      expect(res.main[0].json.subject).toBe('Sample Trigger Email');
    });

    it('gmail.create_draft creates dry-run simulated draft or calls gmailClient in live run', async () => {
      // Dry Run
      const dryCtx = { ...mockContext, dryRun: true };
      const dryRes = await gmailCreateDraftNode.run(dryCtx, [mockEmailItem], {
        body: 'Thank you for reaching out.',
      });
      expect(dryRes.main[0].json.draftId).toMatch(/^dry_run_draft_/);
      expect(dryRes.main[0].json.recipient).toBe('custom-reply@corp.com');
      expect(dryRes.main[0].json.subject).toBe('Re: Inquiry regarding FlowCart');

      // Live Run
      const mockClient = {
        createDraft: vi.fn().mockResolvedValue({ draftId: 'live_draft_999' }),
      };
      const liveCtx = { ...mockContext, dryRun: false, gmailClient: mockClient };
      const liveRes = await gmailCreateDraftNode.run(liveCtx, [mockEmailItem], {
        body: 'Live draft body',
      });
      expect(mockClient.createDraft).toHaveBeenCalledWith({
        threadId: 'th_xyz789',
        to: 'custom-reply@corp.com',
        subject: 'Re: Inquiry regarding FlowCart',
        bodyText: 'Live draft body',
      });
      expect(liveRes.main[0].json.draftId).toBe('live_draft_999');
    });

    it('gmail.reply handles draft and send modes with Re: normalization and header sanitization', async () => {
      const mockClient = {
        sendReply: vi.fn().mockResolvedValue({ messageId: 'sent_111', threadId: 'th_xyz789' }),
        createDraft: vi.fn().mockResolvedValue({ draftId: 'draft_222', message: { threadId: 'th_xyz789' } }),
      };
      const liveCtx = { ...mockContext, dryRun: false, gmailClient: mockClient };

      // Send mode
      const sendRes = await gmailReplyNode.run(liveCtx, [mockEmailItem], {
        mode: 'send',
        body: 'Replying live',
      });
      expect(mockClient.sendReply).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: 'th_xyz789',
          to: 'custom-reply@corp.com',
          subject: 'Re: Inquiry regarding FlowCart',
          bodyText: 'Replying live',
        })
      );
      expect(sendRes.main[0].json.replyAction).toBe('sent');

      // Draft mode
      const draftRes = await gmailReplyNode.run(liveCtx, [mockEmailItem], {
        mode: 'draft',
        body: 'Draft reply',
      });
      expect(mockClient.createDraft).toHaveBeenCalled();
      expect(draftRes.main[0].json.replyAction).toBe('drafted');
    });

    it('gmail.add_label calls ensureLabel and modifyMessage', async () => {
      const mockClient = {
        ensureLabel: vi.fn().mockResolvedValue('Label_FlowCart_Processed'),
        modifyMessage: vi.fn().mockResolvedValue({}),
      };
      const liveCtx = { ...mockContext, dryRun: false, gmailClient: mockClient };

      const res = await gmailAddLabelNode.run(liveCtx, [mockEmailItem], {
        labelName: 'FlowCart/Processed',
        remove: false,
      });

      expect(mockClient.ensureLabel).toHaveBeenCalledWith('FlowCart/Processed');
      expect(mockClient.modifyMessage).toHaveBeenCalledWith('msg_abc123', {
        addLabelIds: ['Label_FlowCart_Processed'],
        removeLabelIds: [],
      });
      expect(res.main[0].json.labelOperation.success).toBe(true);
    });

    it('gmail.update removes UNREAD and INBOX according to configuration', async () => {
      const mockClient = {
        modifyMessage: vi.fn().mockResolvedValue({}),
      };
      const liveCtx = { ...mockContext, dryRun: false, gmailClient: mockClient };

      const res = await gmailUpdateNode.run(liveCtx, [mockEmailItem], {
        markRead: true,
        archive: true,
      });

      expect(mockClient.modifyMessage).toHaveBeenCalledWith('msg_abc123', {
        removeLabelIds: ['UNREAD', 'INBOX'],
      });
      expect(res.main[0].json.updateOperation.removedLabels).toEqual(['UNREAD', 'INBOX']);
    });
  });

  describe('AI Nodes (Section 8.7 & Phase 6)', () => {
    it('ai.classify routes support question into support_question branch', async () => {
      const emailItem = {
        json: {
          subject: 'Cannot connect my Google account on Safari',
          bodyText: 'I clicked the connect button but get a redirect error. Please help!',
        },
      };

      const res = await aiClassifyNode.run(mockContext, [emailItem], {
        categories: [
          { name: 'support_question', description: 'Customer asks for help or reports an issue' },
          { name: 'sales_lead', description: 'Interested in buying or pricing consultation' },
          { name: 'billing', description: 'Payment invoices and charges' },
        ],
        minConfidence: 0.6,
        input: '{{ json.subject }} \n\n {{ json.bodyText }}',
      });

      expect(res.support_question).toHaveLength(1);
      expect(res.sales_lead).toHaveLength(0);
      expect(res.other).toHaveLength(0);

      const classifiedItem = res.support_question[0];
      expect(classifiedItem.json.classification.category).toBe('support_question');
      expect(classifiedItem.json.classification.confidence).toBeGreaterThanOrEqual(0.6);
      expect(classifiedItem.json.classification.routedTo).toBe('support_question');
    });

    it('ai.classify routes sales inquiry into sales_lead branch', async () => {
      const emailItem = {
        json: {
          subject: 'Quote for team of 50 users and demo',
          bodyText: 'We are evaluating FlowCart and would like a price quote and sales call.',
        },
      };

      const res = await aiClassifyNode.run(mockContext, [emailItem], {
        categories: [
          { name: 'support_question', description: 'Customer asks for help or reports an issue' },
          { name: 'sales_lead', description: 'Interested in buying or pricing consultation' },
          { name: 'billing', description: 'Payment invoices and charges' },
        ],
        minConfidence: 0.6,
        input: '{{ json.subject }} \n\n {{ json.bodyText }}',
      });

      expect(res.sales_lead).toHaveLength(1);
      expect(res.support_question).toHaveLength(0);
      expect(res.other).toHaveLength(0);
      expect(res.sales_lead[0].json.classification.category).toBe('sales_lead');
    });

    it('ai.classify routes items with confidence below minConfidence to "other"', async () => {
      const emailItem = {
        json: {
          subject: 'Unclear message',
          bodyText: 'Random thoughts about nothing in particular',
        },
      };

      // Mock LLM returning low confidence
      const mockLowConfidenceLlm = {
        generateObject: vi.fn().mockResolvedValue({
          object: {
            category: 'support_question',
            confidence: 0.35, // below 0.7 threshold
            reason: 'Weak guess',
          },
        }),
      };

      const ctxWithLowLlm = { ...mockContext, llmClient: mockLowConfidenceLlm };

      const res = await aiClassifyNode.run(ctxWithLowLlm, [emailItem], {
        categories: [
          { name: 'support_question', description: 'Customer asks for help' },
          { name: 'sales_lead', description: 'Sales inquiries' },
        ],
        minConfidence: 0.7,
        input: '{{ json.subject }}',
      });

      expect(res.other).toHaveLength(1);
      expect(res.support_question).toHaveLength(0);
      expect(res.other[0].json.classification.routedTo).toBe('other');
    });
  });

  describe('ai.agent and control.approval Nodes (Phase 7)', () => {
    it('ai.agent routes to done handle when confident and no human needed', async () => {
      const mockLlm = {
        generateObject: vi.fn().mockResolvedValue({
          object: {
            replyText: 'Happy to help with that!',
            needsHuman: false,
            confidence: 0.95,
            reason: 'Clear support response provided.',
          },
        }),
      };

      const ctx = { ...mockContext, llmClient: mockLlm };
      const item = { json: { subject: 'Help with login', bodyText: 'How do I login?' } };

      const res = await aiAgentNode.run(ctx, [item], {
        goal: 'Answer login questions politely',
        allowedTools: [],
        minConfidence: 0.8,
        temperature: 0.3,
      });

      expect(res.done).toHaveLength(1);
      expect(res.needs_human).toHaveLength(0);
      expect(res.done[0].json.replyText).toBe('Happy to help with that!');
      expect(res.done[0].json.needsHuman).toBe(false);
      expect(res.done[0].json.confidence).toBe(0.95);
    });

    it('ai.agent routes to needs_human handle when human flag is set or confidence low', async () => {
      const mockLlm = {
        generateObject: vi.fn().mockResolvedValue({
          object: {
            replyText: 'I cannot promise a refund, let me check with manager.',
            needsHuman: true,
            confidence: 0.8,
            reason: 'Customer requested a refund.',
          },
        }),
      };

      const ctx = { ...mockContext, llmClient: mockLlm };
      const item = { json: { subject: 'Refund request', bodyText: 'I want my money back' } };

      const res = await aiAgentNode.run(ctx, [item], {
        goal: 'Draft refund response',
        allowedTools: [],
        minConfidence: 0.8,
        temperature: 0.3,
      });

      expect(res.needs_human).toHaveLength(1);
      expect(res.done).toHaveLength(0);
      expect(res.needs_human[0].json.needsHuman).toBe(true);
    });

    it('control.approval routes to approved or rejected based on decision', async () => {
      const approvedItem = {
        json: {
          recipient: 'bob@example.com',
          __approvalDecision: 'approved',
          __approvalEditedArgs: { body: 'Updated body' },
        },
      };

      const resAppr = await controlApprovalNode.run(mockContext, [approvedItem], {
        recipient: '',
        subject: '',
        body: '',
        timeoutHours: 24,
      });

      expect(resAppr.approved).toHaveLength(1);
      expect(resAppr.approved[0].json.body).toBe('Updated body');
      expect(resAppr.approved[0].json.isApproved).toBe(true);

      const rejectedItem = {
        json: {
          recipient: 'bob@example.com',
          __approvalDecision: 'rejected',
        },
      };

      const resRej = await controlApprovalNode.run(mockContext, [rejectedItem], {
        recipient: '',
        subject: '',
        body: '',
        timeoutHours: 24,
      });

      expect(resRej.rejected).toHaveLength(1);
      expect(resRej.approved).toHaveLength(0);
    });

    it('control.approval auto-approves in dryRun mode', async () => {
      const ctx = { ...mockContext, dryRun: true };
      const item = { json: { recipient: 'bob@example.com', subject: 'Hi' } };

      const res = await controlApprovalNode.run(ctx, [item], {
        recipient: '',
        subject: '',
        body: '',
        timeoutHours: 24,
      });
      expect(res.approved).toHaveLength(1);
      expect(res.approved[0].json.isApproved).toBe(true);
    });
  });
});


