import { integrations, eq, and } from '@flowcart/db';
import { Vault } from '@flowcart/vault';
import { Env } from '@flowcart/shared';
import { createOAuth2Client, getProfile, revokeToken } from '@flowcart/gmail';
import type { OAuth2Client } from 'google-auth-library';
import type { Redis } from 'ioredis';

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

export class GmailTokenService {
  private cache = new Map<string, TokenCacheEntry>();
  private refreshMutex = new Map<string, Promise<string>>();

  constructor(
    private db: any,
    private vault: Vault,
    private env: Env,
    private redis?: Redis
  ) {}

  /**
   * Retrieves a valid access token for the given integration ID,
   * refreshing transparently under a concurrency mutex if expired.
   */
  async getAccessToken(integrationId: string, userId: string): Promise<string> {
    const now = Date.now();

    // 1. Check in-memory cache (with 60-second safety cushion)
    const memEntry = this.cache.get(integrationId);
    if (memEntry && memEntry.expiresAt > now + 60_000) {
      return memEntry.accessToken;
    }

    // 2. Check Redis cache if available
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
      } catch {
        // Fall back to DB and fresh refresh on redis error
      }
    }

    // 3. Mutex: If another request is currently refreshing this token, wait on the same Promise
    const existingRefresh = this.refreshMutex.get(integrationId);
    if (existingRefresh) {
      return existingRefresh;
    }

    // 4. Initiate refresh under mutex
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

  /**
   * Performs the actual OAuth token refresh with Google API
   */
  private async performRefresh(integrationId: string, userId: string): Promise<string> {
    const [integration] = await this.db
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)))
      .limit(1);

    if (!integration) {
      const err: any = new Error('Integration not found or access denied');
      err.statusCode = 404;
      err.code = 'INTEGRATION_NOT_FOUND';
      throw err;
    }

    if (integration.status === 'revoked') {
      const err: any = new Error(
        'Gmail authorization has been revoked. Please reconnect your account.'
      );
      err.statusCode = 401;
      err.code = 'GMAIL_CONNECTION_REVOKED';
      throw err;
    }

    // Decrypt refresh token using AAD: `${userId}:gmail_refresh_token`
    let rawRefreshToken: string;
    try {
      rawRefreshToken = this.vault.decrypt(
        integration.refreshTokenEnc,
        `${userId}:gmail_refresh_token`
      );
    } catch {
      const err: any = new Error('Failed to decrypt Gmail credentials');
      err.statusCode = 500;
      err.code = 'VAULT_DECRYPTION_FAILED';
      throw err;
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

      // Update in-memory cache
      const cacheEntry: TokenCacheEntry = {
        accessToken: newAccessToken,
        expiresAt: expiryDate,
      };
      this.cache.set(integrationId, cacheEntry);

      // Update Redis cache if available
      if (this.redis) {
        try {
          const ttlSec = Math.max(60, Math.floor((expiryDate - Date.now()) / 1000));
          await this.redis.set(
            `gmail:access_token:${integrationId}`,
            JSON.stringify(cacheEntry),
            'EX',
            ttlSec
          );
        } catch {
          // Non-critical cache write failure
        }
      }

      // Encrypt and persist latest access token in DB
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
        err?.response?.data?.error === 'invalid_grant' ||
        err?.message?.includes('Token has been expired or revoked');

      if (isRevoked) {
        // Mark status as revoked in database
        await this.db
          .update(integrations)
          .set({
            status: 'revoked',
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, integrationId));

        this.cache.delete(integrationId);
        if (this.redis) {
          try {
            await this.redis.del(`gmail:access_token:${integrationId}`);
          } catch {}
        }

        const revokedErr: any = new Error(
          'Gmail connection was revoked by Google or the user. Please reconnect.'
        );
        revokedErr.statusCode = 401;
        revokedErr.code = 'GMAIL_CONNECTION_REVOKED';
        throw revokedErr;
      }

      throw err;
    }
  }

  /**
   * Returns an initialized and authenticated OAuth2Client ready for Gmail API calls
   */
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

  /**
   * Tests an existing connection by performing a profile lookup
   */
  async testConnection(integrationId: string, userId: string) {
    const client = await this.getAuthenticatedClient(integrationId, userId);
    const profile = await getProfile(client);

    return {
      success: true,
      emailAddress: profile.emailAddress,
      messagesTotal: profile.messagesTotal,
      threadsTotal: profile.threadsTotal,
    };
  }

  /**
   * Revokes and removes a connection completely
   */
  async disconnect(integrationId: string, userId: string): Promise<void> {
    const [integration] = await this.db
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)))
      .limit(1);

    if (!integration) {
      const err: any = new Error('Integration not found');
      err.statusCode = 404;
      err.code = 'INTEGRATION_NOT_FOUND';
      throw err;
    }

    // Best effort revocation with Google
    try {
      const rawRefreshToken = this.vault.decrypt(
        integration.refreshTokenEnc,
        `${userId}:gmail_refresh_token`
      );
      const client = createOAuth2Client({
        clientId: this.env.GOOGLE_CLIENT_ID,
        clientSecret: this.env.GOOGLE_CLIENT_SECRET,
        redirectUri: this.env.GOOGLE_REDIRECT_URI,
      });
      await revokeToken(client, rawRefreshToken);
    } catch {
      // Continue deletion even if revocation with Google failed or was already revoked
    }

    // Delete record from DB
    await this.db
      .delete(integrations)
      .where(and(eq(integrations.id, integrationId), eq(integrations.userId, userId)));

    // Invalidate caches
    this.cache.delete(integrationId);
    if (this.redis) {
      try {
        await this.redis.del(`gmail:access_token:${integrationId}`);
      } catch {}
    }
  }
}
