import OpenAI from 'openai';
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

export class OpenAIAdapter implements LLMAdapter {
  provider = 'openai' as const;
  private client: OpenAI;
  private defaultModel: string;
  private defaultFastModel: string;

  constructor(opts: {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
    defaultFastModel?: string;
  }) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL,
    });
    this.defaultModel = opts.defaultModel || 'gpt-4o';
    this.defaultFastModel = opts.defaultFastModel || 'gpt-4o-mini';
  }

  private mapMessages(messages: ChatMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: m.toolCallId || 'call_default',
          content: m.content,
        };
      }

      if (m.role === 'assistant') {
        const out: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: m.content || null,
        };
        if (m.toolCalls && m.toolCalls.length > 0) {
          out.tool_calls = m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          }));
        }
        return out;
      }

      return {
        role: m.role as 'system' | 'user',
        content: m.content,
      };
    });
  }

  async *chat(opts: ChatOptions): AsyncIterable<ChatEvent> {
    const model = opts.model || this.defaultModel;
    const messages = this.mapMessages(opts.messages);

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined = opts.tools
      ? opts.tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }))
      : undefined;

    const stream = await this.client.chat.completions.create(
      {
        model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: opts.signal }
    );

    const pendingToolCalls: Map<number, { id: string; name: string; argsText: string }> = new Map();
    let tokensIn = 0;
    let tokensOut = 0;

    for await (const chunk of stream) {
      if (chunk.usage) {
        tokensIn = chunk.usage.prompt_tokens || 0;
        tokensOut = chunk.usage.completion_tokens || 0;
        yield { type: 'usage', tokensIn, tokensOut };
      }

      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      if (delta.content) {
        yield { type: 'text_delta', text: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index;
          let existing = pendingToolCalls.get(index);
          if (!existing) {
            existing = {
              id: tc.id || `call_${Date.now()}_${index}`,
              name: tc.function?.name || '',
              argsText: '',
            };
            pendingToolCalls.set(index, existing);
          }
          if (tc.function?.name) {
            existing.name = tc.function.name;
          }
          if (tc.function?.arguments) {
            existing.argsText += tc.function.arguments;
          }
        }
      }

      if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
        for (const [, callData] of pendingToolCalls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(callData.argsText || '{}');
          } catch {
            parsedArgs = {};
          }
          const toolCall: ToolCall = {
            id: callData.id,
            name: callData.name,
            args: parsedArgs,
          };
          yield { type: 'tool_call', toolCall };
        }
        pendingToolCalls.clear();
      }
    }

    yield { type: 'done' };
  }

  async generateObject<T>(opts: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>> {
    const model = opts.model || this.defaultFastModel;
    const jsonSchema = zodToJsonSchema(opts.schema);

    const systemInstruction = `You must return ONLY a valid JSON object matching this schema. No markdown formatting, no explanations, no text outside JSON.\nSchema:\n${JSON.stringify(
      jsonSchema,
      null,
      2
    )}`;

    const baseMessages: ChatMessage[] = [
      { role: 'system', content: opts.systemPrompt ? `${opts.systemPrompt}\n\n${systemInstruction}` : systemInstruction },
      ...opts.messages,
    ];

    let currentMessages = this.mapMessages(baseMessages);
    let attempts = 0;
    const maxRetries = opts.maxRetries ?? 1; // 1 corrective retry (Section 10.3)

    let totalTokensIn = 0;
    let totalTokensOut = 0;

    while (attempts <= maxRetries) {
      attempts++;

      const completion = await this.client.chat.completions.create(
        {
          model,
          messages: currentMessages,
          response_format: { type: 'json_object' },
          temperature: opts.temperature ?? 0.1,
        },
        { signal: opts.signal }
      );

      const usage = completion.usage;
      if (usage) {
        totalTokensIn += usage.prompt_tokens;
        totalTokensOut += usage.completion_tokens;
      }

      const rawText = completion.choices[0]?.message?.content || '{}';

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
            `Failed to validate structured JSON against schema after ${attempts} attempts: ${err.message}. Raw output: "${rawText.slice(0, 200)}"`
          );
        }

        // Corrective message for repair retry (Section 10.3)
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

    throw new Error('Unexpected exit from generateObject loop');
  }

  async embed(opts: EmbedOptions): Promise<EmbedResult> {
    const model = opts.model || 'text-embedding-3-small';

    const res = await this.client.embeddings.create(
      {
        model,
        input: opts.texts,
      },
      { signal: opts.signal }
    );

    return {
      embeddings: res.data.map((d) => d.embedding),
      usage: {
        tokensIn: res.usage.prompt_tokens || 0,
        tokensOut: 0,
      },
    };
  }
}
