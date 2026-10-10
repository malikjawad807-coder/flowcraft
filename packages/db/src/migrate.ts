import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(databaseUrl: string = process.env.DATABASE_URL || '') {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log('Running database migrations...');

    // Create migrations tracker table
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `;

    // Locate migrations directory (either in dist or src)
    let migrationsDir = join(__dirname, '../migrations');
    try {
      readdirSync(migrationsDir);
    } catch {
      migrationsDir = join(__dirname, '../../migrations');
    }

    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const alreadyApplied = await sql`
        SELECT 1 FROM _migrations WHERE name = ${file}
      `;

      if (alreadyApplied.length === 0) {
        console.log(`Applying migration: ${file}`);
        const content = readFileSync(join(migrationsDir, file), 'utf8');
        await sql.unsafe(content);
        await sql`
          INSERT INTO _migrations (name) VALUES (${file})
        `;
        console.log(`Successfully applied: ${file}`);
      } else {
        console.log(`Migration already applied: ${file}`);
      }
    }

    console.log('All migrations executed successfully.');
  } finally {
    await sql.end();
  }
}

// Allow direct CLI execution: node dist/migrate.js
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
