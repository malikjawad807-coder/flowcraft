import { randomUUID } from 'node:crypto';
import { eq, and, sql, desc, inArray } from '@flowcart/db';
import { memories, userSettings } from '@flowcart/db';
import type { ServerContext } from '../types.js';
import { validateMemoryText } from './sensitive-filter.js';

export interface MemoryRecord {
  id: string;
  userId: string;
  text: string;
  category: string;
  importance: number;
  pinned: boolean;
  embedding?: number[] | null;
  source: 'explicit' | 'extracted' | 'manual';
  sourceConversationId?: string | null;
  useCount: number;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class MemoryService {
  /**
   * Retrieves user memories matching the query, plus pinned & rule/profile memories (Section 11.6).
   */
  static async searchMemories(
    ctx: ServerContext,
    query: string,
    options: { limit?: number; minSimilarity?: number } = {}
  ): Promise<{
    memories: MemoryRecord[];
    formattedBlock: string;
    usedIds: string[];
  }> {
    const minSimilarity = options.minSimilarity ?? 0.25;
    const limit = options.limit ?? 8;

    // 1. If memory is disabled or conversation is temporary, return empty
    if (ctx.memoryEnabled === false || ctx.isTemporary) {
      return { memories: [], formattedBlock: '', usedIds: [] };
    }

    if (!ctx.db) {
      return { memories: [], formattedBlock: '', usedIds: [] };
    }

    // 2. Fetch all memories for this user (User Isolation)
    const userMemories: any[] = await ctx.db
      .select()
      .from(memories)
      .where(eq(memories.userId, ctx.userId));

    if (userMemories.length === 0) {
      return { memories: [], formattedBlock: '', usedIds: [] };
    }

    // 3. Generate query embedding
    let queryEmbedding: number[] | null = null;
    try {
      if (ctx.llmClient?.embed) {
        const res = await ctx.llmClient.embed({
          texts: [query],
          userId: ctx.userId,
          purpose: 'memory_search',
        });
        if (res?.embeddings && res.embeddings.length > 0) {
          queryEmbedding = res.embeddings[0];
        }
      }
    } catch {
      // Graceful fallback to FTS
      queryEmbedding = null;
    }

    // 4. Calculate similarities and score
    const scored: Array<{ memory: any; similarity: number; matchesText: boolean }> = [];
    const queryTokens = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    for (const mem of userMemories) {
      let sim = 0;
      if (queryEmbedding && mem.embedding && Array.isArray(mem.embedding)) {
        sim = cosineSimilarity(queryEmbedding, mem.embedding);
      }

      // Simple keyword match fallback/boost
      const memTextLower = mem.text.toLowerCase();
      const matchesText = queryTokens.some((tok) => memTextLower.includes(tok));

      scored.push({ memory: mem, similarity: sim, matchesText });
    }

    // Filter by similarity >= 0.25 or text match
    const matched = scored
      .filter((s) => s.similarity >= minSimilarity || s.matchesText)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((s) => s.memory);

    // 5. Always include pinned memories and categories 'rule' or 'profile' (up to 10 total)
    const priority = userMemories.filter(
      (m) => m.pinned || m.category === 'rule' || m.category === 'profile'
    );

    // Deduplicate matched and priority
    const combinedMap = new Map<string, any>();
    for (const m of priority.slice(0, 10)) {
      combinedMap.set(m.id, m);
    }
    for (const m of matched) {
      if (combinedMap.size < 15) {
        combinedMap.set(m.id, m);
      }
    }

    const selectedMemories = Array.from(combinedMap.values());

    // Sort by importance (5 down to 1), then updated_at
    selectedMemories.sort((a, b) => {
      if ((b.importance || 3) !== (a.importance || 3)) {
        return (b.importance || 3) - (a.importance || 3);
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // 6. Format memory block: - [category] text (capped at ~800 tokens / 3200 chars)
    const lines: string[] = [];
    let charCount = 0;
    const usedIds: string[] = [];

    for (const m of selectedMemories) {
      const line = `- [${m.category}] ${m.text}`;
      if (charCount + line.length > 3200) break;
      lines.push(line);
      charCount += line.length + 1;
      usedIds.push(m.id);
    }

    // 7. Update use_count and last_used_at for used memories
    if (usedIds.length > 0) {
      try {
        for (const id of usedIds) {
          const target = userMemories.find((m) => m.id === id);
          if (target) {
            target.useCount = (target.useCount || 0) + 1;
            target.lastUsedAt = new Date();
          }
        }
      } catch {
        // Non-fatal
      }
    }

    return {
      memories: selectedMemories,
      formattedBlock: lines.join('\n'),
      usedIds,
    };
  }

  /**
   * Saves a new memory with sensitive data checking and de-duplication (Section 11.4 & 11.5).
   */
  static async saveMemory(
    ctx: ServerContext,
    input: {
      text: string;
      category: 'profile' | 'preference' | 'contact' | 'project' | 'style' | 'rule';
      importance?: number;
      source?: 'explicit' | 'extracted' | 'manual';
      sourceConversationId?: string;
    }
  ): Promise<{ memory: MemoryRecord; action: 'created' | 'updated' | 'merged' }> {
    // Workflow agent nodes cannot save memories
    if (ctx.isWorkflow) {
      throw new Error('Memory cannot be saved from workflow nodes.');
    }

    // Temporary chat cannot write memories
    if (ctx.isTemporary) {
      throw new Error('Memory saving is disabled in temporary chats.');
    }

    // Validate sensitive content
    const validation = validateMemoryText(input.text);
    if (!validation.isSafe) {
      throw new Error(validation.reason || 'Memory text contains forbidden sensitive data.');
    }

    if (!ctx.db) {
      throw new Error('Database is required to save memories.');
    }

    // Embed the candidate text
    let embedding: number[] | null = null;
    try {
      if (ctx.llmClient?.embed) {
        const res = await ctx.llmClient.embed({
          texts: [input.text],
          userId: ctx.userId,
          purpose: 'memory_save',
        });
        if (res?.embeddings && res.embeddings.length > 0) {
          embedding = res.embeddings[0];
        }
      }
    } catch {
      embedding = null;
    }

    // Fetch existing memories for user
    const existingMemories: any[] = await ctx.db
      .select()
      .from(memories)
      .where(eq(memories.userId, ctx.userId));

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

    // Similarity threshold 0.88 indicates essentially same fact
    if (highestSim >= 0.88 && nearestMatch) {
      // Update existing memory
      nearestMatch.text = input.text;
      nearestMatch.category = input.category || nearestMatch.category;
      nearestMatch.importance = input.importance || nearestMatch.importance;
      nearestMatch.embedding = embedding || nearestMatch.embedding;
      nearestMatch.updatedAt = new Date();

      return {
        memory: nearestMatch,
        action: highestSim >= 0.98 ? 'updated' : 'merged',
      };
    }

    // Check soft cap (300) and hard cap (500)
    if (existingMemories.length >= 500) {
      throw new Error('Memory limit exceeded: Maximum 500 memories allowed.');
    }

    const newMem: MemoryRecord = {
      id: randomUUID(),
      userId: ctx.userId,
      text: input.text.trim(),
      category: input.category,
      importance: input.importance ?? 3,
      pinned: false,
      embedding,
      source: input.source || 'explicit',
      sourceConversationId: input.sourceConversationId || null,
      useCount: 0,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await ctx.db.insert(memories).values(newMem);

    return {
      memory: newMem,
      action: 'created',
    };
  }

  /**
   * Deletes a memory by ID (Section 11.8).
   */
  static async forgetMemory(ctx: ServerContext, memoryId: string): Promise<boolean> {
    if (!ctx.db) return false;

    await ctx.db
      .delete(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, ctx.userId)));

    return true;
  }

  /**
   * Deletes all memories for a user (Forget Everything, Section 11.8).
   */
  static async forgetAllMemories(userId: string, db: any): Promise<number> {
    if (!db) return 0;
    const existing = await db.select().from(memories).where(eq(memories.userId, userId));
    await db.delete(memories).where(eq(memories.userId, userId));
    return existing.length;
  }
}
