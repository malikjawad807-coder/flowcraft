import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_PORT: z.coerce.number().default(4000),
  WEB_PORT: z.coerce.number().default(3000),
  ALLOW_SIGNUPS: z
    .preprocess((val) => val === 'true' || val === true || val === '1', z.boolean())
    .default(true),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  APP_ENCRYPTION_KEY: z
    .string()
    .min(1, 'APP_ENCRYPTION_KEY is required')
    .refine((val) => {
      try {
        const buf = Buffer.from(val, 'base64');
        return buf.length === 32;
      } catch {
        return false;
      }
    }, 'APP_ENCRYPTION_KEY must be exactly 32 bytes encoded in base64'),
  APP_ENCRYPTION_KEY_ID: z.string().min(1).default('k1'),
  CSRF_SECRET: z.string().min(16, 'CSRF_SECRET must be at least 16 characters'),
  SESSION_COOKIE_NAME: z.string().min(1).default('fc_sid'),
  SESSION_IDLE_DAYS: z.coerce.number().positive().default(7),
  SESSION_ABSOLUTE_DAYS: z.coerce.number().positive().default(30),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z.string().optional().default('http://localhost:4000/api/integrations/google/callback'),

  LLM_DEFAULT_PROVIDER: z.enum(['openai', 'anthropic', 'google', 'ollama']).default('openai'),
  OPENAI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  GOOGLE_API_KEY: z.string().optional().default(''),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  LLM_MODEL_AGENT: z.string().default('gpt-4o'),
  LLM_MODEL_FAST: z.string().default('gpt-4o-mini'),
  EMBEDDING_PROVIDER: z.string().default('openai'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  EMBEDDING_DIM: z.coerce.number().positive().default(1536),

  AGENT_MAX_ITERATIONS: z.coerce.number().int().positive().default(8),
  AGENT_RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  AGENT_COMMANDS_PER_HOUR: z.coerce.number().int().positive().default(30),
  EXECUTION_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
  EXECUTION_RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('FlowCart <no-reply@localhost>'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${errorDetails}`);
  }
  return result.data;
}
