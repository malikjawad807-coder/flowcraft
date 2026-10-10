import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { FastifyInstance } from 'fastify';

describe('Fastify API - System Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({
      env: {
        NODE_ENV: 'test',
        APP_URL: 'http://localhost:3000',
        API_PORT: 4000,
        WEB_PORT: 3000,
        ALLOW_SIGNUPS: true,
        DATABASE_URL: 'postgres://flowcart:flowcart_dev_secret@localhost:5432/flowcart',
        REDIS_URL: 'redis://:redis_dev_secret@localhost:6379',
        APP_ENCRYPTION_KEY: 'dGhpc2lzYTMyYnl0ZXNlY3JldGtleWZvcmZsb3djYXJ0IQ==',
        APP_ENCRYPTION_KEY_ID: 'k1',
        CSRF_SECRET: 'Y3NyZnNlY3JldGtleWZvcmZsb3djYXJ0MTIzNDU2Nzg5MDE=',
        SESSION_COOKIE_NAME: 'fc_sid',
        SESSION_IDLE_DAYS: 7,
        SESSION_ABSOLUTE_DAYS: 30,
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        GOOGLE_REDIRECT_URI: '',
        LLM_DEFAULT_PROVIDER: 'openai',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
        GOOGLE_API_KEY: '',
        OLLAMA_BASE_URL: 'http://localhost:11434',
        LLM_MODEL_AGENT: 'gpt-4o',
        LLM_MODEL_FAST: 'gpt-4o-mini',
        EMBEDDING_PROVIDER: 'openai',
        EMBEDDING_MODEL: 'text-embedding-3-small',
        EMBEDDING_DIM: 1536,
        AGENT_MAX_ITERATIONS: 8,
        AGENT_RUN_TIMEOUT_MS: 120000,
        AGENT_COMMANDS_PER_HOUR: 30,
        EXECUTION_TIMEOUT_MS: 300000,
        EXECUTION_RETENTION_DAYS: 30,
        SMTP_HOST: '',
        SMTP_PORT: 587,
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_FROM: 'FlowCart <no-reply@localhost>',
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with status ok and uptime', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('Includes security headers (helmet)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});
