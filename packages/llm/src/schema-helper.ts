import { z } from 'zod';

/**
 * Lightweight, zero-dependency Zod to JSON Schema converter for tool calling & structured output
 */
export function zodToJsonSchema(schema: z.ZodType<any>): Record<string, any> {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodType<any>;
      properties[key] = zodToJsonSchema(fieldSchema);

      if (!(fieldSchema instanceof z.ZodOptional) && !(fieldSchema instanceof z.ZodNullable)) {
        required.push(key);
      }
    }

    const out: Record<string, any> = {
      type: 'object',
      properties,
    };
    if (required.length > 0) {
      out.required = required;
    }
    out.additionalProperties = false;
    return out;
  }

  if (schema instanceof z.ZodString) {
    const out: Record<string, any> = { type: 'string' };
    if (schema.description) out.description = schema.description;
    return out;
  }

  if (schema instanceof z.ZodNumber) {
    const out: Record<string, any> = { type: 'number' };
    if (schema.description) out.description = schema.description;
    return out;
  }

  if (schema instanceof z.ZodBoolean) {
    const out: Record<string, any> = { type: 'boolean' };
    if (schema.description) out.description = schema.description;
    return out;
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema.options,
      description: schema.description,
    };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(schema.element),
      description: schema.description,
    };
  }

  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap());
  }

  if (schema instanceof z.ZodNullable) {
    return zodToJsonSchema(schema.unwrap());
  }

  if (schema instanceof z.ZodDefault) {
    return zodToJsonSchema(schema._def.innerType);
  }

  // Fallback for primitive or any
  return { type: 'string' };
}

/**
 * Extracts a JSON object from model output text, handling Markdown code fences (e.g. ```json ... ```)
 */
export function extractJsonFromText(text: string): any {
  const trimmed = text.trim();

  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to fence extraction
  }

  // Check for markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // Continue
    }
  }

  // Check for opening { and closing }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const substring = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(substring);
  }

  throw new Error(`Failed to extract valid JSON from model response: "${trimmed.slice(0, 100)}..."`);
}
