import { z } from 'zod';
import { NodeDefinition } from '../types.js';
import { WorkflowItem } from '@flowcart/shared';

const configSchema = z.object({
  message: z.string().default('{{ json }}'),
  level: z.enum(['info', 'warn', 'error']).default('info'),
});

type Config = z.infer<typeof configSchema>;

export const utilLogNode: NodeDefinition<Config> = {
  type: 'util.log',
  label: 'Log / Debug',
  category: 'util',
  outputs: ['main'],
  configSchema,
  defaults: {
    message: '{{ json }}',
    level: 'info',
  },
  isWrite: false,
  async run(ctx, items, config) {
    for (const item of items) {
      const msg = typeof config.message === 'string' ? config.message : JSON.stringify(config.message);
      if (config.level === 'warn') {
        ctx.logger.warn(`[Node ${ctx.nodeId}] ${msg}`);
      } else if (config.level === 'error') {
        ctx.logger.error(`[Node ${ctx.nodeId}] ${msg}`);
      } else {
        ctx.logger.info(`[Node ${ctx.nodeId}] ${msg}`);
      }
    }

    return {
      main: items,
    };
  },
};
