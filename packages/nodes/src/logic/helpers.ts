import { ConditionRule } from '../types.js';

function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (!path) return undefined;
  // If path starts with json., strip it
  const cleanPath = path.startsWith('json.') ? path.slice(5) : path;
  const parts = cleanPath.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

export function evaluateCondition(itemJson: Record<string, any>, rule: ConditionRule): boolean {
  const actualVal = getNestedValue(itemJson, rule.field);
  const targetVal = rule.value;

  switch (rule.op) {
    case 'equals':
      return String(actualVal ?? '').trim().toLowerCase() === String(targetVal ?? '').trim().toLowerCase();

    case 'not_equals':
      return String(actualVal ?? '').trim().toLowerCase() !== String(targetVal ?? '').trim().toLowerCase();

    case 'contains':
      return String(actualVal ?? '').toLowerCase().includes(String(targetVal ?? '').toLowerCase());

    case 'not_contains':
      return !String(actualVal ?? '').toLowerCase().includes(String(targetVal ?? '').toLowerCase());

    case 'starts_with':
      return String(actualVal ?? '').toLowerCase().startsWith(String(targetVal ?? '').toLowerCase());

    case 'ends_with':
      return String(actualVal ?? '').toLowerCase().endsWith(String(targetVal ?? '').toLowerCase());

    case 'matches_regex': {
      try {
        const patternStr = String(targetVal ?? '');
        if (patternStr.length > 200) return false; // Prevent gigantic catastrophic patterns
        const regex = new RegExp(patternStr, 'i');
        return regex.test(String(actualVal ?? ''));
      } catch {
        return false;
      }
    }

    case 'is_empty':
      return actualVal === null || actualVal === undefined || String(actualVal).trim() === '';

    case 'not_empty':
      return actualVal !== null && actualVal !== undefined && String(actualVal).trim() !== '';

    case 'greater_than': {
      const numActual = Number(actualVal);
      const numTarget = Number(targetVal);
      if (isNaN(numActual) || isNaN(numTarget)) return false;
      return numActual > numTarget;
    }

    case 'less_than': {
      const numActual = Number(actualVal);
      const numTarget = Number(targetVal);
      if (isNaN(numActual) || isNaN(numTarget)) return false;
      return numActual < numTarget;
    }

    default:
      return false;
  }
}

export function evaluateRuleSet(
  itemJson: Record<string, any>,
  combinator: 'and' | 'or',
  conditions: ConditionRule[]
): boolean {
  if (!conditions || conditions.length === 0) return true;

  if (combinator === 'and') {
    return conditions.every((rule) => evaluateCondition(itemJson, rule));
  } else {
    return conditions.some((rule) => evaluateCondition(itemJson, rule));
  }
}
