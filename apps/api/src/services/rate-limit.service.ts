import { Redis } from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export class RateLimitService {
  private redis: Redis | null = null;
  private memoryStore: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(redisClient?: Redis | null) {
    if (redisClient) {
      this.redis = redisClient;
    }
  }

  /**
   * Checks and consumes one attempt against a sliding or fixed window rate limit.
   */
  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const prefixedKey = `rl:${key}`;
    const now = Math.floor(Date.now() / 1000);

    if (this.redis) {
      try {
        const current = await this.redis.incr(prefixedKey);
        if (current === 1) {
          await this.redis.expire(prefixedKey, windowSeconds);
        }

        if (current > limit) {
          const ttl = await this.redis.ttl(prefixedKey);
          return {
            allowed: false,
            retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
          };
        }

        return { allowed: true };
      } catch (err) {
        // Fall back to memory store if Redis query fails
      }
    }

    // In-memory fallback
    const entry = this.memoryStore.get(prefixedKey);
    if (!entry || entry.resetAt <= now) {
      this.memoryStore.set(prefixedKey, {
        count: 1,
        resetAt: now + windowSeconds,
      });
      return { allowed: true };
    }

    entry.count += 1;
    if (entry.count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, entry.resetAt - now),
      };
    }

    return { allowed: true };
  }
}
