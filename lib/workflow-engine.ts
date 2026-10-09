import {
  RecipientRecord,
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

// Check email validity
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Parse CSV content or line-separated text into structured RecipientRecords
export function parseCsvToRecipients(
  rawText: string,
  columnMap: { email?: string; name?: string; company?: string; role?: string } = {}
): {
  recipients: RecipientRecord[];
  totalCount: number;
  validCount: number;
  invalidCount: number;
} {
  if (!rawText || typeof rawText !== 'string') {
    return { recipients: [], totalCount: 0, validCount: 0, invalidCount: 0 };
  }

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { recipients: [], totalCount: 0, validCount: 0, invalidCount: 0 };
  }

  // 1. Detect if line 0 is a header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes('email') ||
    firstLine.includes('name') ||
    firstLine.includes('company') ||
    firstLine.includes('@') === false;

  const headerCols = hasHeader
    ? lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase())
    : [];

  const dataRows = hasHeader ? lines.slice(1) : lines;

  // Identify column indices
  let emailIdx = -1;
  let nameIdx = -1;
  let companyIdx = -1;
  let roleIdx = -1;

  if (hasHeader) {
    headerCols.forEach((col, idx) => {
      if (col === (columnMap.email || 'email') || col.includes('email') || col.includes('mail')) {
        emailIdx = idx;
      } else if (col === (columnMap.name || 'name') || col.includes('name') || col.includes('contact')) {
        nameIdx = idx;
      } else if (col === (columnMap.company || 'company') || col.includes('company') || col.includes('org')) {
        companyIdx = idx;
      } else if (col === (columnMap.role || 'role') || col.includes('role') || col.includes('title')) {
        roleIdx = idx;
      }
    });
  }

  const recipients: RecipientRecord[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const row of dataRows) {
    const cols = row.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    let email = '';
    let name = '';
    let company = '';
    let role = '';

    if (hasHeader && emailIdx !== -1) {
      email = cols[emailIdx] || '';
      name = nameIdx !== -1 ? cols[nameIdx] || '' : '';
      company = companyIdx !== -1 ? cols[companyIdx] || '' : '';
      role = roleIdx !== -1 ? cols[roleIdx] || '' : '';
    } else {
      // Find the first column containing an '@'
      for (let i = 0; i < cols.length; i++) {
        if (cols[i].includes('@')) {
          email = cols[i];
          name = cols[i === 0 ? 1 : 0] || '';
          company = cols[2] || '';
          break;
        }
      }
      if (!email && cols[0]) {
        email = cols[0];
      }
    }

    const isValid = isValidEmail(email);
    if (isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    recipients.push({
      email,
      name: name || undefined,
      company: company || undefined,
      role: role || undefined,
      isValid,
    });
  }

  return {
    recipients,
    totalCount: recipients.length,
    validCount,
    invalidCount,
  };
}

// Resolve template string like "Hello {{item.name}}, status is {{openai_llm.status}}"
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

  // If prompt is personalizing an email to a recipient
  if (inputData?.item || inputData?.name || inputData?.company || pLower.includes('personalized')) {
    const name = inputData?.item?.name || inputData?.name || 'Partner';
    const company = inputData?.item?.company || inputData?.company || 'your organization';
    const role = inputData?.item?.role || 'Leader';

    return `Hi ${name},\n\nI was researching innovative workflows at ${company} and was impressed by your team's initiatives in automation.\n\nAt FlowCraft, we help forward-thinking teams connect their data pipelines, LLM reasoning, and Gmail dispatches into seamless visual automations.\n\nWould you be open to a 5-minute chat next Tuesday to explore how this could accelerate workflows at ${company}?\n\nBest regards,\nJordan Lee\nSolutions Architect, FlowCraft`;
  }

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
