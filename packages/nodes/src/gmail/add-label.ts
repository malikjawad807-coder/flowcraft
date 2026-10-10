import { z } from 'zod';
import { NodeDefinition } from '../types.js';
import { WorkflowItem } from '@flowcart/shared';

const configSchema = z.object({
  labelName: z.string().default('FlowCart/Processed'),
  remove: z.boolean().default(false),
});

type Config = z.infer<typeof configSchema>;

export const gmailAddLabelNode: NodeDefinition<Config> = {
  type: 'gmail.add_label',
  label: 'Gmail: Add/Remove Label',
  category: 'gmail',
  outputs: ['main'],
  configSchema,
  defaults: {
    labelName: 'FlowCart/Processed',
    remove: false,
  },
  isWrite: true,
  async run(ctx, items, config) {
    const results: WorkflowItem[] = [];

    for (const item of items) {
      const messageId = item.json?.messageId || item.json?.id;

      if (!messageId) {
        ctx.logger.warn('gmail.add_label skipped item without messageId');
        results.push(item);
        continue;
      }

      if (ctx.dryRun || !ctx.gmailClient) {
        ctx.logger.info(
          `[Dry Run] gmail.add_label (${config.remove ? 'remove' : 'add'} ${config.labelName}) for message ${messageId}`
        );
        results.push({
          json: {
            ...item.json,
            labelOperation: {
              labelName: config.labelName,
              action: config.remove ? 'remove' : 'add',
              simulated: true,
            },
          },
        });
        continue;
      }

      const labelId = await ctx.gmailClient.ensureLabel(config.labelName);
      await ctx.gmailClient.modifyMessage(messageId, {
        addLabelIds: config.remove ? [] : [labelId],
        removeLabelIds: config.remove ? [labelId] : [],
      });

      results.push({
        json: {
          ...item.json,
          labelOperation: {
            labelName: config.labelName,
            labelId,
            action: config.remove ? 'remove' : 'add',
            success: true,
          },
        },
      });
    }

    return { main: results };
  },
};
