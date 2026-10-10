import { z } from 'zod';
import { NodeDefinition } from '../types.js';
import { WorkflowItem } from '@flowcart/shared';
import { getReplyRecipient, formatReplySubject, sanitizeHeaderValue } from './helpers.js';

const configSchema = z.object({
  mode: z.enum(['draft', 'send']).default('draft'),
  body: z.string().default(''),
});

type Config = z.infer<typeof configSchema>;

export const gmailReplyNode: NodeDefinition<Config> = {
  type: 'gmail.reply',
  label: 'Gmail: Reply',
  category: 'gmail',
  outputs: ['main'],
  configSchema,
  defaults: {
    mode: 'draft',
    body: '',
  },
  isWrite: true,
  async run(ctx, items, config) {
    const results: WorkflowItem[] = [];

    for (const item of items) {
      const threadId = item.json?.threadId || '';
      const to = getReplyRecipient(item.json);
      const subject = formatReplySubject(item.json?.subject);
      const inReplyTo = sanitizeHeaderValue(
        item.json?.headers?.messageIdHeader || item.json?.headers?.['message-id'] || item.json?.messageId || ''
      );
      const references = sanitizeHeaderValue(
        item.json?.headers?.references
          ? `${item.json.headers.references} ${inReplyTo}`.trim()
          : inReplyTo
      );
      const bodyText = config.body;

      if (ctx.dryRun || !ctx.gmailClient) {
        ctx.logger.info(`[Dry Run] gmail.reply (${config.mode}) simulated for thread ${threadId}`);
        results.push({
          json: {
            ...item.json,
            replyAction: config.mode === 'send' ? 'sent' : 'drafted',
            simulated: true,
            to,
            subject,
            threadId,
            bodyPreview: bodyText.slice(0, 200),
          },
        });
        continue;
      }

      if (config.mode === 'send') {
        const sendResult = await ctx.gmailClient.sendReply({
          threadId: threadId || undefined,
          to,
          subject,
          bodyText,
          inReplyTo: inReplyTo || undefined,
          references: references || undefined,
        });

        results.push({
          json: {
            ...item.json,
            replyAction: 'sent',
            messageId: sendResult.messageId,
            threadId: sendResult.threadId,
            to,
            subject,
          },
        });
      } else {
        const draftResult = await ctx.gmailClient.createDraft({
          threadId: threadId || undefined,
          to,
          subject,
          bodyText,
        });

        results.push({
          json: {
            ...item.json,
            replyAction: 'drafted',
            draftId: draftResult.draftId,
            threadId: draftResult.message.threadId,
            to,
            subject,
          },
        });
      }
    }

    return { main: results };
  },
};
