import { describe, it, expect } from 'vitest';
import { validateGraph } from './validation.js';
import { WorkflowExecutor, truncatePayload } from './executor.js';
import { WorkflowGraph } from '@flowcart/shared';

describe('Workflow Graph Validation (Section 8.3)', () => {
  it('validates a valid DAG with 1 trigger and branching logic', () => {
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: 'n1',
          type: 'manual.trigger',
          name: 'Manual Trigger',
          position: { x: 0, y: 0 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
        {
          id: 'n2',
          type: 'logic.if',
          name: 'Check Status',
          position: { x: 200, y: 0 },
          config: {
            combinator: 'and',
            conditions: [{ field: 'isVip', op: 'equals', value: true }],
          },
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
        {
          id: 'n3',
          type: 'data.set',
          name: 'Set VIP Priority',
          position: { x: 400, y: -50 },
          config: { fields: [{ name: 'priority', value: 'high' }], keepOthers: true },
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
      ],
      edges: [
        { id: 'e1', source: 'n1', sourceHandle: 'main', target: 'n2' },
        { id: 'e2', source: 'n2', sourceHandle: 'true', target: 'n3' },
      ],
    };

    const res = validateGraph(graph);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects graphs with cycles', () => {
    const cyclicGraph: WorkflowGraph = {
      nodes: [
        {
          id: 'n1',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
        {
          id: 'n2',
          type: 'data.set',
          name: 'Node A',
          position: { x: 200, y: 0 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
        {
          id: 'n3',
          type: 'data.set',
          name: 'Node B',
          position: { x: 400, y: 0 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
      ],
      edges: [
        { id: 'e1', source: 'n1', sourceHandle: 'main', target: 'n2' },
        { id: 'e2', source: 'n2', sourceHandle: 'main', target: 'n3' },
        { id: 'e3', source: 'n3', sourceHandle: 'main', target: 'n2' }, // Cycle
      ],
    };

    const res = validateGraph(cyclicGraph);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('cycle'))).toBe(true);
  });

  it('rejects multiple trigger nodes', () => {
    const multiTriggerGraph: WorkflowGraph = {
      nodes: [
        {
          id: 'n1',
          type: 'manual.trigger',
          name: 'Trigger 1',
          position: { x: 0, y: 0 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
        {
          id: 'n2',
          type: 'manual.trigger',
          name: 'Trigger 2',
          position: { x: 0, y: 100 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
      ],
      edges: [],
    };

    const res = validateGraph(multiTriggerGraph);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('exactly one trigger'))).toBe(true);
  });

  it('rejects duplicate node names', () => {
    const dupNameGraph: WorkflowGraph = {
      nodes: [
        {
          id: 'n1',
          type: 'manual.trigger',
          name: 'Start Node',
          position: { x: 0, y: 0 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
        {
          id: 'n2',
          type: 'data.set',
          name: 'start node', // Case-insensitive duplicate
          position: { x: 200, y: 0 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
      ],
      edges: [{ id: 'e1', source: 'n1', sourceHandle: 'main', target: 'n2' }],
    };

    const res = validateGraph(dupNameGraph);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes('Duplicate node name'))).toBe(true);
  });
});

describe('Workflow Execution Engine (Section 8.5)', () => {
  const executor = new WorkflowExecutor();

  it('executes a linear flow and propagates expressions', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: 'trigger',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
        {
          id: 'setter',
          type: 'data.set',
          name: 'Enrich Item',
          position: { x: 200, y: 0 },
          config: {
            fields: [
              { name: 'authorEmail', value: '{{ json.sender.email }}' },
              { name: 'processedBy', value: 'FlowCart Engine v2' },
            ],
            keepOthers: true,
          },
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', sourceHandle: 'main', target: 'setter' },
      ],
    };

    const initialItems = [
      {
        json: {
          id: 'item_1',
          sender: { email: 'alice@wonderland.io' },
        },
      },
    ];

    const result = await executor.execute(graph, {
      executionId: 'exec_linear_1',
      workflowId: 'wf_1',
      userId: 'usr_1',
      mode: 'test',
      initialItems,
    });

    expect(result.status).toBe('success');
    expect(result.steps).toHaveLength(2);

    const enrichStep = result.steps.find((s) => s.nodeId === 'setter');
    expect(enrichStep?.status).toBe('success');
    expect(enrichStep?.output.main[0].json.authorEmail).toBe('alice@wonderland.io');
    expect(enrichStep?.output.main[0].json.processedBy).toBe('FlowCart Engine v2');
  });

  it('routes items to true branch on logic.if condition', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: 'trigger',
          type: 'manual.trigger',
          name: 'Trigger',
          position: { x: 0, y: 0 },
          config: {},
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
        {
          id: 'branch',
          type: 'logic.if',
          name: 'Check Amount',
          position: { x: 200, y: 0 },
          config: {
            combinator: 'and',
            conditions: [{ field: 'amount', op: 'greater_than', value: 100 }],
          },
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
        {
          id: 'trueNode',
          type: 'data.set',
          name: 'Mark Big Deal',
          position: { x: 400, y: -50 },
          config: {
            fields: [{ name: 'isBigDeal', value: true }],
            keepOthers: true,
          },
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
        {
          id: 'falseNode',
          type: 'data.set',
          name: 'Mark Standard Deal',
          position: { x: 400, y: 50 },
          config: {
            fields: [{ name: 'isBigDeal', value: false }],
            keepOthers: true,
          },
          settings: { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', sourceHandle: 'main', target: 'branch' },
        { id: 'e2', source: 'branch', sourceHandle: 'true', target: 'trueNode' },
        { id: 'e3', source: 'branch', sourceHandle: 'false', target: 'falseNode' },
      ],
    };

    const initialItems = [{ json: { deal: 'Alpha', amount: 500 } }];

    const result = await executor.execute(graph, {
      executionId: 'exec_branch_1',
      workflowId: 'wf_2',
      userId: 'usr_1',
      mode: 'test',
      initialItems,
    });

    expect(result.status).toBe('success');
    const executedNodeIds = result.steps.map((s) => s.nodeId);
    expect(executedNodeIds).toContain('trigger');
    expect(executedNodeIds).toContain('branch');
    expect(executedNodeIds).toContain('trueNode');
    expect(executedNodeIds).not.toContain('falseNode'); // False branch not taken
  });

  it('truncates strings over 4000 characters in step output payloads', () => {
    const longString = 'A'.repeat(5000);
    const payload = {
      content: longString,
      short: 'hello',
    };

    const truncated = truncatePayload(payload, 4000);
    expect(truncated.content.length).toBeLessThan(4050);
    expect(truncated.content).toContain('... [truncated]');
    expect(truncated.short).toBe('hello');
  });
});
