import {
  LLMAdapter,
  ChatOptions,
  ChatEvent,
  GenerateObjectOptions,
  GenerateObjectResult,
  EmbedOptions,
  EmbedResult,
} from '../types.js';

export class MockAdapter implements LLMAdapter {
  provider = 'mock' as const;

  async *chat(opts: ChatOptions): AsyncIterable<ChatEvent> {
    const userMsg = opts.messages.find((m) => m.role === 'user')?.content || 'Hello';
    const text = `[Mock AI Response] Evaluated: "${userMsg.slice(0, 50)}...". Action complete.`;

    // Stream out words
    const words = text.split(' ');
    for (const w of words) {
      yield { type: 'text_delta', text: w + ' ' };
    }

    yield { type: 'usage', tokensIn: Math.ceil(userMsg.length / 4), tokensOut: Math.ceil(text.length / 4) };
    yield { type: 'done' };
  }

  async generateObject<T>(opts: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>> {
    const userMessages = opts.messages.filter((m) => m.role === 'user');
    const inputContent = (userMessages.length > 0 ? userMessages : opts.messages)
      .map((m) => m.content)
      .join(' ');

    // Check if this is an ai.classify call
    const shape = (opts.schema as any).shape;
    let mockResult: any = {};

    if (shape && 'category' in shape && 'confidence' in shape) {
      const lower = inputContent.toLowerCase();
      let category = 'other';
      let confidence = 0.92;
      let reason = 'Classified based on contextual email intent';

      if (lower.includes('support') || lower.includes('help') || lower.includes('error') || lower.includes('cannot') || lower.includes('issue')) {
        category = 'support_question';
        reason = 'Customer is reporting a technical issue and asking for help';
      } else if (lower.includes('quote') || lower.includes('buy') || lower.includes('pricing') || lower.includes('interested') || lower.includes('sales')) {
        category = 'sales_lead';
        reason = 'Prospective lead asking for enterprise pricing and consultation';
      } else if (lower.includes('invoice') || lower.includes('billing') || lower.includes('payment') || lower.includes('charge')) {
        category = 'billing';
        reason = 'Customer query regarding billing statement or receipt';
      } else if (lower.includes('newsletter') || lower.includes('unsubscribe') || lower.includes('promotions')) {
        category = 'newsletter';
        reason = 'Automated marketing notification';
      }

      mockResult = {
        category,
        confidence,
        reason,
      };
    } else {
      // Generic mock JSON based on schema keys
      if (shape) {
        for (const [key] of Object.entries(shape)) {
          mockResult[key] = `mock_${key}_value`;
        }
      } else {
        mockResult = { result: 'mock_success' };
      }
    }

    // Validate with user's schema
    const validated = opts.schema.parse(mockResult);

    return {
      object: validated,
      usage: {
        tokensIn: Math.ceil(inputContent.length / 4),
        tokensOut: 45,
      },
      rawText: JSON.stringify(validated),
    };
  }

  async embed(opts: EmbedOptions): Promise<EmbedResult> {
    // Generate deterministic 1536-dimensional mock embedding
    const embeddings = opts.texts.map((text) => {
      const vec = new Array(1536).fill(0);
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
      }
      for (let j = 0; j < 1536; j++) {
        vec[j] = Math.sin(hash + j);
      }
      // Normalize vector
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
      return vec.map((v) => v / norm);
    });

    return {
      embeddings,
      usage: {
        tokensIn: opts.texts.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0),
        tokensOut: 0,
      },
    };
  }
}
