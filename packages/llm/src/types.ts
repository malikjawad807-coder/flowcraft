import { z } from 'zod';

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'mock';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

export type ChatEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'usage'; tokensIn: number; tokensOut: number }
  | { type: 'done' };

export interface ChatOptions {
  model?: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  purpose?: string;
  userId?: string;
}

export interface GenerateObjectOptions<T> {
  model?: string;
  messages: ChatMessage[];
  schema: z.ZodType<T>;
  systemPrompt?: string;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  purpose?: string;
  userId?: string;
}

export interface GenerateObjectResult<T> {
  object: T;
  usage: {
    tokensIn: number;
    tokensOut: number;
  };
  rawText?: string;
}

export interface EmbedOptions {
  texts: string[];
  model?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  purpose?: string;
  userId?: string;
}

export interface EmbedResult {
  embeddings: number[][];
  usage: {
    tokensIn: number;
    tokensOut: number;
  };
}

export interface UsageRecord {
  userId?: string;
  provider: LLMProvider;
  model: string;
  purpose: string;
  tokensIn: number;
  tokensOut: number;
}

export interface LLMAdapter {
  provider: LLMProvider;
  chat(opts: ChatOptions): AsyncIterable<ChatEvent>;
  generateObject<T>(opts: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>>;
  embed(opts: EmbedOptions): Promise<EmbedResult>;
}

export interface LLMConfig {
  defaultProvider: LLMProvider;
  modelAgent?: string;
  modelFast?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingDim?: number;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  ollamaBaseUrl?: string;
  timeoutMs?: number;
}

export interface LLMClient {
  chat(opts: any): AsyncIterable<ChatEvent>;
  generateObject<T>(opts: any): Promise<GenerateObjectResult<T>>;
  embed(opts: any): Promise<EmbedResult>;
}

