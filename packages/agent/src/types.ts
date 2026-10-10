import { z } from 'zod';
import type { LLMClient } from '@flowcart/llm';
import type { GmailClient } from '@flowcart/gmail';

export type ToolRisk = 'read' | 'draft' | 'send' | 'memory';

export interface ServerContext {
  userId: string;
  runId: string;
  db: any;
  llmClient: LLMClient;
  gmailIntegrationId?: string;
  gmailClient?: GmailClient;
  userEmail?: string;
  userName?: string;
  timezone?: string;
  autoSendEnabled?: boolean;
  memoryEnabled?: boolean;
  isTemporary?: boolean;
  isWorkflow?: boolean;
}

export interface ToolApprovalPreview {
  recipient: string;
  subject: string;
  body: string;
  warning?: string;
}

export interface AgentTool<TArgs = any> {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  risk: ToolRisk;
  getApprovalPreview?: (ctx: ServerContext, args: TArgs) => Promise<ToolApprovalPreview> | ToolApprovalPreview;
  execute: (ctx: ServerContext, args: TArgs) => Promise<any>;
}

export type AgentEventType =
  | 'run_started'
  | 'text_delta'
  | 'tool_call_started'
  | 'tool_call_finished'
  | 'approval_required'
  | 'memory_used'
  | 'message_final'
  | 'error'
  | 'run_finished';

export interface AgentEvent {
  id?: number;
  runId: string;
  seq: number;
  type: AgentEventType;
  data: any;
  createdAt?: string;
}

export interface AgentRunOptions {
  maxIterations?: number;
  timeoutMs?: number;
  allowedTools?: string[];
  signal?: AbortSignal;
  onEvent?: (event: AgentEvent) => Promise<void> | void;
}

export interface AgentRunResult {
  runId: string;
  conversationId: string;
  status: 'succeeded' | 'awaiting_approval' | 'failed' | 'cancelled';
  replyText?: string;
  approvalId?: string;
  approvalPreview?: ToolApprovalPreview;
  iterations: number;
  tokensIn: number;
  tokensOut: number;
  error?: string;
}
