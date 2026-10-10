import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicAdapter implements LLMAdapter {
  provider = 'anthropic' as const;
  private client: Anthropic;
  private defaultModel: string;
  private defaultFastModel: string;

  constructor(opts: {
    apiKey: string;
    baseURL?: string;
    defaultModel?: string;
    defaultFastModel?: string;
  }) {
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      baseURL: opts.baseURL,
    });
    this.defaultModel = opts.defaultModel || 'claude-3-5-sonnet-20241022';
    this.defaultFastModel = opts.defaultFastModel || 'claude-3-5-haiku-20241022';
  }

  private extractSystemAndMessages(messages: ChatMessage[]): {
    system: string | undefined;
    anthropicMessages: Anthropic.MessageParam[];
  } {
    const systemParts: string[] = [];
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const m of messages) {
      if (m.role === 'system') {
        systemParts.push(m.content);
      } else if (m.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId || 'call_default',
              content: m.content,
            },
          ],
        });
      } else if (m.role === 'assistant') {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];
        if (m.content) {
          contentBlocks.push({ type: 'text', text: m.content });
        }
        if (m.toolCalls && m.toolCalls.length > 0) {
          for (const tc of m.toolCalls) {
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.args,
            });
          }
        }
        anthropicMessages.push({
          role: 'assistant',
          content: contentBlocks.length > 0 ? contentBlocks : m.content || '',
        });
      } else {
        anthropicMessages.push({
          role: 'user',
          content: m.content,
        });
      }
    }

    return {
      system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
      anthropicMessages,
    };
  }

  async *chat(opts: ChatOptions): AsyncIterable<ChatEvent> {
    const model = opts.model || this.defaultModel;
    const { system, anthropicMessages } = this.extractSystemAndMessages(opts.messages);

    const tools: Anthropic.Tool[] | undefined = opts.tools
      ? opts.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters as Anthropic.Tool.InputSchema,
        }))
      : undefined;

    const stream = await this.client.messages.create(
      {
        model,
        messages: anthropicMessages,
        system,
        tools: tools && tools.length > 0 ? tools : undefined,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens || 4096,
        stream: true,
      },
      { signal: opts.signal }
    );

    let tokensIn = 0;
    let tokensOut = 0;
    let currentToolCall: { id: string; name: string; jsonAccumulator: string } | null = null;

    for await (const chunk of stream) {
      if (chunk.type === 'message_start' && chunk.message?.usage) {
        tokensIn = chunk.message.usage.input_tokens || 0;
      }

      if (chunk.type === 'message_delta' && chunk.usage) {
        tokensOut = chunk.usage.output_tokens || 0;
        yield { type: 'usage', tokensIn, tokensOut };
      }

      if (chunk.type === 'content_block_start') {
        if (chunk.content_block?.type === 'tool_use') {
          currentToolCall = {
            id: chunk.content_block.id,
            name: chunk.content_block.name,
            jsonAccumulator: '',
          };
        }
      }

      if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: chunk.delta.text };
        } else if (chunk.delta.type === 'input_json_delta' && currentToolCall) {
          currentToolCall.jsonAccumulator += chunk.delta.partial_json;
        }
      }

      if (chunk.type === 'content_block_stop' && currentToolCall) {
        let args = {};
        try {
          args = JSON.parse(currentToolCall.jsonAccumulator || '{}');
        } catch {
          args = {};
        }
        const toolCall: ToolCall = {
          id: currentToolCall.id,
          name: currentToolCall.name,
          args,
        };
        yield { type: 'tool_call', toolCall };
        currentToolCall = null;
      }
    }

    yield { type: 'done' };
  }

  async generateObject<T>(opts: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>> {
    const model = opts.model || this.defaultFastModel;
    const jsonSchema = zodToJsonSchema(opts.schema);

    const schemaInstruction = `You must return ONLY a valid JSON object conforming to this schema. Do not enclose in markdown ticks, and do not include explanations.\nSchema:\n${JSON.stringify(
      jsonSchema,
      null,
      2
    )}`;

    const { system, anthropicMessages } = this.extractSystemAndMessages(opts.messages);
    const combinedSystem = system
      ? `${system}\n\n${schemaInstruction}`
      : schemaInstruction;

    const currentMessages: Anthropic.MessageParam[] = [...anthropicMessages];
    let attempts = 0;
    const maxRetries = opts.maxRetries ?? 1;

    let totalTokensIn = 0;
    let totalTokensOut = 0;

    while (attempts <= maxRetries) {
      attempts++;

      const res = await this.client.messages.create(
        {
          model,
          messages: currentMessages,
          system: combinedSystem,
          temperature: opts.temperature ?? 0.1,
          max_tokens: 4096,
        },
        { signal: opts.signal }
      );

      if (res.usage) {
        totalTokensIn += res.usage.input_tokens;
        totalTokensOut += res.usage.output_tokens;
      }

      const textBlock = res.content.find((c) => c.type === 'text') as Anthropic.TextBlock | undefined;
      const rawText = textBlock?.text || '{}';

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
            `Failed to validate structured JSON from Anthropic after ${attempts} attempts: ${err.message}. Raw output: "${rawText.slice(0, 200)}"`
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

    throw new Error('Unexpected exit from Anthropic generateObject loop');
  }

  async embed(_opts: EmbedOptions): Promise<EmbedResult> {
    // Anthropic does not provide native vector embedding API (Section 11.2 rule 7)
    // Fall back with warning / zero-vector representation
    return {
      embeddings: _opts.texts.map(() => new Array(1536).fill(0)),
      usage: { tokensIn: 0, tokensOut: 0 },
    };
  }
}
