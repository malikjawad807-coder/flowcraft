import { z } from 'zod';
import { NodeDefinition } from '../types.js';
import { WorkflowItem } from '@flowcart/shared';

const fieldAssignmentSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  value: z.any(),
});

const configSchema = z.object({
  fields: z.array(fieldAssignmentSchema).default([]),
  keepOthers: z.boolean().default(true),
});

type Config = z.infer<typeof configSchema>;

export const dataSetNode: NodeDefinition<Config> = {
  type: 'data.set',
  label: 'Set Fields',
  category: 'data',
  outputs: ['main'],
  configSchema,
  defaults: {
    fields: [],
    keepOthers: true,
  },
  isWrite: false,
  async run(_ctx, items, config) {
    const updatedItems: WorkflowItem[] = [];

    for (const item of items) {
      const baseJson = config.keepOthers ? { ...item.json } : {};

      for (const f of config.fields) {
        baseJson[f.name] = f.value;
      }

      updatedItems.push({
        ...item,
        json: baseJson,
      });
    }

    return {
      main: updatedItems,
    };
  },
};
