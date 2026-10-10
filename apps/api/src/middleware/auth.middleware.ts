import { FastifyRequest, FastifyReply } from 'fastify';
import { sessions, users, mfaFactors, eq, and, gt, isNotNull } from '@flowcart/db';
import { hashToken, verifyCsrfToken, AuthenticatedUser, Env } from '@flowcart/shared';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    sessionId?: string;
  }
}

export function createAuthMiddleware(db: any, env: Env) {
  return async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
    const cookieName = env.SESSION_COOKIE_NAME || 'fc_sid';
    const cookieValue = req.cookies[cookieName];

    if (!cookieValue) {
      return reply.status(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }

    const idHash = hashToken(cookieValue);
    const now = new Date();

    const [sessionRecord] = await db
      .select({
        idHash: sessions.idHash,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        absoluteExpiresAt: sessions.absoluteExpiresAt,
        lastSeenAt: sessions.lastSeenAt,
        userEmail: users.email,
        userName: users.name,
        userRole: users.role,
        userTimezone: users.timezone,
        userDisabledAt: users.disabledAt,
        userEmailVerifiedAt: users.emailVerifiedAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.idHash, idHash), gt(sessions.expiresAt, now), gt(sessions.absoluteExpiresAt, now)))
      .limit(1);

    if (!sessionRecord) {
      return reply.status(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Session expired or invalid' },
      });
    }

    if (sessionRecord.userDisabledAt) {
      return reply.status(403).send({
        error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' },
      });
    }

    // Check if MFA is active for this user
    let mfaEnabled = false;
    try {
      const [mfaRecord] = await db
        .select({ enabledAt: mfaFactors.enabledAt })
        .from(mfaFactors)
        .where(eq(mfaFactors.userId, sessionRecord.userId))
        .limit(1);
      mfaEnabled = Boolean(mfaRecord?.enabledAt);

    } catch {
      // Non-fatal if MFA check fails
    }

    // Slide session forward if last updated more than 60 seconds ago (Section 6.5 rule 4)
    const lastSeen = new Date(sessionRecord.lastSeenAt).getTime();
    if (now.getTime() - lastSeen > 60 * 1000) {
      const idleDays = env.SESSION_IDLE_DAYS || 7;
      const newExpiresAt = new Date(now.getTime() + idleDays * 24 * 60 * 60 * 1000);

      // Slide only up to the hard cap
      const cappedExpiresAt = new Date(
        Math.min(newExpiresAt.getTime(), new Date(sessionRecord.absoluteExpiresAt).getTime())
      );

      await db
        .update(sessions)
        .set({
          lastSeenAt: now,
          expiresAt: cappedExpiresAt,
        })
        .where(eq(sessions.idHash, idHash));
    }

    req.user = {
      id: sessionRecord.userId,
      email: sessionRecord.userEmail,
      name: sessionRecord.userName,
      role: sessionRecord.userRole as 'admin' | 'user',
      emailVerified: Boolean(sessionRecord.userEmailVerifiedAt),
      mfaEnabled,
      timezone: sessionRecord.userTimezone,
    };
    req.sessionId = idHash;
  };
}

export function createAdminMiddleware() {
  return async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user || req.user.role !== 'admin') {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
      });
    }
  };
}


export function createCsrfMiddleware(env: Env) {
  return async function verifyCsrf(req: FastifyRequest, reply: FastifyReply) {
    const method = req.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return; // Safe methods
    }

    // 1. Origin header check
    const origin = req.headers['origin'];
    if (!origin || origin !== env.APP_URL) {
      return reply.status(403).send({
        error: { code: 'CSRF_INVALID_ORIGIN', message: 'Invalid or missing request Origin' },
      });
    }

    // 2. X-CSRF-Token header check
    const csrfToken = req.headers['x-csrf-token'] as string;
    const cookieName = env.SESSION_COOKIE_NAME || 'fc_sid';
    const cookieValue = req.cookies[cookieName];

    // If request has a session cookie, it MUST present a valid CSRF token
    if (cookieValue) {
      const sessionId = hashToken(cookieValue);
      if (!csrfToken || !verifyCsrfToken(csrfToken, sessionId, env.CSRF_SECRET)) {
        return reply.status(403).send({
          error: { code: 'CSRF_INVALID_TOKEN', message: 'Invalid or missing CSRF token' },
        });
      }
    }
  };
}
