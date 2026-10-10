import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, desc, count, users, sessions, executions, agentRuns, auditLog } from '@flowcart/db';
import { Env } from '@flowcart/shared';
import { createAuthMiddleware, createAdminMiddleware, createCsrfMiddleware } from '../middleware/auth.middleware.js';

export interface AdminRoutesOptions {
  db: any;
  env: Env;
  redis?: any;
}

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (app, opts) => {
  const { db, env } = opts;
  const requireAuth = createAuthMiddleware(db, env);
  const requireAdmin = createAdminMiddleware();
  const verifyCsrf = createCsrfMiddleware(env);

  // All admin routes require valid authentication and admin role
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', requireAdmin);

  // GET /admin/users (Section 12.9 & 13)
  app.get('/admin/users', async () => {
    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
        disabledAt: users.disabledAt,
        failedLogins: users.failedLogins,
        timezone: users.timezone,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(100);

    return { users: userList };
  });

  // POST /admin/users/:id/disable (Section 12.9 & 13)
  app.post('/admin/users/:id/disable', { preHandler: verifyCsrf }, async (req, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const p = paramsSchema.safeParse(req.params);
    if (!p.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARAMS', message: 'Invalid user ID' },
      });
    }

    const targetUserId = p.data.id;
    if (targetUserId === req.user!.id) {
      return reply.status(400).send({
        error: { code: 'CANNOT_DISABLE_SELF', message: 'You cannot disable your own administrator account' },
      });
    }

    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    const now = new Date();
    await db.update(users).set({ disabledAt: now }).where(eq(users.id, targetUserId));

    // Immediately revoke all active sessions for this user
    await db.delete(sessions).where(eq(sessions.userId, targetUserId));

    // Audit log entry
    await db.insert(auditLog).values({
      userId: req.user!.id,
      action: 'admin_user_disabled',
      detail: { targetUserId, targetEmail: targetUser.email },
      ip: req.ip,
      userAgent: (req.headers['user-agent'] as string) || null,
    });

    return { success: true };
  });

  // POST /admin/users/:id/enable (Section 12.9 & 13)
  app.post('/admin/users/:id/enable', { preHandler: verifyCsrf }, async (req, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid() });
    const p = paramsSchema.safeParse(req.params);
    if (!p.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARAMS', message: 'Invalid user ID' },
      });
    }

    const targetUserId = p.data.id;
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!targetUser) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }

    await db
      .update(users)
      .set({
        disabledAt: null,
        failedLogins: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, targetUserId));

    // Audit log entry
    await db.insert(auditLog).values({
      userId: req.user!.id,
      action: 'admin_user_enabled',
      detail: { targetUserId, targetEmail: targetUser.email },
      ip: req.ip,
      userAgent: (req.headers['user-agent'] as string) || null,
    });

    return { success: true };
  });

  // GET /admin/queues (Section 12.9 & 13)
  app.get('/admin/queues', async () => {
    const executionStats = await db
      .select({
        status: executions.status,
        count: count(),
      })
      .from(executions)
      .groupBy(executions.status);

    const agentRunStats = await db
      .select({
        status: agentRuns.status,
        count: count(),
      })
      .from(agentRuns)
      .groupBy(agentRuns.status);

    const recentFailed = await db
      .select({
        id: executions.id,
        workflowId: executions.workflowId,
        status: executions.status,
        error: executions.error,
        createdAt: executions.createdAt,
      })
      .from(executions)
      .where(eq(executions.status, 'failed'))
      .orderBy(desc(executions.createdAt))
      .limit(10);

    return {
      executionsByStatus: Object.fromEntries(executionStats.map((r: any) => [r.status, Number(r.count)])),
      agentRunsByStatus: Object.fromEntries(agentRunStats.map((r: any) => [r.status, Number(r.count)])),
      recentFailedJobs: recentFailed,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  });
};
