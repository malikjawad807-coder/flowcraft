import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, sql, approvals, agentRuns, messages, integrations } from '@flowcart/db';
import { AgentRunner } from '@flowcart/agent';
import { GmailClient } from '@flowcart/gmail';
import { Env } from '@flowcart/shared';
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.middleware.js';

export interface ApprovalsRouteOptions {
  db: any;
  env: Env;
  gmailTokenService: any;
  llmService: any;
}

export const approvalsRoutes: FastifyPluginAsync<ApprovalsRouteOptions> = async (
  app,
  options
) => {
  const { db, env, gmailTokenService, llmService } = options;
  const requireAuth = createAuthMiddleware(db, env);
  const requireCsrf = createCsrfMiddleware(env);

  // GET /api/approvals?status=pending
  app.get('/api/approvals', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const querySchema = z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'expired', 'all']).optional().default('pending'),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_QUERY', message: 'Invalid query parameters' },
      });
    }

    const now = new Date();
    // Auto-expire overdue pending approvals
    try {
      const pendingList = await db
        .select()
        .from(approvals)
        .where(and(eq(approvals.userId, user.id), eq(approvals.status, 'pending')));

      for (const item of pendingList) {
        if (new Date(item.expiresAt) < now) {
          await db
            .update(approvals)
            .set({ status: 'expired' })
            .where(eq(approvals.id, item.id));
        }
      }
    } catch {
      // Non-fatal expiration check
    }

    let rows: any[] = [];
    if (parsed.data.status === 'all') {
      rows = await db
        .select()
        .from(approvals)
        .where(eq(approvals.userId, user.id))
        .orderBy(desc(approvals.createdAt));
    } else {
      rows = await db
        .select()
        .from(approvals)
        .where(and(eq(approvals.userId, user.id), eq(approvals.status, parsed.data.status)))
        .orderBy(desc(approvals.createdAt));
    }

    return { approvals: rows };
  });

  // POST /api/approvals/:id/approve { editedArgs?: any }
  app.post('/api/approvals/:id/approve', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({ editedArgs: z.record(z.any()).optional() });

    const p = paramsSchema.safeParse(req.params);
    const b = bodySchema.safeParse(req.body || {});

    if (!p.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARAMS', message: 'Invalid approval ID' },
      });
    }

    const [approval] = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, p.data.id), eq(approvals.userId, user.id)))
      .limit(1);

    if (!approval) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Approval not found' },
      });
    }

    if (approval.status !== 'pending') {
      return reply.status(400).send({
        error: { code: 'ALREADY_DECIDED', message: `Approval is already ${approval.status}` },
      });
    }

    const editedArgs = b.success && b.data.editedArgs ? b.data.editedArgs : null;

    await db
      .update(approvals)
      .set({
        status: 'approved',
        editedArgs,
        decidedAt: new Date(),
      })
      .where(eq(approvals.id, approval.id));

    // If attached to an agent run, resume the agent run asynchronously
    if (approval.runId) {
      (async () => {
        try {
          const [run] = await db
            .select()
            .from(agentRuns)
            .where(eq(agentRuns.id, approval.runId))
            .limit(1);

          if (run && run.status === 'awaiting_approval') {
            await db
              .update(agentRuns)
              .set({ status: 'running' })
              .where(eq(agentRuns.id, run.id));

            // Resolve Gmail integration
            let gmailClient: GmailClient | undefined;
            const [integration] = await db
              .select()
              .from(integrations)
              .where(and(eq(integrations.userId, user.id), eq(integrations.status, 'active')))
              .limit(1);

            if (integration && gmailTokenService) {
              const auth = await gmailTokenService.getAuthenticatedClient(integration.id);
              gmailClient = new GmailClient(auth);
            }

            const runner = new AgentRunner();
            const serverCtx = {
              userId: user.id,
              runId: run.id,
              db,
              llmClient: llmService.getAdapter({ userId: user.id }),
              gmailClient,
              userEmail: user.email,
              userName: user.name || undefined,
              timezone: user.timezone,
            };

            const result = await runner.run(serverCtx, {
              conversationId: run.conversationId,
              userMessage: '',
              pendingApprovalDecision: {
                approvalId: approval.id,
                decision: 'approved',
                editedArgs,
                toolCall: {
                  id: 'tc-resumed',
                  name: approval.toolName,
                  args: approval.args,
                },
              },
            });

            await db
              .update(agentRuns)
              .set({
                status: result.status,
                tokensIn: sql`${agentRuns.tokensIn} + ${result.tokensIn}`,
                tokensOut: sql`${agentRuns.tokensOut} + ${result.tokensOut}`,
                finishedAt: new Date(),
              })
              .where(eq(agentRuns.id, run.id));

            if (result.replyText) {
              await db.insert(messages).values({
                conversationId: run.conversationId,
                role: 'assistant',
                content: result.replyText,
                tokensIn: result.tokensIn,
                tokensOut: result.tokensOut,
                createdAt: new Date(),
              });
            }
          }
        } catch (err: any) {
          app.log.error(err, `Error resuming agent run ${approval.runId}`);
        }
      })();
    }

    return {
      success: true,
      status: 'approved',
      approvalId: approval.id,
    };
  });

  // POST /api/approvals/:id/reject
  app.post('/api/approvals/:id/reject', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const paramsSchema = z.object({ id: z.string().uuid() });
    const p = paramsSchema.safeParse(req.params);

    if (!p.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARAMS', message: 'Invalid approval ID' },
      });
    }

    const [approval] = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, p.data.id), eq(approvals.userId, user.id)))
      .limit(1);

    if (!approval) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Approval not found' },
      });
    }

    if (approval.status !== 'pending') {
      return reply.status(400).send({
        error: { code: 'ALREADY_DECIDED', message: `Approval is already ${approval.status}` },
      });
    }

    await db
      .update(approvals)
      .set({
        status: 'rejected',
        decidedAt: new Date(),
      })
      .where(eq(approvals.id, approval.id));

    // If attached to an agent run, resume with rejection
    if (approval.runId) {
      (async () => {
        try {
          const [run] = await db
            .select()
            .from(agentRuns)
            .where(eq(agentRuns.id, approval.runId))
            .limit(1);

          if (run && run.status === 'awaiting_approval') {
            await db
              .update(agentRuns)
              .set({ status: 'running' })
              .where(eq(agentRuns.id, run.id));

            const runner = new AgentRunner();
            const serverCtx = {
              userId: user.id,
              runId: run.id,
              db,
              llmClient: llmService.getAdapter({ userId: user.id }),
              userEmail: user.email,
              userName: user.name || undefined,
              timezone: user.timezone,
            };

            const result = await runner.run(serverCtx, {
              conversationId: run.conversationId,
              userMessage: '',
              pendingApprovalDecision: {
                approvalId: approval.id,
                decision: 'rejected',
                toolCall: {
                  id: 'tc-rejected',
                  name: approval.toolName,
                  args: approval.args,
                },
              },
            });

            await db
              .update(agentRuns)
              .set({
                status: result.status,
                finishedAt: new Date(),
              })
              .where(eq(agentRuns.id, run.id));

            if (result.replyText) {
              await db.insert(messages).values({
                conversationId: run.conversationId,
                role: 'assistant',
                content: result.replyText,
                createdAt: new Date(),
              });
            }
          }
        } catch (err: any) {
          app.log.error(err, `Error resuming agent run rejection ${approval.runId}`);
        }
      })();
    }

    return {
      success: true,
      status: 'rejected',
      approvalId: approval.id,
    };
  });
};
