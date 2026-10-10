import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryService, cosineSimilarity } from './memory/service.js';
import { validateMemoryText, passesLuhnCheck } from './memory/sensitive-filter.js';
import type { ServerContext } from './types.js';

describe('Memory System Unit Tests (Section 11 & Section 17.2)', () => {
  let mockDb: any;
  let mockLlm: any;
  let userACtx: ServerContext;
  let userBCtx: ServerContext;

  beforeEach(() => {
    const memoryStore: any[] = [];

    mockDb = {
      memories: memoryStore,
      select: () => ({
        from: () => ({
          where: (cond: any) => {
            // Filter by userId if condition provided
            if (typeof cond === 'function') {
              return memoryStore.filter(cond);
            }
            if (cond?.queryChunks) {
              const uIdChunk = cond.queryChunks.find((c: any) => c?.value && typeof c.value === 'string');
              if (uIdChunk) {
                return memoryStore.filter((m) => m.userId === uIdChunk.value);
              }
            }
            return memoryStore;
          },
        }),
      }),
      insert: () => ({
        values: (val: any) => {
          memoryStore.push(val);
          return Promise.resolve();
        },
      }),
      delete: () => ({
        where: (cond: any) => {
          const extractStrings = (chunk: any): string[] => {
            if (!chunk) return [];
            if (typeof chunk.value === 'string') return [chunk.value];
            if (Array.isArray(chunk.queryChunks)) {
              return chunk.queryChunks.flatMap(extractStrings);
            }
            return [];
          };
          const strings = extractStrings(cond);
          if (strings.length > 0) {
            const remaining = memoryStore.filter((m) => {
              // Delete if matches id or if condition is user-level wipe
              return !strings.includes(m.id) && !strings.includes(m.userId);
            });
            memoryStore.length = 0;
            memoryStore.push(...remaining);
          }
          return Promise.resolve();
        },
      }),
    };

    // Deterministic mock embedding generator: 1536-dimensional unit vectors
    mockLlm = {
      embed: vi.fn().mockImplementation(async ({ texts }: { texts: string[] }) => {
        const embeddings = texts.map((t) => {
          const vec = new Array(1536).fill(0);
          // Simple hash distribution
          let hash = 0;
          for (let i = 0; i < t.length; i++) {
            hash = (hash << 5) - hash + t.charCodeAt(i);
            hash |= 0;
          }
          const idx = Math.abs(hash) % 1536;
          vec[idx] = 1.0;
          return vec;
        });
        return { embeddings, usage: { tokensIn: 10, tokensOut: 0 } };
      }),
    };

    userACtx = {
      userId: 'user_a_123',
      runId: 'run_1',
      db: mockDb,
      llmClient: mockLlm,
      userEmail: 'alice@example.com',
      userName: 'Alice',
      memoryEnabled: true,
      isTemporary: false,
    };

    userBCtx = {
      userId: 'user_b_456',
      runId: 'run_2',
      db: mockDb,
      llmClient: mockLlm,
      userEmail: 'bob@example.com',
      userName: 'Bob',
      memoryEnabled: true,
      isTemporary: false,
    };
  });

  describe('1. Sensitive Data Filter & Luhn Check (Section 11.3)', () => {
    it('detects credit card numbers passing Luhn check', () => {
      // Standard test Visa number passing Luhn
      expect(passesLuhnCheck('4532015112830366')).toBe(true);
      // Invalid checksum
      expect(passesLuhnCheck('4532015112830367')).toBe(false);
      // Non-card number
      expect(passesLuhnCheck('12345')).toBe(false);
    });

    it('rejects passwords, API keys, card numbers, and bearer tokens', () => {
      const badExamples = [
        'My password is Password123!',
        'User passcode: 88910',
        'Save api_key = sk-1234567890abcdef1234567890',
        'Use token ghp_12345678901234567890123456789012',
        'Credit card 4532015112830366 expires 12/28',
        'My social security number is 123-45-6789',
        'Authorization: Bearer my_secret_token_1234567890',
        'Bank account number 123456789012',
        'User was diagnosed with hypertension',
      ];

      for (const ex of badExamples) {
        const res = validateMemoryText(ex);
        expect(res.isSafe, `Expected "${ex}" to be rejected`).toBe(false);
      }
    });

    it('allows valid durable user preferences and standing rules', () => {
      const validExamples = [
        'User prefers concise, bulleted email replies',
        'Ali is a colleague on the engineering team',
        'Working hours are 9am to 5pm Pacific Time',
        'Do not send emails before 9 am',
        'Sign emails as Best regards, Alice',
      ];

      for (const ex of validExamples) {
        const res = validateMemoryText(ex);
        expect(res.isSafe, `Expected "${ex}" to be allowed`).toBe(true);
      }
    });
  });

  describe('2. User Isolation & Search (Section 11.6 & Section 17.3)', () => {
    it('enforces strict user isolation: User B cannot retrieve User A memories', async () => {
      // Alice saves a memory
      await MemoryService.saveMemory(userACtx, {
        text: 'Alice prefers dark mode and brief summaries',
        category: 'preference',
        importance: 4,
      });

      // Bob searches for dark mode
      const bobSearch = await MemoryService.searchMemories(userBCtx, 'dark mode preferences');
      expect(bobSearch.memories).toHaveLength(0);
      expect(bobSearch.formattedBlock).toBe('');

      // Alice searches for dark mode
      const aliceSearch = await MemoryService.searchMemories(userACtx, 'dark mode');
      expect(aliceSearch.memories).toHaveLength(1);
      expect(aliceSearch.memories[0].text).toContain('Alice prefers dark mode');
    });

    it('pinned and rule memories are prioritized in search results', async () => {
      await MemoryService.saveMemory(userACtx, {
        text: 'Never schedule meetings on Friday afternoons',
        category: 'rule',
        importance: 5,
      });

      const res = await MemoryService.searchMemories(userACtx, 'General query');
      expect(res.memories.some((m) => m.category === 'rule')).toBe(true);
      expect(res.formattedBlock).toContain('[rule] Never schedule meetings on Friday afternoons');
    });
  });

  describe('3. De-duplication and Contradiction Updates (Section 11.5)', () => {
    it('merges or updates near-duplicate memories when similarity >= 0.88', async () => {
      // First save
      const first = await MemoryService.saveMemory(userACtx, {
        text: 'User prefers short emails',
        category: 'preference',
      });
      expect(first.action).toBe('created');

      // Mock LLM to return exact same vector for near duplicate
      const vec = new Array(1536).fill(0.1);
      mockLlm.embed.mockResolvedValueOnce({ embeddings: [vec] });
      mockDb.memories[0].embedding = vec;

      mockLlm.embed.mockResolvedValueOnce({ embeddings: [vec] });

      // Second save with essentially same meaning
      const second = await MemoryService.saveMemory(userACtx, {
        text: 'User prefers short and concise emails',
        category: 'preference',
      });

      expect(second.action).toBe('updated');
      expect(mockDb.memories).toHaveLength(1);
      expect(mockDb.memories[0].text).toBe('User prefers short and concise emails');
    });
  });

  describe('4. Temporary Chat & Memory Controls (Section 11.8)', () => {
    it('temporary chats neither read nor write long-term memory', async () => {
      const tempCtx = { ...userACtx, isTemporary: true };

      // Attempt write in temporary chat -> rejected
      await expect(
        MemoryService.saveMemory(tempCtx, {
          text: 'User likes coffee',
          category: 'preference',
        })
      ).rejects.toThrow('disabled in temporary chats');

      // Attempt read in temporary chat -> returns empty
      const searchRes = await MemoryService.searchMemories(tempCtx, 'coffee');
      expect(searchRes.memories).toHaveLength(0);
      expect(searchRes.formattedBlock).toBe('');
    });

    it('forgetMemory permanently removes a memory item', async () => {
      const saved = await MemoryService.saveMemory(userACtx, {
        text: 'Working on project Apollo',
        category: 'project',
      });

      expect(mockDb.memories).toHaveLength(1);
      const memId = saved.memory.id;

      // Forget memory
      await MemoryService.forgetMemory(userACtx, memId);
      expect(mockDb.memories.filter((m: any) => m.id === memId)).toHaveLength(0);
    });

    it('workflow nodes cannot call memory_save', async () => {
      const wfCtx = { ...userACtx, isWorkflow: true };
      await expect(
        MemoryService.saveMemory(wfCtx, {
          text: 'Attempt to save from workflow',
          category: 'rule',
        })
      ).rejects.toThrow('Memory cannot be saved from workflow nodes');
    });
  });
});
