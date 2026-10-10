import { z } from 'zod';

export const nodeSettingsSchema = z.object({
  retryMax: z.number().int().min(0).max(3).default(0),
  retryBackoffMs: z.number().int().min(500).max(60000).default(2000),
  onError: z.enum(['stop', 'continue']).default('stop'),
});

export type NodeSettings = z.infer<typeof nodeSettingsSchema>;

export const graphNodeSchema = z.object({
  id: z.string().min(1, 'Node ID is required'),
  type: z.string().min(1, 'Node type is required'),
  name: z.string().min(1, 'Node name is required'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  config: z.record(z.any()).default({}),
  settings: nodeSettingsSchema.default({
    retryMax: 0,
    retryBackoffMs: 2000,
    onError: 'stop',
  }),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;

export const graphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  sourceHandle: z.string().optional().default('main'),
  target: z.string().min(1),
});

export type GraphEdge = z.infer<typeof graphEdgeSchema>;

export const workflowGraphSchema = z.object({
  nodes: z.array(graphNodeSchema).max(40, 'Workflow cannot exceed 40 nodes'),
  edges: z.array(graphEdgeSchema),
});

export type WorkflowGraph = z.infer<typeof workflowGraphSchema>;

export interface WorkflowItem {
  json: Record<string, any>;
  binary?: Record<string, any>;
}

export type ExecutionMode = 'trigger' | 'test' | 'manual';
export type ExecutionStatus = 'queued' | 'running' | 'waiting' | 'success' | 'failed' | 'cancelled';
export type StepStatus = 'running' | 'success' | 'failed' | 'skipped' | 'waiting';

export interface WorkflowStepResult {
  id?: number;
  nodeId: string;
  nodeType: string;
  itemIndex: number;
  status: StepStatus;
  input: any;
  output: any;
  error?: string | null;
  attempts: number;
  tokensIn?: number;
  tokensOut?: number;
  durationMs?: number;
  startedAt: string;
  finishedAt?: string;
}

export interface WorkflowExecutionResult {
  executionId: string;
  workflowId: string;
  mode: ExecutionMode;
  status: ExecutionStatus;
  error?: string | null;
  steps: WorkflowStepResult[];
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
}
