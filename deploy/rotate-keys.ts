import postgres from 'postgres';
import { getDb, integrations, userSettings, mfaFactors, eq } from '@flowcart/db';
import { Vault } from '@flowcart/vault';
import { validateEnv } from '@flowcart/shared';

/**
 * Key Rotation Script (Section 12.9)
 * Safely iterates through every encrypted column in the database,
 * decrypts with historical keys, and re-encrypts using the current active key ID.
 */
export async function rotateAllKeys(vault: Vault, databaseUrl: string): Promise<number> {
  const sql = postgres(databaseUrl, { max: 1 });
  const db = getDb(databaseUrl);

  console.log(`Starting key rotation to active key: ${vault.getActiveKeyId()}...`);
  let rotatedCount = 0;

  try {
    // 1. Rotate integrations (Gmail OAuth tokens)
    const allIntegrations = await db.select().from(integrations);
    for (const integ of allIntegrations) {
      let updated = false;
      let newRefresh = integ.refreshTokenEnc;
      let newAccess = integ.accessTokenEnc;

      if (integ.refreshTokenEnc) {
        const reencrypted = vault.reencrypt(integ.refreshTokenEnc, `${integ.userId}:refresh_token`);
        if (reencrypted !== integ.refreshTokenEnc) {
          newRefresh = reencrypted;
          updated = true;
        }
      }
      if (integ.accessTokenEnc) {
        const reencrypted = vault.reencrypt(integ.accessTokenEnc, `${integ.userId}:access_token`);
        if (reencrypted !== integ.accessTokenEnc) {
          newAccess = reencrypted;
          updated = true;
        }
      }
      if (updated) {
        await db
          .update(integrations)
          .set({ refreshTokenEnc: newRefresh, accessTokenEnc: newAccess })
          .where(eq(integrations.id, integ.id));
        rotatedCount++;
      }
    }

    // 2. Rotate user_settings (Personal LLM keys)
    const allSettings = await db.select().from(userSettings);
    for (const setting of allSettings) {
      if (setting.llmApiKeyEnc) {
        const reencrypted = vault.reencrypt(setting.llmApiKeyEnc, `${setting.userId}:llm_key`);
        if (reencrypted !== setting.llmApiKeyEnc) {
          await db
            .update(userSettings)
            .set({ llmApiKeyEnc: reencrypted })
            .where(eq(userSettings.userId, setting.userId));
          rotatedCount++;
        }
      }
    }

    // 3. Rotate mfa_factors (TOTP Secrets)
    const allMfa = await db.select().from(mfaFactors);
    for (const mfa of allMfa) {
      if (mfa.secretEnc) {
        const reencrypted = vault.reencrypt(mfa.secretEnc, `${mfa.userId}:mfa_secret`);
        if (reencrypted !== mfa.secretEnc) {
          await db
            .update(mfaFactors)
            .set({ secretEnc: reencrypted })
            .where(eq(mfaFactors.userId, mfa.userId));
          rotatedCount++;
        }
      }
    }

    console.log(`Key rotation complete. Total records re-encrypted: ${rotatedCount}`);
    return rotatedCount;
  } finally {
    await sql.end();
  }
}

// Standalone execution entrypoint
if (process.argv[1]?.endsWith('rotate-keys.ts') || process.argv[1]?.endsWith('rotate-keys.js')) {
  const env = validateEnv();
  const vault = new Vault();
  rotateAllKeys(vault, env.DATABASE_URL)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Key rotation failed:', err);
      process.exit(1);
    });
}
