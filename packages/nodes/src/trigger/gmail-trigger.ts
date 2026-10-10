import { z } from 'zod';
import { NodeDefinition } from '../types.js';
import { WorkflowItem } from '@flowcart/shared';

const configSchema = z.object({
  query: z.string().default('is:unread'),
  labelIds: z.array(z.string()).default(['INBOX']),
  pollSeconds: z.number().min(30, 'Poll frequency must be at least 30 seconds').default(60),
  skipBulk: z.boolean().default(true),
  skipOwnMail: z.boolean().default(true),
  ignoredSenders: z.array(z.string()).default([]),
});

type Config = z.infer<typeof configSchema>;

export const gmailTriggerNode: NodeDefinition<Config> = {
  type: 'gmail.trigger',
  label: 'Gmail Trigger',
  category: 'trigger',
  outputs: ['main'],
  configSchema,
  defaults: {
    query: 'is:unread',
    labelIds: ['INBOX'],
    pollSeconds: 60,
    skipBulk: true,
    skipOwnMail: true,
    ignoredSenders: [],
  },
  isWrite: false,
  async run(_ctx, items, _config) {
    if (items.length > 0) {
      return { main: items };
    }
    // Sandbox / Test fallback
    return {
      main: [
        {
          json: {
            messageId: 'mock_msg_001',
            threadId: 'mock_thread_001',
            subject: 'Sample Trigger Email',
            from: { name: 'Support Client', address: 'client@example.com' },
            to: ['me@example.com'],
            date: new Date().toISOString(),
            snippet: 'Hello, I have an inquiry regarding FlowCart.',
            bodyText: 'Hello, I have an inquiry regarding FlowCart. Can you please assist?',
            bodyTextFull: 'Hello, I have an inquiry regarding FlowCart. Can you please assist?',
            labels: ['INBOX', 'UNREAD'],
            isBulk: false,
          },
        },
      ],
    };
  },
};
