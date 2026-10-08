import {
  WorkflowExecutionLog,
  WorkflowExecutionResult,
  WorkflowNodeData,
} from '@/types/workflow';

// Helper to extract nested properties: get(obj, 'a.b.c') or get(obj, 'a[0].b')
export function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

// Resolve template string like "Hello {{input_form.name}}, status is {{openai_llm.status}}"
export function resolveTemplateVariables(template: string, context: Record<string, any>): string {
  if (!template || typeof template !== 'string') return template || '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_$.\[\]]+)\s*\}\}/g, (match, path) => {
    // 1. Direct path in context
    const directVal = getNestedValue(context, path);
    if (directVal !== undefined) {
      return typeof directVal === 'object' ? JSON.stringify(directVal, null, 2) : String(directVal);
    }

    // 2. Try prefix matching if node name or id is used
    for (const [key, val] of Object.entries(context)) {
      if (path.startsWith(`${key}.`)) {
        const subPath = path.substring(key.length + 1);
        const subVal = getNestedValue(val, subPath);
        if (subVal !== undefined) {
          return typeof subVal === 'object' ? JSON.stringify(subVal, null, 2) : String(subVal);
        }
      }
    }

    // Return original if unresolved
    return match;
  });
}

// Topological sort to determine node execution order
export function getExecutionOrder(nodes: any[], edges: any[]): string[] {
  const inDegree: Record<string, number> = {};
  const adjList: Record<string, string[]> = {};

  nodes.forEach((n) => {
    inDegree[n.id] = 0;
    adjList[n.id] = [];
  });

  edges.forEach((e) => {
    if (adjList[e.source]) {
      adjList[e.source].push(e.target);
    }
    if (inDegree[e.target] !== undefined) {
      inDegree[e.target]++;
    }
  });

  // Start with nodes that have in-degree 0 (Triggers or independent nodes)
  const queue: string[] = nodes
    .filter((n) => inDegree[n.id] === 0)
    .map((n) => n.id);

  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    const neighbors = adjList[current] || [];
    for (const next of neighbors) {
      inDegree[next]--;
      if (inDegree[next] === 0) {
        queue.push(next);
      }
    }
  }

  // If there are unvisited nodes (e.g. disconnected nodes or cycles), append remaining
  nodes.forEach((n) => {
    if (!order.includes(n.id)) {
      order.push(n.id);
    }
  });

  return order;
}

// Client/Server mock execution helper for OpenAI when API key is absent or in demo mode
export function simulateOpenAiOutput(
  prompt: string,
  systemPrompt: string,
  model: string,
  inputData: any
): string {
  const pLower = prompt.toLowerCase();
  
  if (pLower.includes('sentiment') || pLower.includes('classify') || pLower.includes('category')) {
    return JSON.stringify(
      {
        classification: 'High Priority',
        sentiment: 'Constructive / Positive',
        confidenceScore: 0.94,
        keyInsights: [
          'User is deeply engaged with workflow automation',
          'Immediate action recommended for customer delight'
        ],
        suggestedDepartment: 'Customer Success / Solutions Engineering',
      },
      null,
      2
    );
  }

  if (pLower.includes('summar') || pLower.includes('extract') || pLower.includes('resume')) {
    return JSON.stringify(
      {
        summary: 'Candidate demonstrates strong technical expertise in modern full-stack systems, API integrations, and cloud orchestration.',
        candidateEvaluation: {
          matchScore: 92,
          strengths: ['Next.js App Router', 'TypeScript', 'React Flow', 'AI Integration'],
          recommendation: 'Proceed to Technical Interview'
        },
        executiveSummary: 'High-caliber profile with demonstrable problem-solving capacity.'
      },
      null,
      2
    );
  }

  if (pLower.includes('email') || pLower.includes('reply') || pLower.includes('draft') || pLower.includes('respond')) {
    const name = inputData?.name || inputData?.sender || inputData?.contactName || 'Valued Partner';
    return `Hi ${name},\n\nThank you for reaching out! We have processed your submission through our automated workflow.\n\nOur team has reviewed your details and we are thrilled to move forward. We will be sending over the next steps shortly.\n\nPlease let us know if you have any questions in the meantime.\n\nBest regards,\nAutomated Workflow Engine`;
  }

  return `[OpenAI ${model} Response]\nProcessed Prompt: "${prompt.slice(0, 80)}..."\n\nBased on the workflow context and input data (${JSON.stringify(inputData ? Object.keys(inputData) : []).slice(0, 40)}), the request was evaluated successfully with optimal completion tokens.`;
}
