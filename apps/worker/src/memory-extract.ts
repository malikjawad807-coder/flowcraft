import { z } from 'zod';
import { eq, and } from '@flowcart/db';
import { conversations, messages, userSettings } from '@flowcart/db';
import { LLMService } from '@flowcart/llm';
import { MemoryService, validateMemoryText } from '@flowcart/agent';
import pino from 'pino';

export interface MemoryExtractJobData {
  conversationId: string;
  userId: string;
}

export interface MemoryExtractContext {
  db: any;
  llmService: LLMService;
  logger: pino.Logger;
}

const extractedFactSchema = z.object({
  text: z.string().max(500),
  category: z.enum(['profile', 'preference', 'contact', 'project', 'style', 'rule']),
  importance: z.number().int().min(1).max(5).default(3),
  action: z.string().optional(),
});

const memoryExtractionArraySchema = z.array(extractedFactSchema).max(5);

export async function handleMemoryExtractJob(
  data: MemoryExtractJobData,
  ctx: MemoryExtractContext
): Promise<{ extractedCount: number; reason?: string }> {
  const { conversationId, userId } = data;
  const { db, llmService, logger } = ctx;

  // 1. Check user settings
  const settingsRows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const settings = settingsRows[0];
  if (settings) {
    if (settings.memoryEnabled === false) {
      logger.info(`[MemoryExtract] Skipping: memory is disabled for user ${userId}`);
      return { extractedCount: 0, reason: 'memory_disabled' };
    }
    if (settings.memoryLearnEnabled === false) {
      logger.info(`[MemoryExtract] Skipping: memory learning is disabled for user ${userId}`);
      return { extractedCount: 0, reason: 'learn_disabled' };
    }
  }

  // 2. Check conversation (skip temporary chats)
  const convRows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));

  const conv = convRows[0];
  if (!conv) {
    return { extractedCount: 0, reason: 'conversation_not_found' };
  }

  if (conv.temporary) {
    logger.info(`[MemoryExtract] Skipping: conversation ${conversationId} is temporary`);
    return { extractedCount: 0, reason: 'temporary_chat' };
  }

  // 3. Load user messages (role === 'user' only; Section 11.3 Injection Rule)
  const allMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  const userMessages = allMessages
    .filter((m: any) => m.role === 'user')
    .map((m: any) => m.content)
    .filter(Boolean);

  if (userMessages.length === 0) {
    return { extractedCount: 0, reason: 'no_user_messages' };
  }

  // Take the most recent user messages (up to 10)
  const recentTexts = userMessages.slice(-10);

  // 4. Prompt the fast model for extraction
  const systemPrompt = `You extract durable facts about the user from their own messages. Return a JSON array, at most 5 items:
{ text, category, importance 1-5, action }.
Rules:
- Only facts likely true and useful in 3+ months:
  identity, preferences, style, standing rules, projects.
- One short sentence each, third person, no quotes.
- Skip anything temporary, any secret, any number that
  identifies a person or account, and anything sensitive
  (health, beliefs, finances, minors).
- Skip facts about other people except name + relationship.
- If nothing qualifies, return an empty array.`;

  const userContent = recentTexts.map((t: string, idx: number) => `[User Message ${idx + 1}]: ${t}`).join('\n');

  let extractedItems: any[] = [];
  try {
    const res = await llmService.generateObject({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      schema: memoryExtractionArraySchema,
      temperature: 0.1,
      userId,
      purpose: 'memory_extract',
    });

    extractedItems = (res.object as any[]) || [];
  } catch (err: any) {
    logger.warn(`[MemoryExtract] LLM extraction error: ${err.message}`);
    return { extractedCount: 0, reason: 'llm_error' };
  }

  if (extractedItems.length === 0) {
    logger.info(`[MemoryExtract] No durable facts qualified in conversation ${conversationId}`);
    return { extractedCount: 0 };
  }

  // 5. Filter and save each memory
  let savedCount = 0;
  const serverCtx: any = {
    userId,
    runId: `mem_${Date.now()}`,
    db,
    llmClient: llmService,
    isWorkflow: false,
    isTemporary: false,
    memoryEnabled: true,
  };

  for (const item of extractedItems) {
    const check = validateMemoryText(item.text);
    if (!check.isSafe) {
      logger.warn(`[MemoryExtract] Dropped unsafe extracted memory: ${item.text} (${check.reason})`);
      continue;
    }

    try {
      await MemoryService.saveMemory(serverCtx, {
        text: item.text,
        category: item.category,
        importance: item.importance,
        source: 'extracted',
        sourceConversationId: conversationId,
      });
      savedCount++;
    } catch (saveErr: any) {
      logger.warn(`[MemoryExtract] Could not save extracted memory: ${saveErr.message}`);
    }
  }

  logger.info(`[MemoryExtract] Successfully extracted and saved ${savedCount} memories for user ${userId}`);
  return { extractedCount: savedCount };
}
