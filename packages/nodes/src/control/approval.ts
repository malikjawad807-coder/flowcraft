import { z } from 'zod';
import { NodeDefinition, NodeExecutionContext, NodeRunResult } from '../types.js';
import { WorkflowItem } from '@flowcart/shared';

export const controlApprovalConfigSchema = z.object({
  recipient: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  body: z.string().optional().default(''),
  timeoutHours: z.number().int().min(1).max(168).optional().default(24),
});

export type ControlApprovalConfig = z.infer<typeof controlApprovalConfigSchema>;

export class ApprovalPendingError extends Error {
  public approvalId: string;
  public preview: { recipient: string; subject: string; body: string };

  constructor(approvalId: string, preview: { recipient: string; subject: string; body: string }) {
    super(`Execution waiting for human approval (${approvalId})`);
    this.name = 'ApprovalPendingError';
    this.approvalId = approvalId;
    this.preview = preview;
  }
}

export const controlApprovalNode: NodeDefinition<ControlApprovalConfig> = {
  type: 'control.approval',
  label: 'Human Approval',
  category: 'control',
  outputs: ['approved', 'rejected'],
  configSchema: controlApprovalConfigSchema,
  defaults: {
    recipient: '',
    subject: '',
    body: '',
    timeoutHours: 24,
  },
  isWrite: false,
  async run(
    ctx: NodeExecutionContext,
    items: WorkflowItem[],
    config: ControlApprovalConfig
  ): Promise<NodeRunResult> {
    const approvedItems: WorkflowItem[] = [];
    const rejectedItems: WorkflowItem[] = [];

    for (const item of items) {
      const decision = item.json.__approvalDecision;
      if (decision === 'rejected') {
        rejectedItems.push(item);
      } else if (decision === 'approved') {
        const editedArgs = item.json.__approvalEditedArgs || {};
        approvedItems.push({
          ...item,
          json: {
            ...item.json,
            ...editedArgs,
            isApproved: true,
          },
        });
      } else {
        if (ctx.dryRun) {
          approvedItems.push({
            ...item,
            json: {
              ...item.json,
              isApproved: true,
              approvalMode: 'dry_run_auto_approved',
            },
          });
        } else {
          const recipient =
            config.recipient ||
            item.json.recipient ||
            item.json.to ||
            item.json.from?.address ||
            (typeof item.json.from === 'string' ? item.json.from : 'Unknown');
          const subject = config.subject || item.json.subject || 'Approval Request';
          const body = config.body || item.json.replyText || item.json.bodyText || item.json.snippet || '';

          const preview = { recipient, subject, body };
          throw new ApprovalPendingError(ctx.executionId, preview);
        }
      }
    }

    return {
      approved: approvedItems,
      rejected: rejectedItems,
    };
  },
};
