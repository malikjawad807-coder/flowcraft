import { z } from 'zod';
import { NodeDefinition } from '../types.js';
import { WorkflowItem } from '@flowcart/shared';

const configSchema = z.object({
  notes: z.string().optional(),
});

type Config = z.infer<typeof configSchema>;

export const manualTriggerNode: NodeDefinition<Config> = {
  type: 'manual.trigger',
  label: 'Manual Trigger',
  category: 'trigger',
  outputs: ['main'],
  configSchema,
  defaults: {},
  isWrite: false,
  async run(_ctx, items, _config) {
    if (items.length > 0) {
      return { main: items };
    }
    return {
      main: [
        {
          json: {
            triggeredAt: new Date().toISOString(),
            mode: 'manual',
          },
        },
      ],
    };
  },
};
