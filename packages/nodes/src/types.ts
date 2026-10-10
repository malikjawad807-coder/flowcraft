import { z } from 'zod';
import { WorkflowItem } from '@flowcart/shared';

export type NodeCategory = 'trigger' | 'logic' | 'data' | 'ai' | 'gmail' | 'control' | 'util';

export interface NodeExecutionContext {
  userId: string;
  executionId: string;
  nodeId: string;
  integration?: any;
  gmailClient?: any;
  llmClient?: any;
  logger: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  };
  signal?: AbortSignal;
  dryRun?: boolean;
}

export type NodeRunResult = Record<string, WorkflowItem[]>;

export interface NodeDefinition<TConfig = any> {
  type: string;
  label: string;
  category: NodeCategory;
  outputs: string[];
  configSchema: z.ZodType<TConfig, any, any>;
  defaults: TConfig;
  isWrite: boolean;
  run: (ctx: NodeExecutionContext, items: WorkflowItem[], config: TConfig) => Promise<NodeRunResult>;
}

export type FilterOp =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches_regex'
  | 'is_empty'
  | 'not_empty'
  | 'greater_than'
  | 'less_than';

export interface ConditionRule {
  field: string;
  op: FilterOp;
  value?: any;
}
