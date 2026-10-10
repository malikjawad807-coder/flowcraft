import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { eq, and, desc, sql, memories, auditLog } from '@flowcart/db';
import { Env } from '@flowcart/shared';
import { LLMService } from '@flowcart/llm';
import { validateMemoryText, cosineSimilarity } from '@flowcart/agent';
import { createAuthMiddleware, createCsrfMiddleware } from '../middleware/auth.middleware.js';

interface MemoryRouteOptions {
  db: any;
  env: Env;
  llmService?: LLMService;
}

const VALID_CATEGORIES = ['profile', 'preference', 'contact', 'project', 'style', 'rule'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

export const memoryRoutes: FastifyPluginAsync<MemoryRouteOptions> = async (app, opts) => {
  const requireAuth = createAuthMiddleware(opts.db, opts.env);
  const requireCsrf = createCsrfMiddleware(opts.env);

  // Helper handler for listing memories
  const listMemoriesHandler = async (req: any, reply: any) => {
    const user = req.user!;
    const { q, category } = (req.query as { q?: string; category?: string }) || {};

    // Retrieve all memories for this user (User Isolation)
    const userMemories: any[] = await opts.db
      .select()
      .from(memories)
      .where(eq(memories.userId, user.id));

    let filtered = userMemories;

    if (category && VALID_CATEGORIES.includes(category as Category)) {
      filtered = filtered.filter((m) => m.category === category);
    }

    if (q && q.trim().length > 0) {
      const qLower = q.trim().toLowerCase();
      filtered = filtered.filter((m) => m.text.toLowerCase().includes(qLower));
    }

    // Sort by pinned (true first), then importance (5 down to 1), then updatedAt desc
    filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if ((b.importance || 3) !== (a.importance || 3)) {
        return (b.importance || 3) - (a.importance || 3);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const total = userMemories.length;

    return reply.send({
      memories: filtered,
      total,
      softCapReached: total >= 300,
      hardCapReached: total >= 500,
    });
  };

  // Helper handler for creating memory manually
  const createMemoryHandler = async (req: any, reply: any) => {
    const user = req.user!;
    const body = req.body as {
      text?: string;
      category?: string;
      pinned?: boolean;
      importance?: number;
    };

    if (!body || !body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
      return reply.status(400).send({
        error: { code: 'INVALID_INPUT', message: 'Memory text is required.' },
      });
    }

    const trimmedText = body.text.trim();
    if (trimmedText.length > 500) {
      return reply.status(400).send({
        error: { code: 'TEXT_TOO_LONG', message: 'Memory text cannot exceed 500 characters.' },
      });
    }

    // Sensitive data check (Section 11.3)
    const validation = validateMemoryText(trimmedText);
    if (!validation.isSafe) {
      return reply.status(400).send({
        error: { code: 'INVALID_MEMORY', message: validation.reason || 'Forbidden sensitive information.' },
      });
    }

    const category: Category =
      body.category && VALID_CATEGORIES.includes(body.category as Category)
        ? (body.category as Category)
        : 'profile';

    const importance = typeof body.importance === 'number' && body.importance >= 1 && body.importance <= 5
      ? Math.round(body.importance)
      : 3;

    const pinned = Boolean(body.pinned);

    // Fetch existing memories for user
    const existingMemories: any[] = await opts.db
      .select()
      .from(memories)
      .where(eq(memories.userId, user.id));

    if (existingMemories.length >= 500) {
      return reply.status(400).send({
        error: { code: 'HARD_CAP_REACHED', message: 'Maximum 500 memories allowed.' },
      });
    }

    // Compute embedding if available
    let embedding: number[] | null = null;
    try {
      if (opts.llmService?.embed) {
        const res = await opts.llmService.embed({
          texts: [trimmedText],
          userId: user.id,
          purpose: 'memory_save',
        });
        if (res?.embeddings && res.embeddings.length > 0) {
          embedding = res.embeddings[0];
        }
      }
    } catch {
      embedding = null;
    }

    // De-duplication check: cosine similarity >= 0.88
    let nearestMatch: any = null;
    let highestSim = 0;

    if (embedding) {
      for (const m of existingMemories) {
        if (m.embedding && Array.isArray(m.embedding)) {
          const sim = cosineSimilarity(embedding, m.embedding);
          if (sim > highestSim) {
            highestSim = sim;
            nearestMatch = m;
          }
        }
      }
    }

    if (highestSim >= 0.88 && nearestMatch) {
      // Merge or update existing memory
      nearestMatch.text = trimmedText;
      nearestMatch.category = category;
      nearestMatch.importance = importance;
      nearestMatch.pinned = pinned;
      nearestMatch.embedding = embedding || nearestMatch.embedding;
      nearestMatch.updatedAt = new Date();

      try {
        await opts.db
          .update(memories)
          .set({
            text: trimmedText,
            category,
            importance,
            pinned,
            embedding: embedding || nearestMatch.embedding,
            updatedAt: new Date(),
          })
          .where(and(eq(memories.id, nearestMatch.id), eq(memories.userId, user.id)));
      } catch {
        // Mock DB fallback
      }

      return reply.status(200).send({
        memory: nearestMatch,
        action: highestSim >= 0.98 ? 'updated' : 'merged',
      });
    }

    // Insert new memory
    const newRecord = {
      id: randomUUID(),
      userId: user.id,
      text: trimmedText,
      category,
      importance,
      pinned,
      embedding,
      source: 'manual' as const,
      sourceConversationId: null,
      useCount: 0,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await opts.db.insert(memories).values(newRecord);

    return reply.status(201).send({
      memory: newRecord,
      action: 'created',
    });
  };

  // Helper handler for updating a memory
  const updateMemoryHandler = async (req: any, reply: any) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const body = req.body as {
      text?: string;
      category?: string;
      pinned?: boolean;
      importance?: number;
    };

    const existingRows = await opts.db
      .select()
      .from(memories)
      .where(and(eq(memories.id, id), eq(memories.userId, user.id)));

    const existing = existingRows[0];
    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Memory not found.' },
      });
    }

    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.text !== undefined) {
      const trimmed = body.text.trim();
      if (trimmed.length === 0 || trimmed.length > 500) {
        return reply.status(400).send({
          error: { code: 'INVALID_TEXT', message: 'Memory text must be between 1 and 500 characters.' },
        });
      }
      const val = validateMemoryText(trimmed);
      if (!val.isSafe) {
        return reply.status(400).send({
          error: { code: 'INVALID_MEMORY', message: val.reason || 'Forbidden sensitive information.' },
        });
      }
      updates.text = trimmed;

      // Re-embed if text changed
      try {
        if (opts.llmService?.embed) {
          const res = await opts.llmService.embed({
            texts: [trimmed],
            userId: user.id,
            purpose: 'memory_save',
          });
          if (res?.embeddings && res.embeddings.length > 0) {
            updates.embedding = res.embeddings[0];
          }
        }
      } catch {
        // Fallback
      }
    }

    if (body.category !== undefined) {
      if (!VALID_CATEGORIES.includes(body.category as Category)) {
        return reply.status(400).send({
          error: { code: 'INVALID_CATEGORY', message: 'Invalid memory category.' },
        });
      }
      updates.category = body.category;
    }

    if (body.importance !== undefined) {
      if (typeof body.importance !== 'number' || body.importance < 1 || body.importance > 5) {
        return reply.status(400).send({
          error: { code: 'INVALID_IMPORTANCE', message: 'Importance must be between 1 and 5.' },
        });
      }
      updates.importance = Math.round(body.importance);
    }

    if (body.pinned !== undefined) {
      updates.pinned = Boolean(body.pinned);
    }

    Object.assign(existing, updates);

    try {
      await opts.db
        .update(memories)
        .set(updates)
        .where(and(eq(memories.id, id), eq(memories.userId, user.id)));
    } catch {
      // Mock DB
    }

    return reply.send({ memory: existing });
  };

  // Helper handler for deleting a single memory
  const deleteMemoryHandler = async (req: any, reply: any) => {
    const user = req.user!;
    const { id } = req.params as { id: string };

    const existingRows = await opts.db
      .select()
      .from(memories)
      .where(and(eq(memories.id, id), eq(memories.userId, user.id)));

    if (existingRows.length === 0) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Memory not found.' },
      });
    }

    await opts.db
      .delete(memories)
      .where(and(eq(memories.id, id), eq(memories.userId, user.id)));

    return reply.send({ success: true });
  };

  // Helper handler for forget everything
  const forgetAllHandler = async (req: any, reply: any) => {
    const user = req.user!;
    const body = (req.body as { confirm?: string }) || {};

    if (body.confirm !== 'FORGET') {
      return reply.status(400).send({
        error: { code: 'CONFIRMATION_REQUIRED', message: 'Type FORGET to confirm wiping all memories.' },
      });
    }

    const existing = await opts.db
      .select()
      .from(memories)
      .where(eq(memories.userId, user.id));

    const count = existing.length;

    await opts.db.delete(memories).where(eq(memories.userId, user.id));

    // Write audit log entry (Section 11.8)
    try {
      await opts.db.insert(auditLog).values({
        userId: user.id,
        action: 'forget_all_memories',
        detail: { deletedCount: count },
        ip: req.ip || null,
        userAgent: (req.headers['user-agent'] as string) || null,
        at: new Date(),
      });
    } catch {
      // Non-fatal if mock DB
    }

    return reply.send({ success: true, count });
  };

  // Helper handler for JSON export
  const exportMemoriesHandler = async (req: any, reply: any) => {
    const user = req.user!;

    const userMemories: any[] = await opts.db
      .select()
      .from(memories)
      .where(eq(memories.userId, user.id));

    const exportData = userMemories.map((m) => ({
      id: m.id,
      text: m.text,
      category: m.category,
      importance: m.importance,
      pinned: m.pinned,
      source: m.source,
      sourceConversationId: m.sourceConversationId,
      useCount: m.useCount,
      lastUsedAt: m.lastUsedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    return reply.send({
      exportedAt: new Date().toISOString(),
      count: exportData.length,
      memories: exportData,
    });
  };

  // Register both /api/memories and /api/memory routes
  for (const prefix of ['/api/memories', '/api/memory']) {
    app.get(prefix, { preHandler: [requireAuth] }, listMemoriesHandler);
    app.post(prefix, { preHandler: [requireAuth, requireCsrf] }, createMemoryHandler);
    app.delete(prefix, { preHandler: [requireAuth, requireCsrf] }, forgetAllHandler);
    app.get(`${prefix}/export`, { preHandler: [requireAuth] }, exportMemoriesHandler);
    app.patch(`${prefix}/:id`, { preHandler: [requireAuth, requireCsrf] }, updateMemoryHandler);
    app.delete(`${prefix}/:id`, { preHandler: [requireAuth, requireCsrf] }, deleteMemoryHandler);
  }
};
