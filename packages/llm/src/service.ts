import {
  LLMAdapter,
  LLMConfig,
  LLMProvider,
  ChatOptions,
  ChatEvent,
  GenerateObjectOptions,
  GenerateObjectResult,
  EmbedOptions,
  EmbedResult,
  UsageRecord,
} from './types.js';
import { OpenAIAdapter } from './adapters/openai.js';
import { AnthropicAdapter } from './adapters/anthropic.js';
import { GoogleAdapter } from './adapters/google.js';
import { OllamaAdapter } from './adapters/ollama.js';
import { MockAdapter } from './adapters/mock.js';

export interface ResolveAdapterOptions {
  provider?: LLMProvider;
  personalKey?: string;
  baseUrl?: string;
  userId?: string;
}

export class LLMService {
  private config: LLMConfig;
  private onUsageRecord?: (record: UsageRecord) => Promise<void> | void;

  constructor(
    config: LLMConfig,
    onUsageRecord?: (record: UsageRecord) => Promise<void> | void
  ) {
    this.config = config;
    this.onUsageRecord = onUsageRecord;
  }

  getAdapter(opts: ResolveAdapterOptions = {}): LLMAdapter {
    const provider = opts.provider || this.config.defaultProvider || 'openai';

    switch (provider) {
      case 'openai': {
        const apiKey = opts.personalKey || this.config.openaiApiKey;
        if (!apiKey) {
          // If no key provided, gracefully fallback to MockAdapter (Phase 6 rule)
          return new MockAdapter();
        }
        return new OpenAIAdapter({
          apiKey,
          defaultModel: this.config.modelAgent || 'gpt-4o',
          defaultFastModel: this.config.modelFast || 'gpt-4o-mini',
        });
      }

      case 'anthropic': {
        const apiKey = opts.personalKey || this.config.anthropicApiKey;
        if (!apiKey) {
          return new MockAdapter();
        }
        return new AnthropicAdapter({
          apiKey,
          defaultModel: this.config.modelAgent || 'claude-3-5-sonnet-20241022',
          defaultFastModel: this.config.modelFast || 'claude-3-5-haiku-20241022',
        });
      }

      case 'google': {
        const apiKey = opts.personalKey || this.config.googleApiKey;
        if (!apiKey) {
          return new MockAdapter();
        }
        return new GoogleAdapter({
          apiKey,
          defaultModel: this.config.modelAgent || 'gemini-1.5-pro',
          defaultFastModel: this.config.modelFast || 'gemini-1.5-flash',
        });
      }

      case 'ollama': {
        return new OllamaAdapter({
          baseUrl: opts.baseUrl || this.config.ollamaBaseUrl || 'http://localhost:11434',
          defaultModel: this.config.modelAgent || 'llama3.1:8b',
          defaultFastModel: this.config.modelFast || 'llama3.2:3b',
        });
      }

      case 'mock':
      default:
        return new MockAdapter();
    }
  }

  async *chat(opts: ChatOptions & ResolveAdapterOptions): AsyncIterable<ChatEvent> {
    const adapter = this.getAdapter(opts);
    const stream = adapter.chat(opts);

    let totalTokensIn = 0;
    let totalTokensOut = 0;

    for await (const event of stream) {
      if (event.type === 'usage') {
        totalTokensIn = event.tokensIn;
        totalTokensOut = event.tokensOut;
      }
      yield event;
    }

    if (this.onUsageRecord && (totalTokensIn > 0 || totalTokensOut > 0)) {
      await this.onUsageRecord({
        userId: opts.userId,
        provider: adapter.provider,
        model: opts.model || 'default',
        purpose: opts.purpose || 'chat',
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
      });
    }
  }

  async generateObject<T>(
    opts: GenerateObjectOptions<T> & ResolveAdapterOptions
  ): Promise<GenerateObjectResult<T>> {
    const adapter = this.getAdapter(opts);
    const result = await adapter.generateObject(opts);

    if (this.onUsageRecord && result.usage) {
      await this.onUsageRecord({
        userId: opts.userId,
        provider: adapter.provider,
        model: opts.model || 'fast',
        purpose: opts.purpose || 'classify',
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
      });
    }

    return result;
  }

  async embed(opts: EmbedOptions & ResolveAdapterOptions): Promise<EmbedResult> {
    const adapter = this.getAdapter(opts);
    const result = await adapter.embed(opts);

    if (this.onUsageRecord && result.usage) {
      await this.onUsageRecord({
        userId: opts.userId,
        provider: adapter.provider,
        model: opts.model || 'embedding',
        purpose: opts.purpose || 'memory',
        tokensIn: result.usage.tokensIn,
        tokensOut: result.usage.tokensOut,
      });
    }

    return result;
  }
}
