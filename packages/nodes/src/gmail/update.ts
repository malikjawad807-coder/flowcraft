import { z } from 'zod';
import { NodeDefinition } from '../types.js';
import { WorkflowItem } from '@flowcart/shared';

const configSchema = z.object({
  markRead: z.boolean().default(false),
  archive: z.boolean().default(false),
});

type Config = z.infer<typeof configSchema>;

export const gmailUpdateNode: NodeDefinition<Config> = {
  type: 'gmail.update',
  label: 'Gmail: Update Message',
  category: 'gmail',
  outputs: ['main'],
  configSchema,
  defaults: {
    markRead: false,
    archive: false,
  },
  isWrite: true,
  async run(ctx, items, config) {
    const results: WorkflowItem[] = [];

    for (const item of items) {
      const messageId = item.json?.messageId || item.json?.id;

      if (!messageId) {
        ctx.logger.warn('gmail.update skipped item without messageId');
        results.push(item);
        continue;
      }

      if (ctx.dryRun || !ctx.gmailClient) {
        ctx.logger.info(
          `[Dry Run] gmail.update (markRead: ${config.markRead}, archive: ${config.archive}) for message ${messageId}`
        );
        results.push({
          json: {
            ...item.json,
            updateOperation: {
              markRead: config.markRead,
              archive: config.archive,
              simulated: true,
            },
          },
        });
        continue;
      }

      const removeLabelIds: string[] = [];
      if (config.markRead) {
        removeLabelIds.push('UNREAD');
      }
      if (config.archive) {
        removeLabelIds.push('INBOX');
      }

      if (removeLabelIds.length > 0) {
        await ctx.gmailClient.modifyMessage(messageId, {
          removeLabelIds,
        });
      }

      results.push({
        json: {
          ...item.json,
          updateOperation: {
            markRead: config.markRead,
            archive: config.archive,
            removedLabels: removeLabelIds,
            success: true,
          },
        },
      });
    }

    return { main: results };
  },
};
