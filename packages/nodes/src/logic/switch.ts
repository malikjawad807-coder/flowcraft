import { z } from 'zod';
import { NodeDefinition } from '../types.js';
import { evaluateRuleSet } from './helpers.js';
import { WorkflowItem } from '@flowcart/shared';

const conditionRuleSchema = z.object({
  field: z.string().min(1),
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

const switchRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  combinator: z.enum(['and', 'or']).default('and'),
  conditions: z.array(conditionRuleSchema).default([]),
});

const configSchema = z.object({
  rules: z.array(switchRuleSchema).default([]),
});

type Config = z.infer<typeof configSchema>;

export const logicSwitchNode: NodeDefinition<Config> = {
  type: 'logic.switch',
  label: 'Switch',
  category: 'logic',
  outputs: ['fallback'], // default handles, dynamic handles added per rule name
  configSchema,
  defaults: {
    rules: [],
  },
  isWrite: false,
  async run(_ctx, items, config) {
    const result: Record<string, WorkflowItem[]> = {
      fallback: [],
    };

    // Initialize all rule output arrays
    for (const rule of config.rules) {
      result[rule.name] = [];
    }

    for (const item of items) {
      let matched = false;
      for (const rule of config.rules) {
        if (evaluateRuleSet(item.json, rule.combinator, rule.conditions)) {
          result[rule.name].push(item);
          matched = true;
          break; // First match wins (Section 8.7)
        }
      }
      if (!matched) {
        result.fallback.push(item);
      }
    }

    return result;
  },
};
