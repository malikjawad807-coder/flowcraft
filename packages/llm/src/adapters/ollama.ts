import {
  LLMAdapter,
  ChatOptions,
  ChatEvent,
  GenerateObjectOptions,
  GenerateObjectResult,
  EmbedOptions,
  EmbedResult,
  ChatMessage,
} from '../types.js';
import { zodToJsonSchema, extractJsonFromText } from '../schema-helper.js';

export class OllamaAdapter implements LLMAdapter {
  provider = 'ollama' as const;
  private baseUrl: string;
  private defaultModel: string;
  private defaultFastModel: string;

  constructor(opts: {
    baseUrl?: string;
    defaultModel?: string;
    defaultFastModel?: string;
  }) {
    this.baseUrl = (opts.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
    this.defaultModel = opts.defaultModel || 'llama3.1:8b';
    this.defaultFastModel = opts.defaultFastModel || 'llama3.2:3b';
  }

  private mapMessages(messages: ChatMessage[]): any[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  async *chat(opts: ChatOptions): AsyncIterable<ChatEvent> {
    const model = opts.model || this.defaultModel;
    const url = `${this.baseUrl}/api/chat`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: this.mapMessages(opts.messages),
        stream: true,
        options: {
          temperature: opts.temperature ?? 0.2,
        },
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama chat request failed (${res.status}): ${errText}`);
    }

    if (!res.body) {
      throw new Error('Ollama response body is empty');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            yield { type: 'text_delta', text: parsed.message.content };
          }
          if (parsed.done) {
            const tokensIn = parsed.prompt_eval_count || 0;
            const tokensOut = parsed.eval_count || 0;
            yield { type: 'usage', tokensIn, tokensOut };
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }

    yield { type: 'done' };
  }

  async generateObject<T>(opts: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>> {
    const model = opts.model || this.defaultFastModel;
    const jsonSchema = zodToJsonSchema(opts.schema);

    const schemaInstruction = `You must return ONLY a valid JSON object matching this schema. No markdown ticks, no extra text.\nSchema:\n${JSON.stringify(
      jsonSchema,
      null,
      2
    )}`;

    const baseMessages: ChatMessage[] = [
      {
        role: 'system',
        content: opts.systemPrompt ? `${opts.systemPrompt}\n\n${schemaInstruction}` : schemaInstruction,
      },
      ...opts.messages,
    ];

    let currentMessages = this.mapMessages(baseMessages);
    let attempts = 0;
    const maxRetries = opts.maxRetries ?? 1;

    let totalTokensIn = 0;
    let totalTokensOut = 0;

    while (attempts <= maxRetries) {
      attempts++;

      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: currentMessages,
          stream: false,
          format: 'json',
          options: {
            temperature: opts.temperature ?? 0.1,
          },
        }),
        signal: opts.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama generateObject request failed (${res.status}): ${errText}`);
      }

      const data = await res.json();
      totalTokensIn += data.prompt_eval_count || 0;
      totalTokensOut += data.eval_count || 0;

      const rawText = data.message?.content || '{}';

      try {
        const parsed = extractJsonFromText(rawText);
        const validated = opts.schema.parse(parsed);

        return {
          object: validated,
          usage: { tokensIn: totalTokensIn, tokensOut: totalTokensOut },
          rawText,
        };
      } catch (err: any) {
        if (attempts > maxRetries) {
          throw new Error(
            `Failed to validate structured JSON from Ollama after ${attempts} attempts: ${err.message}. Raw output: "${rawText.slice(0, 200)}"`
          );
        }

        currentMessages.push({
          role: 'assistant',
          content: rawText,
        });
        currentMessages.push({
          role: 'user',
          content: `Your previous output did not match the required schema: ${err.message}. Please fix the validation errors and return only the corrected JSON.`,
        });
      }
    }

    throw new Error('Unexpected exit from Ollama generateObject loop');
  }

  async embed(opts: EmbedOptions): Promise<EmbedResult> {
    const model = opts.model || 'nomic-embed-text';
    const embeddings: number[][] = [];

    for (const text of opts.texts) {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
        signal: opts.signal,
      });

      if (res.ok) {
        const data = await res.json();
        embeddings.push(data.embedding || []);
      } else {
        // Fallback zero vector
        embeddings.push(new Array(1536).fill(0));
      }
    }

    return {
      embeddings,
      usage: {
        tokensIn: opts.texts.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0),
        tokensOut: 0,
      },
    };
  }
}
