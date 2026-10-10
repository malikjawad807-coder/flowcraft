import jsonata from 'jsonata';

export interface ExpressionContext {
  json: Record<string, any>;
  node?: Record<string, { json: Record<string, any> }>;
  trigger?: Record<string, any>;
  user?: { id?: string; email?: string; name?: string };
  now?: string;
  [key: string]: any;
}

export class ExpressionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Expression execution exceeded timeout ceiling of ${timeoutMs}ms`);
    this.name = 'ExpressionTimeoutError';
  }
}

export class ExpressionSizeLimitError extends Error {
  constructor(maxBytes: number) {
    super(`Expression result exceeded maximum allowed size of ${maxBytes} bytes`);
    this.name = 'ExpressionSizeLimitError';
  }
}

const DEFAULT_TIMEOUT_MS = 50;
const MAX_RESULT_BYTES = 100 * 1024; // 100 KB

/**
 * Safely evaluates a single JSONata expression against an execution context,
 * enforcing a 50ms evaluation ceiling and size limits without eval/new Function.
 */
export async function evaluateJsonata(
  expressionStr: string,
  context: ExpressionContext,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<any> {
  const trimmed = expressionStr.trim();
  if (!trimmed) return undefined;

  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ExpressionTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const expr = jsonata(trimmed);

    // Prepare clean context object
    const evalData = {
      ...context,
      json: context.json ?? {},
      node: context.node ?? {},
      trigger: context.trigger ?? {},
      user: context.user ?? {},
      now: context.now ?? new Date().toISOString(),
    };

    const evalPromise = Promise.resolve(expr.evaluate(evalData));
    const result = await Promise.race([evalPromise, timeoutPromise]);

    // Check size if result is string or large JSON
    if (typeof result === 'string' && Buffer.byteLength(result, 'utf8') > MAX_RESULT_BYTES) {
      throw new ExpressionSizeLimitError(MAX_RESULT_BYTES);
    } else if (result !== null && typeof result === 'object') {
      const serialized = JSON.stringify(result);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_RESULT_BYTES) {
        throw new ExpressionSizeLimitError(MAX_RESULT_BYTES);
      }
    }

    return result;
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Resolves a template string containing {{ expression }} placeholders.
 * If the template is exactly "{{ expression }}", returns the raw evaluated value.
 */
export async function resolveTemplate(
  template: string,
  context: ExpressionContext,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<any> {
  if (typeof template !== 'string') return template;

  // Exact single expression match: preserve raw return type (number, boolean, object, array)
  const exactMatch = template.match(/^\s*\{\{\s*([\s\S]+?)\s*\}\}\s*$/);
  if (exactMatch) {
    try {
      return await evaluateJsonata(exactMatch[1], context, timeoutMs);
    } catch {
      return '';
    }
  }

  // Multi-expression or embedded string interpolation
  const regex = /\{\{\s*([\s\S]+?)\s*\}\}/g;
  let matches = [...template.matchAll(regex)];
  if (matches.length === 0) {
    return template;
  }

  let result = template;
  for (const match of matches) {
    const fullTag = match[0];
    const expr = match[1];
    let val: any = '';
    try {
      val = await evaluateJsonata(expr, context, timeoutMs);
      if (val === undefined || val === null) {
        val = '';
      } else if (typeof val === 'object') {
        val = JSON.stringify(val);
      } else {
        val = String(val);
      }
    } catch {
      val = '';
    }
    result = result.replace(fullTag, val);
  }

  if (Buffer.byteLength(result, 'utf8') > MAX_RESULT_BYTES) {
    result = result.slice(0, MAX_RESULT_BYTES);
  }

  return result;
}

/**
 * Deeply traverses an object or array to resolve any string fields containing {{ ... }} expressions.
 */
export async function resolveConfigExpressions<T = any>(
  config: T,
  context: ExpressionContext,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  if (config === null || config === undefined) {
    return config;
  }

  if (typeof config === 'string') {
    return (await resolveTemplate(config, context, timeoutMs)) as unknown as T;
  }

  if (Array.isArray(config)) {
    const resolvedArray: any[] = [];
    for (const item of config) {
      resolvedArray.push(await resolveConfigExpressions(item, context, timeoutMs));
    }
    return resolvedArray as unknown as T;
  }

  if (typeof config === 'object') {
    const resolvedObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(config as Record<string, any>)) {
      resolvedObj[key] = await resolveConfigExpressions(val, context, timeoutMs);
    }
    return resolvedObj as unknown as T;
  }

  return config;
}
