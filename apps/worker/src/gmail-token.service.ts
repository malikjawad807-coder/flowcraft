import { integrations, eq, and } from '@flowcart/db';
import { Vault } from '@flowcart/vault';
import { Env } from '@flowcart/shared';
import { createOAuth2Client } from '@flowcart/gmail';
import type { OAuth2Client } from 'google-auth-library';
import type { Redis } from 'ioredis';

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

export class WorkerGmailTokenService {
  private cache = new Map<string, TokenCacheEntry>();
  private refreshMutex = new Map<string, Promise<string>>();

  constructor(
    private db: any,
    private vault: Vault,
    private env: Env,
    private redis?: Redis
  ) {}

  async getAccessToken(integrationId: string, userId: string): Promise<string> {
    const now = Date.now();

    const memEntry = this.cache.get(integrationId);
    if (memEntry && memEntry.expiresAt > now + 60_000) {
      return memEntry.accessToken;
    }

    if (this.redis) {
      try {
        const cached = await this.redis.get(`gmail:access_token:${integrationId}`);
        if (cached) {
          const parsed: TokenCacheEntry = JSON.parse(cached);
          if (parsed.expiresAt > now + 60_000) {
            this.cache.set(integrationId, parsed);
            return parsed.accessToken;
          }
        }
      } catch {}
    }

    const existingRefresh = this.refreshMutex.get(integrationId);
    if (existingRefresh) {
      return existingRefresh;
    }

    const refreshPromise = (async () => {
      try {
        return await this.performRefresh(integrationId, userId);
      } finally {
        this.refreshMutex.delete(integrationId);
      }
    })();

    this.refreshMutex.set(integrationId, refreshPromise);
    return refreshPromise;
  }

  private async performRefresh(integrationId: string, userId: string): Promise<string> {
    const [integration] = await this.db
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)))
      .limit(1);

    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    if (integration.status === 'revoked') {
      throw new Error('GMAIL_CONNECTION_REVOKED');
    }

    let rawRefreshToken: string;
    try {
      rawRefreshToken = this.vault.decrypt(
        integration.refreshTokenEnc,
        `${userId}:gmail_refresh_token`
      );
    } catch {
      throw new Error('Failed to decrypt Gmail credentials');
    }

    const oauth2Client = createOAuth2Client({
      clientId: this.env.GOOGLE_CLIENT_ID,
      clientSecret: this.env.GOOGLE_CLIENT_SECRET,
      redirectUri: this.env.GOOGLE_REDIRECT_URI,
    });

    oauth2Client.setCredentials({
      refresh_token: rawRefreshToken,
    });

    try {
      const response = await oauth2Client.refreshAccessToken();
      const credentials = response.credentials;
      const newAccessToken = credentials.access_token!;
      const expiryDate = credentials.expiry_date || Date.now() + 3600 * 1000;

      const cacheEntry: TokenCacheEntry = {
        accessToken: newAccessToken,
        expiresAt: expiryDate,
      };
      this.cache.set(integrationId, cacheEntry);

      if (this.redis) {
        try {
          const ttlSec = Math.max(60, Math.floor((expiryDate - Date.now()) / 1000));
          await this.redis.set(
            `gmail:access_token:${integrationId}`,
            JSON.stringify(cacheEntry),
            'EX',
            ttlSec
          );
        } catch {}
      }

      const accessTokenEnc = this.vault.encrypt(
        newAccessToken,
        `${userId}:gmail_access_token`
      );

      await this.db
        .update(integrations)
        .set({
          accessTokenEnc,
          accessExpiresAt: new Date(expiryDate),
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, integrationId));

      return newAccessToken;
    } catch (err: any) {
      const isRevoked =
        err?.message?.includes('invalid_grant') ||
        err?.response?.data?.error === 'invalid_grant';

      if (isRevoked) {
        await this.db
          .update(integrations)
          .set({ status: 'revoked', updatedAt: new Date() })
          .where(eq(integrations.id, integrationId));

        this.cache.delete(integrationId);
        throw new Error('GMAIL_CONNECTION_REVOKED');
      }

      throw err;
    }
  }

  async getAuthenticatedClient(integrationId: string, userId: string): Promise<OAuth2Client> {
    const accessToken = await this.getAccessToken(integrationId, userId);

    const client = createOAuth2Client({
      clientId: this.env.GOOGLE_CLIENT_ID,
      clientSecret: this.env.GOOGLE_CLIENT_SECRET,
      redirectUri: this.env.GOOGLE_REDIRECT_URI,
    });

    client.setCredentials({
      access_token: accessToken,
    });

    return client;
  }
}
