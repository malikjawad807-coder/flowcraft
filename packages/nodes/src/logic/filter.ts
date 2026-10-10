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

export const logicFilterNode: NodeDefinition<Config> = {
  type: 'logic.filter',
  label: 'Filter',
  category: 'logic',
  outputs: ['pass'],
  configSchema,
  defaults: {
    combinator: 'and',
    conditions: [],
  },
  isWrite: false,
  async run(_ctx, items, config) {
    const passedItems: WorkflowItem[] = [];

    for (const item of items) {
      if (evaluateRuleSet(item.json, config.combinator, config.conditions)) {
        passedItems.push(item);
      }
    }

    return {
      pass: passedItems,
    };
  },
};
