/**
 * Safe expression evaluator for FlowCart.
 * Resolves expressions such as:
 * - {{ $json.email }}
 * - {{ $json.name }}
 * - {{ $('Get Leads').item.json.business }}
 * - {{ lead.email }}
 * - {{ settings.unsubscribe_text }}
 * 
 * Strict rule: NEVER uses eval() or Function(). Safe object path traversal only.
 */

export function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.trim().split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

export function evaluateExpression(template, context) {
  if (typeof template !== 'string') return template;

  // Regex matches {{ ... }}
  const exprRegex = /\{\{\s*([^{}]+?)\s*\}\}/g;

  return template.replace(exprRegex, (match, rawExpr) => {
    const expr = rawExpr.trim();

    // 1. Check for node reference: $('Node Name').item.json.field or $('Node Name').field
    const nodeRefMatch = expr.match(/^\$\(['"]([^'"]+)['"]\)(?:\.item)?(?:\.json)?\.(.+)$/);
    if (nodeRefMatch) {
      const nodeName = nodeRefMatch[1];
      const propertyPath = nodeRefMatch[2];
      if (context.nodeResults && context.nodeResults[nodeName]) {
        const nodeOutput = context.nodeResults[nodeName].output;
        if (Array.isArray(nodeOutput) && nodeOutput.length > 0) {
          const itemData = nodeOutput[context.itemIndex || 0]?.json || nodeOutput[0]?.json || nodeOutput[0];
          const val = resolvePath(itemData, propertyPath);
          if (val !== undefined) return String(val);
        } else if (nodeOutput && typeof nodeOutput === 'object') {
          const val = resolvePath(nodeOutput.json || nodeOutput, propertyPath);
          if (val !== undefined) return String(val);
        }
      }
      return '';
    }

    // 2. Direct $json.property or lead.property
    if (expr.startsWith('$json.')) {
      const path = expr.replace('$json.', '');
      const val = resolvePath(context.item?.json || context.item, path);
      return val !== undefined ? String(val) : '';
    }

    if (expr.startsWith('lead.')) {
      const path = expr.replace('lead.', '');
      const val = resolvePath(context.item?.json || context.item, path);
      return val !== undefined ? String(val) : '';
    }

    if (expr.startsWith('settings.')) {
      const path = expr.replace('settings.', '');
      const val = resolvePath(context.settings, path);
      return val !== undefined ? String(val) : '';
    }

    // 3. Fallback to direct key on context.item.json or context.item
    const directVal = resolvePath(context.item?.json || context.item, expr);
    if (directVal !== undefined) return String(directVal);

    return '';
  });
}

/**
 * Resolves all string fields in an object using evaluateExpression
 */
export function resolveObjectExpressions(obj, context) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => resolveObjectExpressions(item, context));
  }
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = evaluateExpression(value, context);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = resolveObjectExpressions(value, context);
    } else {
      result[key] = value;
    }
  }
  return result;
}
