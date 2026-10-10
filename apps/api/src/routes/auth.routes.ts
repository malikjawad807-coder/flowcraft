import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileSchema,
  deleteAccountSchema,
  mfaEnableSchema,
  mfaDisableSchema,
  deriveCsrfToken,
  hashToken,
  Env,
} from '@flowcart/shared';

import { AuthService } from '../services/auth.service.js';
import { RateLimitService } from '../services/rate-limit.service.js';
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.middleware.js';

export interface AuthRoutesOptions {
  db: any;
  env: Env;
  authService: AuthService;
  rateLimitService: RateLimitService;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  app: FastifyInstance,
  opts: AuthRoutesOptions
) => {
  const { env, authService, rateLimitService, db } = opts;
  const requireAuth = createAuthMiddleware(db, env);
  const verifyCsrf = createCsrfMiddleware(env);

  // Set Cache-Control: no-store on all auth responses (Section 6.1)
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
  });

  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };

  // POST /auth/signup
  app.post('/auth/signup', { preHandler: verifyCsrf }, async (req, reply) => {
    const ip = req.ip;
    const rl = await rateLimitService.consume(`signup:ip:${ip}`, 5, 3600);
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfterSeconds));
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Too many signup attempts. Please try again later.' },
      });
    }

    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid signup input',
          details: parseResult.error.format(),
        },
      });
    }

    const res = await authService.signup(parseResult.data, {
      ip,
      userAgent: req.headers['user-agent'],
    });

    return reply.status(201).send(res);
  });

  // POST /auth/verify-email
  app.post('/auth/verify-email', { preHandler: verifyCsrf }, async (req, reply) => {
    const rl = await rateLimitService.consume(`verify:ip:${req.ip}`, 10, 3600);
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfterSeconds));
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Too many verification attempts.' },
      });
    }

    const parseResult = verifyEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Token is required' },
      });
    }

    await authService.verifyEmail(parseResult.data.token, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return reply.status(204).send();
  });

  // POST /auth/resend-verification
  app.post('/auth/resend-verification', { preHandler: verifyCsrf }, async (req, reply) => {
    const parseResult = resendVerificationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email address' },
      });
    }

    const email = parseResult.data.email;
    const ip = req.ip;

    const rlEmail = await rateLimitService.consume(`resend:email:${email}`, 3, 3600);
    const rlIp = await rateLimitService.consume(`resend:ip:${ip}`, 10, 3600);

    if (!rlEmail.allowed || !rlIp.allowed) {
      reply.header('Retry-After', String(rlEmail.retryAfterSeconds || rlIp.retryAfterSeconds));
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
      });
    }

    await authService.resendVerification(email, {
      ip,
      userAgent: req.headers['user-agent'],
    });

    return reply.status(204).send();
  });

  // POST /auth/login
  app.post('/auth/login', { preHandler: verifyCsrf }, async (req, reply) => {
    const ip = req.ip;
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email or password' },
      });
    }

    const { email, password } = parseResult.data;

    // Rate limits (Section 6.4: 10/min per IP, 5/15min per email)
    const rlIp = await rateLimitService.consume(`login:ip:${ip}`, 10, 60);
    const rlEmail = await rateLimitService.consume(`login:email:${email}`, 5, 900);

    if (!rlIp.allowed || !rlEmail.allowed) {
      const wait = rlEmail.retryAfterSeconds || rlIp.retryAfterSeconds || 60;
      reply.header('Retry-After', String(wait));
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: `Too many login attempts. Retry in ${wait} seconds.` },
      });
    }

    const loginRes = await authService.login(
      parseResult.data,
      { ip, userAgent: req.headers['user-agent'] }
    );


    reply.setCookie(env.SESSION_COOKIE_NAME, loginRes.cookieValue, cookieOptions);
    return reply.status(204).send();
  });

  // GET /auth/csrf
  app.get('/auth/csrf', async (req, reply) => {
    const cookieValue = req.cookies[env.SESSION_COOKIE_NAME];
    if (!cookieValue) {
      return reply.send({ csrfToken: null });
    }
    const sessionId = hashToken(cookieValue);
    const csrfToken = deriveCsrfToken(sessionId, env.CSRF_SECRET);
    return reply.send({ csrfToken });
  });

  // GET /auth/me (login required)
  app.get('/auth/me', { preHandler: requireAuth }, async (req, reply) => {
    return reply.send(req.user);
  });

  // POST /auth/logout (login required)
  app.post('/auth/logout', { preHandler: [requireAuth, verifyCsrf] }, async (req, reply) => {
    if (req.sessionId) {
      await authService.logout(req.sessionId, req.user?.id, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
    reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
    return reply.status(204).send();
  });

  // POST /auth/logout-all (login required)
  app.post('/auth/logout-all', { preHandler: [requireAuth, verifyCsrf] }, async (req, reply) => {
    if (req.user?.id) {
      await authService.logoutAll(req.user.id, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }
    reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
    return reply.status(204).send();
  });

  // POST /auth/forgot-password
  app.post('/auth/forgot-password', { preHandler: verifyCsrf }, async (req, reply) => {
    const parseResult = forgotPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid email address' },
      });
    }

    const email = parseResult.data.email;
    const rlEmail = await rateLimitService.consume(`forgot:email:${email}`, 3, 3600);
    const rlIp = await rateLimitService.consume(`forgot:ip:${req.ip}`, 10, 3600);

    if (!rlEmail.allowed || !rlIp.allowed) {
      const wait = rlEmail.retryAfterSeconds || rlIp.retryAfterSeconds || 3600;
      reply.header('Retry-After', String(wait));
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
      });
    }

    await authService.forgotPassword(email, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return reply.status(204).send();
  });

  // POST /auth/reset-password
  app.post('/auth/reset-password', { preHandler: verifyCsrf }, async (req, reply) => {
    const rlIp = await rateLimitService.consume(`reset:ip:${req.ip}`, 10, 3600);
    if (!rlIp.allowed) {
      reply.header('Retry-After', String(rlIp.retryAfterSeconds));
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Too many password reset attempts.' },
      });
    }

    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid password reset input',
        },
      });
    }

    await authService.resetPassword(parseResult.data, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return reply.status(204).send();
  });

  // POST /auth/change-password (login required)
  app.post('/auth/change-password', { preHandler: [requireAuth, verifyCsrf] }, async (req, reply) => {
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid password change input',
        },
      });
    }

    await authService.changePassword(
      req.user!.id,
      req.sessionId!,
      parseResult.data,
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    return reply.status(204).send();
  });

  // GET /auth/sessions (login required)
  app.get('/auth/sessions', { preHandler: requireAuth }, async (req, reply) => {
    const activeSessions = await authService.getSessions(req.user!.id, req.sessionId!);
    return reply.send({ sessions: activeSessions });
  });

  // DELETE /auth/sessions/:id (login required)
  app.delete('/auth/sessions/:id', { preHandler: [requireAuth, verifyCsrf] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await authService.revokeSession(req.user!.id, id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return reply.status(204).send();
  });

  // PATCH /auth/profile (login required)
  app.patch('/auth/profile', { preHandler: [requireAuth, verifyCsrf] }, async (req, reply) => {
    const parseResult = profileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid profile data' },
      });
    }

    await authService.updateProfile(req.user!.id, parseResult.data);
    return reply.status(204).send();
  });

  // DELETE /auth/account (login required)
  app.delete('/auth/account', { preHandler: [requireAuth, verifyCsrf] }, async (req, reply) => {
    const parseResult = deleteAccountSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Current password is required' },
      });
    }

    await authService.deleteAccount(req.user!.id, parseResult.data.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    reply.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
    return reply.status(204).send();
  });

  // POST /auth/mfa/setup (login required, Section 6.8 & 13)
  app.post('/auth/mfa/setup', { preHandler: [requireAuth, verifyCsrf] }, async (req, reply) => {
    const res = await authService.setupMfa(req.user!.id, req.user!.email);
    return reply.send(res);
  });

  // POST /auth/mfa/enable (login required, Section 6.8 & 13)
  app.post('/auth/mfa/enable', { preHandler: [requireAuth, verifyCsrf] }, async (req, reply) => {
    const parseResult = mfaEnableSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0]?.message || 'Invalid code format',
        },
      });
    }

    const res = await authService.enableMfa(req.user!.id, parseResult.data.code, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return reply.send(res);
  });

  // POST /auth/mfa/disable (login required, Section 6.8 & 13)
  app.post('/auth/mfa/disable', { preHandler: [requireAuth, verifyCsrf] }, async (req, reply) => {
    const parseResult = mfaDisableSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Current password is required' },
      });
    }

    await authService.disableMfa(req.user!.id, parseResult.data.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return reply.status(204).send();
  });
};

