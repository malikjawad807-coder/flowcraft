import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { Redis } from 'ioredis';
import postgres from 'postgres';
import { validateEnv, Env } from '@flowcart/shared';
import { getDb } from '@flowcart/db';
import { Vault } from '@flowcart/vault';
import { createEmailService } from './services/email.service.js';
import { RateLimitService } from './services/rate-limit.service.js';
import { AuthService } from './services/auth.service.js';
import { GmailTokenService } from './services/gmail-token.service.js';
import { usageEvents } from '@flowcart/db';
import { LLMService } from '@flowcart/llm';
import { authRoutes } from './routes/auth.routes.js';
import { connectionRoutes } from './routes/connections.routes.js';
import { workflowsRoutes } from './routes/workflows.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { approvalsRoutes } from './routes/approvals.routes.js';
import { agentRoutes } from './routes/agent.routes.js';
import { notificationsRoutes } from './routes/notifications.routes.js';
import { memoryRoutes } from './routes/memory.routes.js';
import { adminRoutes } from './routes/admin.routes.js';


export interface BuildAppOptions {
  env?: Env;
  db?: any;
  redis?: Redis | null;
  vault?: Vault;
  gmailTokenService?: GmailTokenService;
  llmService?: LLMService;
}

export function buildApp(options?: BuildAppOptions): FastifyInstance {
  const env = options?.env || validateEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'password',
        'token',
        'secret',
        'refresh_token',
        'access_token',
        'api_key',
        'bodyText',
      ],
    },
  });

  // Security Headers (Section 12.1)
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  });

  // CORS (Section 12.1: same-origin / APP_URL only, credentials enabled, no wildcards)
  app.register(cors, {
    origin: [env.APP_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Cookie parsing
  app.register(cookie);

  // Initialize DB & services
  const db = options?.db || (env.NODE_ENV !== 'test' ? getDb(env.DATABASE_URL) : null);
  const activeKeyId = env.APP_ENCRYPTION_KEY_ID || 'k1';
  let keyBuf = Buffer.from(env.APP_ENCRYPTION_KEY, 'base64');
  if (keyBuf.length > 32) {
    keyBuf = Buffer.from(keyBuf.subarray(0, 32));
  } else if (keyBuf.length < 32) {
    const padded = Buffer.alloc(32);
    keyBuf.copy(padded);
    keyBuf = padded;
  }

  const vault =
    options?.vault ||
    new Vault({
      activeKeyId,
      keys: {
        [activeKeyId]: keyBuf,
      },
    });
  const emailService = createEmailService(env);
  const rateLimitService = new RateLimitService(options?.redis || null);
  const authService = new AuthService(db, env, emailService, vault);
  const gmailTokenService =
    options?.gmailTokenService ||
    new GmailTokenService(db, vault, env, options?.redis || undefined);

  const llmService =
    options?.llmService ||
    new LLMService(
      {
        defaultProvider: env.LLM_DEFAULT_PROVIDER as any,
        modelAgent: env.LLM_MODEL_AGENT,
        modelFast: env.LLM_MODEL_FAST,
        embeddingProvider: env.EMBEDDING_PROVIDER,
        embeddingModel: env.EMBEDDING_MODEL,
        embeddingDim: env.EMBEDDING_DIM,
        openaiApiKey: env.OPENAI_API_KEY,
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        googleApiKey: env.GOOGLE_API_KEY,
        ollamaBaseUrl: env.OLLAMA_BASE_URL,
        timeoutMs: env.AGENT_RUN_TIMEOUT_MS,
      },
      async (record) => {
        if (record.userId && db) {
          try {
            await db.insert(usageEvents).values({
              userId: record.userId,
              provider: record.provider,
              model: record.model,
              purpose: record.purpose,
              tokensIn: record.tokensIn,
              tokensOut: record.tokensOut,
              at: new Date(),
            });
          } catch {
            // Non-fatal usage record logging
          }
        }
      }
    );

  // Register Auth Routes under /api
  app.register(authRoutes, {
    prefix: '/api',
    db,
    env,
    authService,
    rateLimitService,
  });

  // Register Connection Routes
  app.register(connectionRoutes, {
    db,
    env,
    vault,
    gmailTokenService,
  });

  // Register Workflow and Execution Routes (Phase 4 & 5)
  app.register(workflowsRoutes, {
    db,
    env,
    gmailTokenService,
    llmService,
  });

  // Register Settings and Usage Routes (Phase 6)
  app.register(settingsRoutes, {
    db,
    env,
    vault,
    llmService,
  });

  // Register Approvals Routes (Phase 7)
  app.register(approvalsRoutes, {
    db,
    env,
    gmailTokenService,
    llmService,
  });

  // Register Agent Command Center Routes (Phase 7)
  app.register(agentRoutes, {
    db,
    env,
    gmailTokenService,
    llmService,
  });

  // Register Notifications Routes (Phase 7)
  app.register(notificationsRoutes, {
    db,
    env,
  });

  // Register Memory Routes (Phase 8)
  app.register(memoryRoutes, {
    db,
    env,
    llmService,
  });

  // Register Admin Routes (Phase 9)
  app.register(adminRoutes, {
    prefix: '/api',
    db,
    env,
    redis: options?.redis,
  });


  // Health route (Process is alive)
  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  // Readiness route (PostgreSQL & Redis connected)
  app.get('/ready', async (_req, reply) => {
    let dbStatus = 'disconnected';
    let redisStatus = 'disconnected';
    let isHealthy = true;

    // Check PostgreSQL
    try {
      const sql = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 3 });
      await sql`SELECT 1`;
      await sql.end();
      dbStatus = 'connected';
    } catch (dbErr: any) {
      isHealthy = false;
      app.log.warn({ err: dbErr.message }, 'Readiness check: PostgreSQL unreachable');
    }

    // Check Redis
    try {
      const redis = new Redis(env.REDIS_URL, { connectTimeout: 3000, maxRetriesPerRequest: 1 });
      const pong = await redis.ping();
      redis.disconnect();
      if (pong === 'PONG') {
        redisStatus = 'connected';
      } else {
        isHealthy = false;
      }
    } catch (redisErr: any) {
      isHealthy = false;
      app.log.warn({ err: redisErr.message }, 'Readiness check: Redis unreachable');
    }

    if (!isHealthy) {
      return reply.status(503).send({
        status: 'unhealthy',
        database: dbStatus,
        redis: redisStatus,
      });
    }

    return {
      status: 'ready',
      database: dbStatus,
      redis: redisStatus,
    };
  });

  // Global Error Handler formatting standard error shape: { error: { code, message, details? } }
  app.setErrorHandler((error: any, _request, reply) => {
    const statusCode = error.statusCode || 500;
    app.log.error(error);

    reply.status(statusCode).send({
      error: {
        code: (error as any).code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'),
        message:
          statusCode >= 500 && env.NODE_ENV === 'production'
            ? 'An internal server error occurred'
            : error.message,
        details: (error as any).details,
      },
    });
  });

  return app;
}
