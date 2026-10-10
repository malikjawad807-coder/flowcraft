import { z } from 'zod';
import { NodeDefinition, NodeExecutionContext, NodeRunResult } from '../types.js';
import { WorkflowItem } from '@flowcart/shared';
import { wrapUntrustedEmail } from '@flowcart/agent';

export const aiAgentConfigSchema = z.object({
  goal: z.string().min(1).describe('Goal instruction for the agent'),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional().default(0.2),
  allowedTools: z.array(z.string()).optional().default([
    'gmail_search',
    'gmail_get_thread',
    'gmail_get_message',
    'memory_search',
  ]),
  minConfidence: z.number().min(0).max(1).optional().default(0.7),
});

export type AiAgentConfig = z.infer<typeof aiAgentConfigSchema>;

export const aiAgentOutputSchema = z.object({
  replyText: z.string().describe('Drafted reply text or answer'),
  needsHuman: z.boolean().describe('Whether human intervention is required'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0.00 to 1.00'),
  reason: z.string().describe('Explanation of decision and reply'),
});

export type AiAgentOutput = z.infer<typeof aiAgentOutputSchema>;

export const aiAgentNode: NodeDefinition<AiAgentConfig> = {
  type: 'ai.agent',
  label: 'AI Agent',
  category: 'ai',
  outputs: ['done', 'needs_human'],
  configSchema: aiAgentConfigSchema,
  defaults: {
    goal: 'Read the thread, then write a short, helpful reply in the sender\'s language that answers only what is asked, never promises prices, dates or refunds that are not in the thread, and asks one clarifying question if needed.',
    temperature: 0.2,
    allowedTools: [
      'gmail_search',
      'gmail_get_thread',
      'gmail_get_message',
      'memory_search',
    ],
    minConfidence: 0.7,
  },
  isWrite: false,
  async run(
    ctx: NodeExecutionContext,
    items: WorkflowItem[],
    config: AiAgentConfig
  ): Promise<NodeRunResult> {
    const doneItems: WorkflowItem[] = [];
    const needsHumanItems: WorkflowItem[] = [];

    for (const item of items) {
      if (!ctx.llmClient) {
        throw new Error('LLM client not available in execution context');
      }

      const emailSubject = item.json.subject || '';
      const emailBody = item.json.bodyText || item.json.snippet || JSON.stringify(item.json);
      const safeEmailBody = wrapUntrustedEmail(emailBody, 6000);

      const promptMessages = [
        {
          role: 'system' as const,
          content: `You are an AI Email Assistant executing an automated workflow task.
Goal: ${config.goal}

You must return a JSON object with:
- "replyText": A concise, polite reply matching the sender's language and tone.
- "needsHuman": boolean (true if pricing, refunds, dates, complaints, or uncertainty require human review).
- "confidence": number (0.00 to 1.00 score indicating your confidence).
- "reason": A brief one-sentence reason for your reply and whether human intervention is needed.`,
        },
        {
          role: 'user' as const,
          content: `Incoming Email:
Subject: ${emailSubject}
Body:
${safeEmailBody}`,
        },
      ];

      try {
        const res = await ctx.llmClient.generateObject({
          model: config.model,
          temperature: config.temperature,
          messages: promptMessages,
          schema: aiAgentOutputSchema,
          purpose: 'agent',
          userId: ctx.userId,
        });

        const outputData = res.object;
        const enrichedItem: WorkflowItem = {
          ...item,
          json: {
            ...item.json,
            replyText: outputData.replyText,
            needsHuman: outputData.needsHuman,
            confidence: outputData.confidence,
            reason: outputData.reason,
          },
        };

        if (outputData.needsHuman || outputData.confidence < (config.minConfidence || 0.7)) {
          needsHumanItems.push(enrichedItem);
        } else {
          doneItems.push(enrichedItem);
        }
      } catch (err: any) {
        ctx.logger.error(`AI Agent node failed to generate structured output: ${err.message}`);
        // Fallback: route to needs_human handle on failure
        needsHumanItems.push({
          ...item,
          json: {
            ...item.json,
            replyText: '',
            needsHuman: true,
            confidence: 0,
            reason: `Agent processing failed: ${err.message}`,
          },
        });
      }
    }

    return {
      done: doneItems,
      needs_human: needsHumanItems,
    };
  },
};
