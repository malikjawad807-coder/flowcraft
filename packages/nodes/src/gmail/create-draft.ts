import { z } from 'zod';
import { NodeDefinition } from '../types.js';
import { WorkflowItem } from '@flowcart/shared';
import { getReplyRecipient, formatReplySubject } from './helpers.js';

const configSchema = z.object({
  threadId: z.string().optional(),
  body: z.string().default(''),
});

type Config = z.infer<typeof configSchema>;

export const gmailCreateDraftNode: NodeDefinition<Config> = {
  type: 'gmail.create_draft',
  label: 'Gmail: Create Draft',
  category: 'gmail',
  outputs: ['main'],
  configSchema,
  defaults: {
    body: '',
  },
  isWrite: true,
  async run(ctx, items, config) {
    const results: WorkflowItem[] = [];

    for (const item of items) {
      const threadId = config.threadId || item.json?.threadId || '';
      const to = getReplyRecipient(item.json);
      const subject = formatReplySubject(item.json?.subject);
      const bodyText = config.body;

      if (ctx.dryRun || !ctx.gmailClient) {
        ctx.logger.info(`[Dry Run] gmail.create_draft simulated for thread ${threadId}`);
        results.push({
          json: {
            ...item.json,
            draftId: `dry_run_draft_${Math.random().toString(36).substring(2, 9)}`,
            draftAction: 'simulated',
            recipient: to,
            subject,
            threadId,
            bodyPreview: bodyText.slice(0, 200),
          },
        });
        continue;
      }

      const draftResult = await ctx.gmailClient.createDraft({
        threadId: threadId || undefined,
        to,
        subject,
        bodyText,
      });

      results.push({
        json: {
          ...item.json,
          draftId: draftResult.draftId,
          recipient: to,
          subject,
          threadId,
        },
      });
    }

    return { main: results };
  },
};
