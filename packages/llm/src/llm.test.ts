import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema, extractJsonFromText } from './schema-helper.js';
import { MockAdapter } from './adapters/mock.js';
import { LLMService } from './service.js';

describe('LLM Layer & Abstraction Tests (Phase 6 & Section 10.3)', () => {
  it('1. zodToJsonSchema converts Zod object to valid JSON Schema', () => {
    const testSchema = z.object({
      category: z.enum(['support', 'sales', 'billing', 'other']).describe('Classification category'),
      confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
      reason: z.string().describe('One line justification'),
      optionalNote: z.string().optional(),
    });

    const jsonSchema = zodToJsonSchema(testSchema);
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties.category.enum).toEqual(['support', 'sales', 'billing', 'other']);
    expect(jsonSchema.properties.confidence.type).toBe('number');
    expect(jsonSchema.properties.reason.type).toBe('string');
    expect(jsonSchema.required).toEqual(['category', 'confidence', 'reason']);
    expect(jsonSchema.required).not.toContain('optionalNote');
  });

  it('2. extractJsonFromText extracts JSON from raw text and markdown fences', () => {
    const direct = '{"foo": "bar"}';
    expect(extractJsonFromText(direct)).toEqual({ foo: 'bar' });

    const fenced = 'Here is your output:\n```json\n{\n  "status": "ok",\n  "count": 42\n}\n```\nHope that helps!';
    expect(extractJsonFromText(fenced)).toEqual({ status: 'ok', count: 42 });

    const surrounding = 'Prefix text {"result": true} suffix text';
    expect(extractJsonFromText(surrounding)).toEqual({ result: true });
  });

  it('3. MockAdapter.generateObject performs intelligent fallback classification', async () => {
    const adapter = new MockAdapter();
    const classifySchema = z.object({
      category: z.string(),
      confidence: z.number(),
      reason: z.string(),
    });

    // Support email
    const supportRes = await adapter.generateObject({
      messages: [
        { role: 'user', content: 'Subject: Cannot connect my Google account on Safari. Need urgent help!' },
      ],
      schema: classifySchema,
    });
    expect(supportRes.object.category).toBe('support_question');
    expect(supportRes.object.confidence).toBeGreaterThanOrEqual(0.8);
    expect(supportRes.usage.tokensIn).toBeGreaterThan(0);

    // Sales lead email
    const salesRes = await adapter.generateObject({
      messages: [
        { role: 'user', content: 'Subject: Enterprise pricing and demo quote for team of 50' },
      ],
      schema: classifySchema,
    });
    expect(salesRes.object.category).toBe('sales_lead');

    // Billing email
    const billingRes = await adapter.generateObject({
      messages: [
        { role: 'user', content: 'Subject: Receipt for payment #88392 charge invoice' },
      ],
      schema: classifySchema,
    });
    expect(billingRes.object.category).toBe('billing');
  });

  it('4. MockAdapter.embed generates normalized 1536-dimensional embeddings', async () => {
    const adapter = new MockAdapter();
    const res = await adapter.embed({
      texts: ['Hello world', 'Email automation flow'],
    });

    expect(res.embeddings).toHaveLength(2);
    expect(res.embeddings[0]).toHaveLength(1536);

    // Vector should be unit-normalized (magnitude ≈ 1.0)
    const magnitude = Math.sqrt(res.embeddings[0].reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 4);
  });

  it('5. LLMService routes through adapter and records usage events', async () => {
    const usageSpy = vi.fn();
    const service = new LLMService(
      {
        defaultProvider: 'mock',
        modelFast: 'fast-mock',
      },
      usageSpy
    );

    const schema = z.object({ answer: z.string() });
    const res = await service.generateObject({
      messages: [{ role: 'user', content: 'Test question' }],
      schema,
      purpose: 'classify',
      userId: 'usr_mock_123',
    });

    expect(res.object).toBeDefined();
    expect(usageSpy).toHaveBeenCalledTimes(1);
    expect(usageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr_mock_123',
        purpose: 'classify',
        tokensIn: expect.any(Number),
        tokensOut: expect.any(Number),
      })
    );
  });

  it('6. LLMService gracefully falls back to MockAdapter when API key is missing', () => {
    const service = new LLMService({
      defaultProvider: 'openai',
      openaiApiKey: '', // empty key
    });

    const adapter = service.getAdapter();
    expect(adapter.provider).toBe('mock');
  });

  it('7. LLMService.chat streams tokens and records usage', async () => {
    const usageSpy = vi.fn();
    const service = new LLMService(
      {
        defaultProvider: 'mock',
      },
      usageSpy
    );

    const stream = service.chat({
      messages: [{ role: 'user', content: 'Draft a quick reply' }],
      purpose: 'agent',
      userId: 'usr_chat_1',
    });

    const events = [];
    for await (const event of stream) {
      events.push(event);
    }

    const deltas = events.filter((e) => e.type === 'text_delta');
    expect(deltas.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'done')).toBe(true);
    expect(usageSpy).toHaveBeenCalledTimes(1);
  });
});
