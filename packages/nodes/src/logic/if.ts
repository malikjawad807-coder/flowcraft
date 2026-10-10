import { z } from 'zod';
import { NodeDefinition } from '../types.js';
import { evaluateRuleSet } from './helpers.js';
import { WorkflowItem } from '@flowcart/shared';

const conditionRuleSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  op: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'matches_regex',
    'is_empty',
    'not_empty',
    'greater_than',
    'less_than',
  ]),
  value: z.any().optional(),
});

const configSchema = z.object({
  combinator: z.enum(['and', 'or']).default('and'),
  conditions: z.array(conditionRuleSchema).default([]),
});

type Config = z.infer<typeof configSchema>;

export const logicIfNode: NodeDefinition<Config> = {
  type: 'logic.if',
  label: 'If Condition',
  category: 'logic',
  outputs: ['true', 'false'],
  configSchema,
  defaults: {
    combinator: 'and',
    conditions: [],
  },
  isWrite: false,
  async run(_ctx, items, config) {
    const trueItems: WorkflowItem[] = [];
    const falseItems: WorkflowItem[] = [];

    for (const item of items) {
      if (evaluateRuleSet(item.json, config.combinator, config.conditions)) {
        trueItems.push(item);
      } else {
        falseItems.push(item);
      }
    }

    return {
      true: trueItems,
      false: falseItems,
    };
  },
};
