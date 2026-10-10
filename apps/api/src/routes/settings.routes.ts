import { FastifyPluginAsync } from 'fastify';
import { eq, and, desc, sql, users, userSettings, usageEvents } from '@flowcart/db';
import { Vault } from '@flowcart/vault';
import { Env } from '@flowcart/shared';
import { LLMService } from '@flowcart/llm';
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.middleware.js';

interface SettingsRouteOptions {
  db: any;
  env: Env;
  vault: Vault;
  llmService: LLMService;
}

export const settingsRoutes: FastifyPluginAsync<SettingsRouteOptions> = async (app, opts) => {
  const requireAuth = createAuthMiddleware(opts.db, opts.env);
  const requireCsrf = createCsrfMiddleware(opts.env);

  // GET /api/settings - Fetch current user settings (masked keys, never exposed)
  app.get('/api/settings', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;

    // Fetch user details
    const [dbUser] = await opts.db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    // Fetch user settings
    const [settings] = await opts.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    return reply.send({
      user: {
        id: dbUser?.id || user.id,
        email: dbUser?.email || user.email,
        name: dbUser?.name || null,
        timezone: dbUser?.timezone || user.timezone || 'UTC',
      },
      settings: {
        llmProvider: settings?.llmProvider || opts.env.LLM_DEFAULT_PROVIDER || 'openai',
        hasPersonalKey: Boolean(settings?.llmKeyEnc),
        autoSendEnabled: settings?.autoSendEnabled ?? false,
        signature: settings?.signature || '',
        memoryEnabled: settings?.memoryEnabled ?? true,
        memoryLearnEnabled: settings?.memoryLearnEnabled ?? true,
      },
    });
  });

  // PUT /api/settings - Update profile, LLM provider, personal key (write-only), auto-send
  app.put<{
    Body: {
      name?: string;
      timezone?: string;
      llmProvider?: string;
      personalApiKey?: string;
      autoSendEnabled?: boolean;
      signature?: string;
      memoryEnabled?: boolean;
      memoryLearnEnabled?: boolean;
    };
  }>('/api/settings', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const body = req.body || {};

    // 1. Update user profile fields if supplied
    const userUpdates: Record<string, any> = {};
    if (body.name !== undefined) userUpdates.name = body.name.trim();
    if (body.timezone !== undefined) userUpdates.timezone = body.timezone.trim();

    if (Object.keys(userUpdates).length > 0) {
      await opts.db
        .update(users)
        .set(userUpdates)
        .where(eq(users.id, user.id));
    }

    // 2. Fetch existing settings
    const [existingSettings] = await opts.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    const settingsUpdates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.llmProvider !== undefined) {
      settingsUpdates.llmProvider = body.llmProvider.trim();
    }
    if (body.autoSendEnabled !== undefined) {
      settingsUpdates.autoSendEnabled = Boolean(body.autoSendEnabled);
    }
    if (body.signature !== undefined) {
      settingsUpdates.signature = body.signature;
    }
    if (body.memoryEnabled !== undefined) {
      settingsUpdates.memoryEnabled = Boolean(body.memoryEnabled);
    }
    if (body.memoryLearnEnabled !== undefined) {
      settingsUpdates.memoryLearnEnabled = Boolean(body.memoryLearnEnabled);
    }

    // Write-only personal API key management (Section 9.4)
    if (body.personalApiKey !== undefined) {
      const trimmed = body.personalApiKey.trim();
      if (trimmed === '') {
        // Clear personal key
        settingsUpdates.llmKeyEnc = null;
      } else {
        // Encrypt with vault using AAD
        const encrypted = opts.vault.encrypt(trimmed, `user_settings:llm_key:${user.id}`);
        settingsUpdates.llmKeyEnc = encrypted;
      }
    }

    if (existingSettings) {
      await opts.db
        .update(userSettings)
        .set(settingsUpdates)
        .where(eq(userSettings.userId, user.id));
    } else {
      await opts.db.insert(userSettings).values({
        userId: user.id,
        llmProvider: settingsUpdates.llmProvider || opts.env.LLM_DEFAULT_PROVIDER || 'openai',
        llmKeyEnc: settingsUpdates.llmKeyEnc || null,
        autoSendEnabled: settingsUpdates.autoSendEnabled ?? false,
        signature: settingsUpdates.signature || '',
        memoryEnabled: settingsUpdates.memoryEnabled ?? true,
        memoryLearnEnabled: settingsUpdates.memoryLearnEnabled ?? true,
        updatedAt: new Date(),
      });
    }

    // Re-fetch updated settings
    const [updated] = await opts.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    return reply.send({
      success: true,
      settings: {
        llmProvider: updated?.llmProvider || opts.env.LLM_DEFAULT_PROVIDER,
        hasPersonalKey: Boolean(updated?.llmKeyEnc),
        autoSendEnabled: updated?.autoSendEnabled ?? false,
        signature: updated?.signature || '',
        memoryEnabled: updated?.memoryEnabled ?? true,
        memoryLearnEnabled: updated?.memoryLearnEnabled ?? true,
      },
    });
  });

  // POST /api/settings/test-llm - Test LLM connectivity with current configuration
  app.post<{
    Body: {
      provider?: string;
      personalApiKey?: string;
      model?: string;
    };
  }>('/api/settings/test-llm', { preHandler: [requireAuth, requireCsrf] }, async (req, reply) => {
    const user = req.user!;
    const body = req.body || {};

    let apiKey = body.personalApiKey?.trim();
    let provider = (body.provider || opts.env.LLM_DEFAULT_PROVIDER) as any;

    // If no key provided in payload, check for saved encrypted personal key
    if (!apiKey) {
      const [settings] = await opts.db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, user.id))
        .limit(1);

      if (settings?.llmKeyEnc) {
        try {
          apiKey = opts.vault.decrypt(settings.llmKeyEnc, `user_settings:llm_key:${user.id}`);
        } catch {
          // Decryption failed
        }
      }
    }

    const start = Date.now();

    try {
      const adapter = opts.llmService.getAdapter({
        provider,
        personalKey: apiKey,
        userId: user.id,
      });

      // Quick test using mock or model chat
      const events: any[] = [];
      const stream = adapter.chat({
        messages: [{ role: 'user', content: 'Respond with OK' }],
        maxTokens: 5,
        temperature: 0,
        purpose: 'test',
        userId: user.id,
      });

      for await (const ev of stream) {
        events.push(ev);
      }

      const latencyMs = Date.now() - start;

      return reply.send({
        success: true,
        provider: adapter.provider,
        latencyMs,
        message: 'LLM connection established successfully.',
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: {
          code: 'LLM_CONNECTION_FAILED',
          message: `Connection test failed: ${err.message}`,
        },
      });
    }
  });

  // GET /api/usage - Retrieve token usage logs & aggregated metrics
  app.get<{
    Querystring: {
      days?: string;
    };
  }>('/api/usage', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const daysLimit = Math.min(90, Math.max(1, parseInt(req.query.days || '30', 10)));
    const sinceDate = new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000);

    const events = await opts.db
      .select()
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, user.id), sql`${usageEvents.at} >= ${sinceDate}`))
      .orderBy(desc(usageEvents.at))
      .limit(500);

    let totalTokensIn = 0;
    let totalTokensOut = 0;
    const byPurpose: Record<string, { tokensIn: number; tokensOut: number; calls: number }> = {};
    const byDay: Record<string, { date: string; tokensIn: number; tokensOut: number; calls: number }> = {};

    for (const ev of events) {
      const tIn = ev.tokensIn || 0;
      const tOut = ev.tokensOut || 0;
      totalTokensIn += tIn;
      totalTokensOut += tOut;

      const purpose = ev.purpose || 'other';
      if (!byPurpose[purpose]) {
        byPurpose[purpose] = { tokensIn: 0, tokensOut: 0, calls: 0 };
      }
      byPurpose[purpose].tokensIn += tIn;
      byPurpose[purpose].tokensOut += tOut;
      byPurpose[purpose].calls += 1;

      const dayStr = ev.at ? new Date(ev.at).toISOString().slice(0, 10) : 'today';
      if (!byDay[dayStr]) {
        byDay[dayStr] = { date: dayStr, tokensIn: 0, tokensOut: 0, calls: 0 };
      }
      byDay[dayStr].tokensIn += tIn;
      byDay[dayStr].tokensOut += tOut;
      byDay[dayStr].calls += 1;
    }

    const daily = Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date));

    return reply.send({
      summary: {
        totalTokensIn,
        totalTokensOut,
        totalTokens: totalTokensIn + totalTokensOut,
        totalCalls: events.length,
      },
      byPurpose,
      daily,
      recentEvents: events.slice(0, 30),
    });
  });
};
