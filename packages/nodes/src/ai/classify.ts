import { z } from 'zod';
import { WorkflowItem } from '@flowcart/shared';
import { NodeDefinition, NodeExecutionContext, NodeRunResult } from '../types.js';
import { MockAdapter, LLMService } from '@flowcart/llm';

export const classifyConfigSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
      })
    )
    .min(2)
    .max(12),
  instructions: z.string().optional(),
  minConfidence: z.number().min(0).max(1).default(0.6),
  input: z.string().default('{{ json.subject }} \n\n {{ json.bodyText || json.snippet || "" }}'),
  model: z.string().optional(),
});

export type ClassifyConfig = z.infer<typeof classifyConfigSchema>;

export const aiClassifyNode: NodeDefinition<ClassifyConfig> = {
  type: 'ai.classify',
  label: 'AI Classify',
  category: 'ai',
  outputs: ['support_question', 'sales_lead', 'billing', 'other'],
  configSchema: classifyConfigSchema,
  defaults: {
    categories: [
      {
        name: 'support_question',
        description: 'Customer asks for help, technical assistance or problem resolution',
      },
      {
        name: 'sales_lead',
        description: 'Someone wants to buy, get a quote, demo, or pricing consultation',
      },
      {
        name: 'billing',
        description: 'Invoices, receipts, payments, charges, or subscription queries',
      },
    ],
    instructions: 'Classify the incoming email strictly based on the primary intent.',
    minConfidence: 0.6,
    input: '{{ json.subject }} \n\n {{ json.bodyText || json.snippet || "" }}',
  },
  isWrite: false,

  async run(
    ctx: NodeExecutionContext,
    items: WorkflowItem[],
    config: ClassifyConfig
  ): Promise<NodeRunResult> {
    const categoryNames = config.categories.map((c) => c.name);
    const validOutputs = [...categoryNames, 'other'];

    const result: NodeRunResult = {};
    for (const out of validOutputs) {
      result[out] = [];
    }

    // Dynamic schema for fast model structured output
    const classificationSchema = z.object({
      category: z.enum([categoryNames[0], ...categoryNames.slice(1), 'other'] as [string, ...string[]]),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    });

    // Resolve LLM client or fallback to MockAdapter
    const llm = ctx.llmClient || new MockAdapter();

    for (const item of items) {
      // Extract text content from item
      const subject = item.json?.subject || '';
      const body = item.json?.bodyText || item.json?.snippet || item.json?.text || '';
      const inputContent = `${subject}\n\n${body}`.trim() || JSON.stringify(item.json);

      const categoryDescriptions = config.categories
        .map((c) => `- ${c.name}: ${c.description}`)
        .join('\n');

      const systemPrompt = `You are a high-precision email triage classifier.
Categories:
${categoryDescriptions}
- other: Any email that does not clearly fit the above categories.

Instructions: ${config.instructions || 'Classify the text into exactly one category with a confidence between 0.0 and 1.0 and a brief reason.'}`;

      let classification: { category: string; confidence: number; reason: string };

      try {
        const res = await llm.generateObject({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: inputContent },
          ],
          schema: classificationSchema,
          model: config.model,
          purpose: 'classify',
          userId: ctx.userId,
          signal: ctx.signal,
        });

        classification = res.object;
      } catch (err: any) {
        ctx.logger.warn(`Classification model call failed, falling back to "other": ${err.message}`);
        classification = {
          category: 'other',
          confidence: 0.1,
          reason: `Model error fallback: ${err.message}`,
        };
      }

      // Check minConfidence threshold (Section 8.7 rule: below minConfidence goes to "other")
      let targetOutput = classification.category;
      if (
        classification.confidence < (config.minConfidence ?? 0.6) ||
        !validOutputs.includes(targetOutput)
      ) {
        targetOutput = 'other';
      }

      const enrichedItem: WorkflowItem = {
        ...item,
        json: {
          ...item.json,
          classification: {
            category: classification.category,
            confidence: classification.confidence,
            reason: classification.reason,
            routedTo: targetOutput,
          },
        },
      };

      if (!result[targetOutput]) {
        result[targetOutput] = [];
      }
      result[targetOutput].push(enrichedItem);
    }

    return result;
  },
};
