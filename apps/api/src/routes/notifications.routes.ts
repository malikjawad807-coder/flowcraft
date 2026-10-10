import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, desc, notifications, approvals } from '@flowcart/db';
import { Env } from '@flowcart/shared';
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.middleware.js';

export interface NotificationsRouteOptions {
  db: any;
  env?: Env;
}

export const notificationsRoutes: FastifyPluginAsync<NotificationsRouteOptions> = async (
  app,
  options
) => {
  const { db, env } = options;
  const requireAuth = createAuthMiddleware(db, env as any);
  const requireCsrf = createCsrfMiddleware(env as any);

  // GET /api/notifications
  app.get('/api/notifications', { preHandler: [requireAuth] }, async (req) => {
    const user = req.user!;
    const list = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const pendingApprovals = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.userId, user.id), eq(approvals.status, 'pending')));

    const unreadCount = list.filter((n: any) => !n.read).length + pendingApprovals.length;

    return {
      notifications: list,
      pendingApprovalsCount: pendingApprovals.length,
      unreadCount,
    };
  });

  // POST /api/notifications/:id/read
  app.post('/api/notifications/:id/read', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const paramsSchema = z.object({ id: z.string().uuid() });
    const p = paramsSchema.safeParse(req.params);

    if (!p.success) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARAMS', message: 'Invalid notification ID' },
      });
    }

    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, p.data.id), eq(notifications.userId, user.id)));

    return { success: true };
  });
};
