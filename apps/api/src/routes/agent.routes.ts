import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  eq,
  and,
  desc,
  asc,
  gt,
  sql,
  conversations,
  messages,
  agentRuns,
  agentRunEvents,
  integrations,
  userSettings,
} from '@flowcart/db';
import { AgentRunner, AgentEvent } from '@flowcart/agent';
import { GmailClient } from '@flowcart/gmail';
import { Env } from '@flowcart/shared';
import { EventEmitter } from 'node:events';
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.middleware.js';

export interface AgentRouteOptions {
  db: any;
  env: Env;
  gmailTokenService: any;
  llmService: any;
}

// In-memory run bus for live SSE streaming
const runEventBus = new EventEmitter();
runEventBus.setMaxListeners(100);

export const agentRoutes: FastifyPluginAsync<AgentRouteOptions> = async (
  app,
  options
) => {
  const { db, env, gmailTokenService, llmService } = options;
  const requireAuth = createAuthMiddleware(db, env);
  const requireCsrf = createCsrfMiddleware(env);

  // GET /api/agent/conversations
  app.get('/api/agent/conversations', { preHandler: [requireAuth] }, async (req) => {
    const user = req.user!;
    const list = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(desc(conversations.updatedAt));

    return { conversations: list };
  });

  // POST /api/agent/conversations
  app.post('/api/agent/conversations', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const bodySchema = z.object({
      title: z.string().optional(),
      temporary: z.boolean().optional().default(false),
    });

    const parsed = bodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_BODY', message: 'Invalid conversation payload' },
      });
    }

    const [conv] = await db
      .insert(conversations)
      .values({
        userId: user.id,
        kind: 'chat',
        title: parsed.data.title || 'New Conversation',
        temporary: parsed.data.temporary || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return { conversation: conv };
  });

  // GET /api/agent/conversations/:id
  app.get('/api/agent/conversations/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const paramsSchema = z.object({ id: z.string().uuid() });
    const p = paramsSchema.safeParse(req.params);

    if (!p.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARAMS', message: 'Invalid conversation ID' },
      });
    }

    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, p.data.id), eq(conversations.userId, user.id)))
      .limit(1);

    if (!conv) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    const messageList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(asc(messages.id));

    return {
      conversation: conv,
      messages: messageList,
    };
  });

  // PATCH /api/agent/conversations/:id
  app.patch('/api/agent/conversations/:id', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const paramsSchema = z.object({ id: z.string().uuid() });
    const bodySchema = z.object({ title: z.string().min(1).max(200) });

    const p = paramsSchema.safeParse(req.params);
    const b = bodySchema.safeParse(req.body);

    if (!p.success || !b.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_INPUT', message: 'Invalid title or conversation ID' },
      });
    }

    const [updated] = await db
      .update(conversations)
      .set({ title: b.data.title, updatedAt: new Date() })
      .where(and(eq(conversations.id, p.data.id), eq(conversations.userId, user.id)))
      .returning();

    if (!updated) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
    }

    return { conversation: updated };
  });

  // DELETE /api/agent/conversations/:id
  app.delete('/api/agent/conversations/:id', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const paramsSchema = z.object({ id: z.string().uuid() });
    const p = paramsSchema.safeParse(req.params);

    if (!p.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARAMS', message: 'Invalid conversation ID' },
      });
    }

    await db
      .delete(conversations)
      .where(and(eq(conversations.id, p.data.id), eq(conversations.userId, user.id)));

    return { success: true };
  });

  // POST /api/agent/messages
  app.post('/api/agent/messages', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const bodySchema = z.object({
      conversationId: z.string().uuid().optional(),
      text: z.string().min(1).max(5000),
      temporary: z.boolean().optional().default(false),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_BODY', message: parsed.error.issues[0]?.message || 'Invalid message' },
      });
    }

    let conversationId = parsed.data.conversationId;

    if (conversationId) {
      const [existing] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Conversation not found' },
        });
      }
    } else {
      const [newConv] = await db
        .insert(conversations)
        .values({
          userId: user.id,
          title: parsed.data.text.slice(0, 30) + '...',
          temporary: parsed.data.temporary || false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      conversationId = newConv.id;
    }

    const activeConvId: string = conversationId as string;

    // Save user message
    await db.insert(messages).values({
      conversationId: activeConvId,
      role: 'user',
      content: parsed.data.text,
      createdAt: new Date(),
    });

    // Create Agent Run
    const [run] = await db
      .insert(agentRuns)
      .values({
        conversationId: activeConvId,
        userId: user.id,
        source: 'command',
        status: 'running',
        model: env.LLM_MODEL_AGENT || 'default',
        createdAt: new Date(),
      })
      .returning();

    // Start background run execution
    (async () => {
      try {
        let gmailClient: GmailClient | undefined;
        const [integration] = await db
          .select()
          .from(integrations)
          .where(and(eq(integrations.userId, user.id), eq(integrations.status, 'active')))
          .limit(1);

        if (integration && gmailTokenService) {
          try {
            const auth = await gmailTokenService.getAuthenticatedClient(integration.id);
            gmailClient = new GmailClient(auth);
          } catch (tErr) {
            app.log.warn({ err: tErr }, 'Gmail client auth failed for agent run');
          }
        }

        const [settings] = await db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, user.id))
          .limit(1);

        const serverCtx = {
          userId: user.id,
          runId: run.id,
          db,
          llmClient: llmService.getAdapter({ userId: user.id }),
          gmailClient,
          userEmail: user.email,
          userName: user.name || undefined,
          timezone: user.timezone,
          autoSendEnabled: settings?.autoSendEnabled || false,
          memoryEnabled: !parsed.data.temporary && (settings?.memoryEnabled !== false),
        };

        const runner = new AgentRunner();

        const previousMessages = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, activeConvId))
          .orderBy(asc(messages.id));

        const history = previousMessages
          .filter((m: any) => m.content !== parsed.data.text)
          .slice(-10)
          .map((m: any) => ({
            role: m.role as any,
            content: m.content || '',
            toolCalls: m.toolCalls,
            toolCallId: m.toolCallId,
          }));

        const result = await runner.run(
          serverCtx,
          {
            conversationId: activeConvId,
            userMessage: parsed.data.text,
            history,
          },
          {
            onEvent: async (ev: AgentEvent) => {
              try {
                await db.insert(agentRunEvents).values({
                  runId: run.id,
                  seq: ev.seq,
                  type: ev.type,
                  data: ev.data,
                  createdAt: new Date(),
                });
              } catch {
                // Ignore transient event db insert errors
              }

              runEventBus.emit(`run:${run.id}`, ev);
            },
          }
        );

        await db
          .update(agentRuns)
          .set({
            status: result.status,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
            iterations: result.iterations,
            error: result.error,
            finishedAt: new Date(),
          })
          .where(eq(agentRuns.id, run.id));

        if (result.replyText) {
          await db.insert(messages).values({
            conversationId: activeConvId,
            role: 'assistant',
            content: result.replyText,
            tokensIn: result.tokensIn,
            tokensOut: result.tokensOut,
            createdAt: new Date(),
          });
        }

        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, activeConvId));
      } catch (runErr: any) {
        app.log.error(runErr, `Agent run ${run.id} failed`);
        await db
          .update(agentRuns)
          .set({
            status: 'failed',
            error: runErr.message,
            finishedAt: new Date(),
          })
          .where(eq(agentRuns.id, run.id));

        const errorEv: AgentEvent = {
          runId: run.id,
          seq: 9999,
          type: 'error',
          data: { message: runErr.message },
        };
        runEventBus.emit(`run:${run.id}`, errorEv);
      }
    })();

    return {
      conversationId,
      runId: run.id,
      status: 'running',
    };
  });

  // GET /api/agent/runs/:id
  app.get('/api/agent/runs/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const paramsSchema = z.object({ id: z.string().uuid() });
    const p = paramsSchema.safeParse(req.params);

    if (!p.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARAMS', message: 'Invalid run ID' },
      });
    }

    const [run] = await db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, p.data.id), eq(agentRuns.userId, user.id)))
      .limit(1);

    if (!run) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Agent run not found' },
      });
    }

    const events = await db
      .select()
      .from(agentRunEvents)
      .where(eq(agentRunEvents.runId, run.id))
      .orderBy(asc(agentRunEvents.seq));

    return {
      run,
      events,
    };
  });

  // GET /api/agent/runs/:id/stream (Server-Sent Events)
  app.get('/api/agent/runs/:id/stream', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const paramsSchema = z.object({ id: z.string().uuid() });
    const p = paramsSchema.safeParse(req.params);

    if (!p.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARAMS', message: 'Invalid run ID' },
      });
    }

    const [run] = await db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, p.data.id), eq(agentRuns.userId, user.id)))
      .limit(1);

    if (!run) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Agent run not found' },
      });
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    let lastEventSeq = 0;
    const lastEventIdHeader = req.headers['last-event-id'];
    if (lastEventIdHeader) {
      const parsedSeq = parseInt(lastEventIdHeader as string, 10);
      if (!isNaN(parsedSeq)) {
        lastEventSeq = parsedSeq;
      }
    }

    try {
      const pastEvents = await db
        .select()
        .from(agentRunEvents)
        .where(
          and(
            eq(agentRunEvents.runId, run.id),
            lastEventSeq > 0 ? gt(agentRunEvents.seq, lastEventSeq) : sql`1=1`
          )
        )
        .orderBy(asc(agentRunEvents.seq));

      for (const ev of pastEvents) {
        reply.raw.write(`id: ${ev.seq}\n`);
        reply.raw.write(`event: ${ev.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(ev.data)}\n\n`);
        lastEventSeq = Math.max(lastEventSeq, ev.seq);
      }
    } catch {
      // Non-fatal replay error
    }

    const channelName = `run:${run.id}`;
    const liveHandler = (ev: AgentEvent) => {
      if (ev.seq > lastEventSeq) {
        lastEventSeq = ev.seq;
        reply.raw.write(`id: ${ev.seq}\n`);
        reply.raw.write(`event: ${ev.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(ev.data)}\n\n`);
      }
    };

    runEventBus.on(channelName, liveHandler);

    const heartbeatTimer = setInterval(() => {
      reply.raw.write(`: heartbeat\n\n`);
    }, 15000);

    req.raw.on('close', () => {
      clearInterval(heartbeatTimer);
      runEventBus.off(channelName, liveHandler);
    });
  });

  // POST /api/agent/runs/:id/cancel
  app.post('/api/agent/runs/:id/cancel', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const paramsSchema = z.object({ id: z.string().uuid() });
    const p = paramsSchema.safeParse(req.params);

    if (!p.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARAMS', message: 'Invalid run ID' },
      });
    }

    const [run] = await db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, p.data.id), eq(agentRuns.userId, user.id)))
      .limit(1);

    if (!run) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Agent run not found' },
      });
    }

    await db
      .update(agentRuns)
      .set({ status: 'cancelled', finishedAt: new Date() })
      .where(eq(agentRuns.id, run.id));

    runEventBus.emit(`run:${run.id}`, {
      runId: run.id,
      seq: 9998,
      type: 'run_finished',
      data: { status: 'cancelled' },
    });

    return { success: true, status: 'cancelled' };
  });
};
