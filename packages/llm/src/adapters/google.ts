import { GoogleGenAI } from '@google/genai';
import {
  LLMAdapter,
  ChatOptions,
  ChatEvent,
  GenerateObjectOptions,
  GenerateObjectResult,
  EmbedOptions,
  EmbedResult,
  ChatMessage,
  ToolCall,
} from '../types.js';
import { zodToJsonSchema, extractJsonFromText } from '../schema-helper.js';

export class GoogleAdapter implements LLMAdapter {
  provider = 'google' as const;
  private client: GoogleGenAI;
  private defaultModel: string;
  private defaultFastModel: string;

  constructor(opts: {
    apiKey: string;
    defaultModel?: string;
    defaultFastModel?: string;
  }) {
    this.client = new GoogleGenAI({ apiKey: opts.apiKey });
    this.defaultModel = opts.defaultModel || 'gemini-1.5-pro';
    this.defaultFastModel = opts.defaultFastModel || 'gemini-1.5-flash';
  }

  private mapMessages(messages: ChatMessage[]): any[] {
    return messages.map((m) => {
      if (m.role === 'system') {
        return {
          role: 'user',
          parts: [{ text: `[System Instructions]: ${m.content}` }],
        };
      }
      if (m.role === 'assistant') {
        return {
          role: 'model',
          parts: [{ text: m.content || '' }],
        };
      }
      return {
        role: 'user',
        parts: [{ text: m.content }],
      };
    });
  }

  async *chat(opts: ChatOptions): AsyncIterable<ChatEvent> {
    const model = opts.model || this.defaultModel;
    const contents = this.mapMessages(opts.messages);

    const stream = await this.client.models.generateContentStream({
      model,
      contents,
      config: {
        temperature: opts.temperature ?? 0.2,
      },
    });

    let tokensIn = 0;
    let tokensOut = 0;

    for await (const chunk of stream) {
      if ((chunk as any).usageMetadata) {
        tokensIn = (chunk as any).usageMetadata.promptTokenCount || 0;
        tokensOut = (chunk as any).usageMetadata.candidatesTokenCount || 0;
        yield { type: 'usage', tokensIn, tokensOut };
      }

      const text = chunk.text;
      if (text) {
        yield { type: 'text_delta', text };
      }
    }

    yield { type: 'done' };
  }

  async generateObject<T>(opts: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>> {
    const model = opts.model || this.defaultFastModel;
    const jsonSchema = zodToJsonSchema(opts.schema);

    const schemaInstruction = `You must return ONLY a valid JSON object matching this schema. Do not enclose in markdown code fences.\nSchema:\n${JSON.stringify(
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

    let contents = this.mapMessages(baseMessages);
    let attempts = 0;
    const maxRetries = opts.maxRetries ?? 1;

    let totalTokensIn = 0;
    let totalTokensOut = 0;

    while (attempts <= maxRetries) {
      attempts++;

      const res = await this.client.models.generateContent({
        model,
        contents,
        config: {
          temperature: opts.temperature ?? 0.1,
          responseMimeType: 'application/json',
        },
      });

      const usage = (res as any).usageMetadata;
      if (usage) {
        totalTokensIn += usage.promptTokenCount || 0;
        totalTokensOut += usage.candidatesTokenCount || 0;
      }

      const rawText = res.text || '{}';

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
            `Failed to validate structured JSON from Google after ${attempts} attempts: ${err.message}. Raw output: "${rawText.slice(0, 200)}"`
          );
        }

        contents.push({
          role: 'model',
          parts: [{ text: rawText }],
        });
        contents.push({
          role: 'user',
          parts: [
            {
              text: `Your previous output did not match the required schema: ${err.message}. Please fix the validation errors and return only the corrected JSON.`,
            },
          ],
        });
      }
    }

    throw new Error('Unexpected exit from Google generateObject loop');
  }

  async embed(opts: EmbedOptions): Promise<EmbedResult> {
    const model = opts.model || 'text-embedding-004';
    const embeddings: number[][] = [];

    for (const text of opts.texts) {
      const res = await this.client.models.embedContent({
        model,
        contents: text,
      });

      const values = (res as any).embedding?.values || [];
      embeddings.push(values);
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
