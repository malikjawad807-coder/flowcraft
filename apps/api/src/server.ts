import 'dotenv/config';
import { validateEnv } from '@flowcart/shared';
import { runMigrations } from '@flowcart/db';
import { buildApp } from './app.js';

async function main() {
  const env = validateEnv();
  const app = buildApp({ env });

  // Run database migrations on startup (idempotent)
  try {
    app.log.info('Running database migrations...');
    await runMigrations(env.DATABASE_URL);
    app.log.info('Database migrations completed.');
  } catch (err: any) {
    app.log.error({ err }, 'Failed to run database migrations on boot');
    // In local dev without DB container running, log warning but continue if not strict production
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  }

  try {
    const address = await app.listen({
      port: env.API_PORT,
      host: '0.0.0.0',
    });
    app.log.info(`FlowCart API server listening at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal API startup error:', err);
  process.exit(1);
});
