import { describe, it, expect } from 'vitest';
import {
  evaluateJsonata,
  resolveTemplate,
  resolveConfigExpressions,
  ExpressionTimeoutError,
} from './expressions.js';

describe('JSONata Expression Engine (Section 8.4)', () => {
  it('evaluates basic json fields', async () => {
    const ctx = {
      json: {
        from: { name: 'Sarah', email: 'sarah@example.com' },
        amount: 42,
      },
    };

    const name = await evaluateJsonata('json.from.name', ctx);
    expect(name).toBe('Sarah');

    const total = await evaluateJsonata('json.amount * 2', ctx);
    expect(total).toBe(84);
  });

  it('interpolates template string with multiple variables', async () => {
    const ctx = {
      json: {
        from: { name: 'Sarah' },
        subject: 'Cannot login',
      },
    };

    const result = await resolveTemplate(
      'Hello {{ json.from.name }}, re: {{ json.subject }}',
      ctx
    );
    expect(result).toBe('Hello Sarah, re: Cannot login');
  });

  it('preserves typed value when template is exactly one expression', async () => {
    const ctx = {
      json: {
        tags: ['urgent', 'billing'],
        score: 95.5,
        isActive: true,
      },
    };

    const tags = await resolveTemplate('{{ json.tags }}', ctx);
    expect(tags).toEqual(['urgent', 'billing']);

    const score = await resolveTemplate('{{ json.score }}', ctx);
    expect(score).toBe(95.5);

    const active = await resolveTemplate('{{ json.isActive }}', ctx);
    expect(active).toBe(true);
  });

  it('accesses upstream node output', async () => {
    const ctx = {
      json: { email: 'test@example.com' },
      node: {
        Classify: {
          json: {
            classification: { category: 'sales_lead', confidence: 0.95 },
          },
        },
      },
    };

    const category = await evaluateJsonata(
      "node.Classify.json.classification.category",
      ctx
    );
    expect(category).toBe('sales_lead');
  });

  it('deeply resolves object configs with expressions', async () => {
    const config = {
      to: '{{ json.from.email }}',
      subject: 'Re: {{ json.subject }}',
      meta: {
        retries: 3,
        author: '{{ user.name }}',
      },
    };

    const ctx = {
      json: {
        from: { email: 'sarah@example.com' },
        subject: 'Quick question',
      },
      user: { name: 'Agent Smith' },
    };

    const resolved = await resolveConfigExpressions(config, ctx);
    expect(resolved).toEqual({
      to: 'sarah@example.com',
      subject: 'Re: Quick question',
      meta: {
        retries: 3,
        author: 'Agent Smith',
      },
    });
  });
});
