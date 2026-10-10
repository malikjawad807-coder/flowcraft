import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'node:crypto';
import { integrations, oauthStates, eq, and, gt } from '@flowcart/db';
import { Vault } from '@flowcart/vault';
import { Env, hashToken } from '@flowcart/shared';
import {
  createOAuth2Client,
  generateAuthUrl,
  generatePkcePair,
  exchangeCodeForTokens,
  getProfile,
} from '@flowcart/gmail';
import { GmailTokenService } from '../services/gmail-token.service.js';
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.middleware.js';

export interface ConnectionRoutesOptions {
  db: any;
  env: Env;
  vault: Vault;
  gmailTokenService: GmailTokenService;
}

export const connectionRoutes: FastifyPluginAsync<ConnectionRoutesOptions> = async (
  app: FastifyInstance,
  opts: ConnectionRoutesOptions
) => {
  const requireAuth = createAuthMiddleware(opts.db, opts.env);
  const requireCsrf = createCsrfMiddleware(opts.env);

  /**
   * GET /api/connections
   * List all integrations belonging to the authenticated user
   */
  app.get('/api/connections', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.user!.id;

    const list = await opts.db
      .select({
        id: integrations.id,
        provider: integrations.provider,
        accountEmail: integrations.accountEmail,
        scopes: integrations.scopes,
        status: integrations.status,
        createdAt: integrations.createdAt,
        updatedAt: integrations.updatedAt,
      })
      .from(integrations)
      .where(eq(integrations.userId, userId));

    return reply.send(list);
  });

  /**
   * GET /api/connections/gmail/auth-url
   * Initiates Google OAuth connection flow with PKCE and state token
   */
  app.get('/api/connections/gmail/auth-url', { preHandler: [requireAuth] }, async (req, reply) => {
    const userId = req.user!.id;

    if (!opts.env.GOOGLE_CLIENT_ID || !opts.env.GOOGLE_CLIENT_SECRET) {
      return reply.status(500).send({
        error: {
          code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
          message:
            'Google OAuth credentials are not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.',
        },
      });
    }

    const oauthClient = createOAuth2Client({
      clientId: opts.env.GOOGLE_CLIENT_ID,
      clientSecret: opts.env.GOOGLE_CLIENT_SECRET,
      redirectUri: opts.env.GOOGLE_REDIRECT_URI,
    });

    const { verifier, challenge } = generatePkcePair();
    const rawState = randomBytes(32).toString('base64url');
    const stateHash = hashToken(rawState);

    // Encrypt code verifier in database with AAD `${userId}:oauth_code_verifier`
    const codeVerifierEnc = opts.vault.encrypt(verifier, `${userId}:oauth_code_verifier`);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minute expiry

    await opts.db.insert(oauthStates).values({
      stateHash,
      userId,
      codeVerifierEnc,
      purpose: 'gmail_connect',
      expiresAt,
    });

    const authUrl = generateAuthUrl(oauthClient, rawState, challenge);
    return reply.send({ authUrl });
  });

  /**
   * GET /api/connections/gmail/callback
   * OAuth redirect callback from Google
   */
  app.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>('/api/connections/gmail/callback', async (req, reply) => {
    const { code, state, error } = req.query;
    const appUrl = opts.env.APP_URL;

    if (error || !code || !state) {
      return reply.redirect(
        `${appUrl}/settings/connections?error=${encodeURIComponent(
          error || 'Google authorization was cancelled or failed'
        )}`
      );
    }

    const stateHash = hashToken(state);
    const now = new Date();

    const [stateRecord] = await opts.db
      .select()
      .from(oauthStates)
      .where(and(eq(oauthStates.stateHash, stateHash), gt(oauthStates.expiresAt, now)))
      .limit(1);

    if (!stateRecord) {
      return reply.redirect(`${appUrl}/settings/connections?error=INVALID_OR_EXPIRED_STATE`);
    }

    // Delete state record so it cannot be re-used
    await opts.db.delete(oauthStates).where(eq(oauthStates.stateHash, stateHash));

    const userId = stateRecord.userId;

    let codeVerifier: string;
    try {
      codeVerifier = opts.vault.decrypt(
        stateRecord.codeVerifierEnc,
        `${userId}:oauth_code_verifier`
      );
    } catch {
      return reply.redirect(`${appUrl}/settings/connections?error=STATE_DECRYPTION_FAILED`);
    }

    const oauthClient = createOAuth2Client({
      clientId: opts.env.GOOGLE_CLIENT_ID,
      clientSecret: opts.env.GOOGLE_CLIENT_SECRET,
      redirectUri: opts.env.GOOGLE_REDIRECT_URI,
    });

    try {
      const tokens = await exchangeCodeForTokens(oauthClient, code, codeVerifier);
      const rawRefreshToken = tokens.refresh_token;

      if (!rawRefreshToken) {
        // If Google didn't return a refresh token (e.g. prompt=consent bypassed), check if we already have one
        const [existing] = await opts.db
          .select()
          .from(integrations)
          .where(and(eq(integrations.userId, userId), eq(integrations.provider, 'google')))
          .limit(1);

        if (!existing) {
          return reply.redirect(
            `${appUrl}/settings/connections?error=NO_REFRESH_TOKEN_RETURNED`
          );
        }
      }

      oauthClient.setCredentials(tokens);
      const profile = await getProfile(oauthClient);
      const email = profile.emailAddress.toLowerCase();

      // Encrypt refresh token with AAD `${userId}:gmail_refresh_token`
      let refreshTokenEnc: string | undefined;
      if (rawRefreshToken) {
        refreshTokenEnc = opts.vault.encrypt(rawRefreshToken, `${userId}:gmail_refresh_token`);
      }

      // Encrypt access token
      let accessTokenEnc: string | undefined;
      if (tokens.access_token) {
        accessTokenEnc = opts.vault.encrypt(tokens.access_token, `${userId}:gmail_access_token`);
      }
      const accessExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

      // Upsert integration
      const [existing] = await opts.db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.userId, userId),
            eq(integrations.provider, 'google'),
            eq(integrations.accountEmail, email)
          )
        )
        .limit(1);

      if (existing) {
        await opts.db
          .update(integrations)
          .set({
            refreshTokenEnc: refreshTokenEnc || existing.refreshTokenEnc,
            accessTokenEnc: accessTokenEnc || existing.accessTokenEnc,
            accessExpiresAt: accessExpiresAt || existing.accessExpiresAt,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, existing.id));
      } else if (refreshTokenEnc) {
        await opts.db.insert(integrations).values({
          userId,
          provider: 'google',
          accountEmail: email,
          scopes: tokens.scope ? tokens.scope.split(' ') : [],
          refreshTokenEnc,
          accessTokenEnc,
          accessExpiresAt,
          status: 'active',
        });
      }

      return reply.redirect(`${appUrl}/settings/connections?connected=gmail&email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      req.log.error({ err }, 'Google OAuth token exchange failed');
      return reply.redirect(
        `${appUrl}/settings/connections?error=${encodeURIComponent(
          err?.message || 'Token exchange failed'
        )}`
      );
    }
  });

  /**
   * POST /api/connections/:id/test
   * Tests connection health by querying Google getProfile
   */
  app.post<{ Params: { id: string } }>(
    '/api/connections/:id/test',
    { preHandler: [requireAuth, requireCsrf] },
    async (req, reply) => {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await opts.gmailTokenService.testConnection(id, userId);
      return reply.send(result);
    }
  );

  /**
   * DELETE /api/connections/:id
   * Disconnects and deletes integration
   */
  app.delete<{ Params: { id: string } }>(
    '/api/connections/:id',
    { preHandler: [requireAuth, requireCsrf] },
    async (req, reply) => {
      const { id } = req.params;
      const userId = req.user!.id;

      await opts.gmailTokenService.disconnect(id, userId);
      return reply.status(204).send();
    }
  );
};
