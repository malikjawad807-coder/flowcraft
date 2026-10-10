import {
  WorkflowGraph,
  GraphNode,
  WorkflowItem,
  WorkflowExecutionResult,
  WorkflowStepResult,
  ExecutionMode,
  ExecutionStatus,
} from '@flowcart/shared';
import { getNodeDefinition, NodeExecutionContext } from '@flowcart/nodes';
import { resolveConfigExpressions, ExpressionContext } from './expressions.js';
import { validateGraph } from './validation.js';

export interface ExecutorRunOptions {
  executionId: string;
  workflowId: string;
  userId: string;
  mode?: ExecutionMode;
  initialItems?: WorkflowItem[];
  user?: { id?: string; email?: string; name?: string };
  dryRun?: boolean;
  integration?: any;
  gmailClient?: any;
  llmClient?: any;
  onStepComplete?: (step: WorkflowStepResult) => Promise<void>;
  logger?: {
    info: (msg: string, ...args: any[]) => void;
    warn: (msg: string, ...args: any[]) => void;
    error: (msg: string, ...args: any[]) => void;
  };
}

/**
 * Truncates string fields to 4000 characters before recording step logs (Section 8.1)
 */
export function truncatePayload<T = any>(val: T, maxChars = 4000): T {
  if (typeof val === 'string') {
    return (val.length > maxChars ? val.slice(0, maxChars) + '... [truncated]' : val) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => truncatePayload(item, maxChars)) as unknown as T;
  }
  if (val !== null && typeof val === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val as Record<string, any>)) {
      res[k] = truncatePayload(v, maxChars);
    }
    return res as unknown as T;
  }
  return val;
}

export class WorkflowExecutor {
  /**
   * Executes a validated workflow graph step-by-step in topological order (Section 8.5)
   */
  async execute(
    graph: WorkflowGraph,
    options: ExecutorRunOptions
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    const steps: WorkflowStepResult[] = [];
    const executionId = options.executionId;
    const workflowId = options.workflowId;
    const mode = options.mode || 'manual';

    const defaultLogger = {
      info: (msg: string) => console.log(`[INFO] ${msg}`),
      warn: (msg: string) => console.warn(`[WARN] ${msg}`),
      error: (msg: string) => console.error(`[ERROR] ${msg}`),
    };
    const logger = options.logger || defaultLogger;

    // 1. Re-validate graph structure
    const validation = validateGraph(graph);
    if (!validation.valid) {
      const errMessage = validation.errors.map((e) => e.message).join('; ');
      return {
        executionId,
        workflowId,
        mode,
        status: 'failed',
        error: `Graph validation failed: ${errMessage}`,
        steps: [],
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    }

    // Index nodes and edges
    const nodeMap = new Map<string, GraphNode>();
    for (const n of graph.nodes) {
      nodeMap.set(n.id, n);
    }

    const outgoing = new Map<string, Array<{ target: string; sourceHandle: string }>>();
    for (const n of graph.nodes) {
      outgoing.set(n.id, []);
    }
    for (const e of graph.edges) {
      outgoing.get(e.source)?.push({
        target: e.target,
        sourceHandle: e.sourceHandle || 'main',
      });
    }

    // 2. Locate Trigger Node
    const triggerNode = graph.nodes.find(
      (n) => n.type.endsWith('.trigger') || getNodeDefinition(n.type)?.category === 'trigger'
    );

    if (!triggerNode) {
      return {
        executionId,
        workflowId,
        mode,
        status: 'failed',
        error: 'Trigger node not found',
        steps: [],
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    }

    // Initial items (default or provided)
    const initialItems = options.initialItems && options.initialItems.length > 0
      ? options.initialItems
      : [{ json: { triggeredAt: startedAt, mode } }];

    // Execution queue: { nodeId: string; incomingItems: WorkflowItem[] }
    const queue: Array<{ nodeId: string; incomingItems: WorkflowItem[] }> = [
      { nodeId: triggerNode.id, incomingItems: initialItems },
    ];

    // Node output store for expression referencing: node[nodeName].json
    const nodeOutputsByName: Record<string, { json: Record<string, any> }> = {};

    let executionStatus: ExecutionStatus = 'success';
    let fatalError: string | null = null;

    // 3. Process execution queue
    while (queue.length > 0) {
      const { nodeId, incomingItems } = queue.shift()!;
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const def = getNodeDefinition(node.type);
      if (!def) {
        fatalError = `Unknown node type: ${node.type}`;
        executionStatus = 'failed';
        break;
      }

      const stepStart = Date.now();
      const stepStartedAt = new Date().toISOString();
      const nodeContext: NodeExecutionContext = {
        userId: options.userId,
        executionId,
        nodeId,
        logger,
        dryRun: options.dryRun ?? false,
        integration: options.integration,
        gmailClient: options.gmailClient,
        llmClient: options.llmClient,
      };

      // Prepare expression context
      const sampleItem = incomingItems[0] || { json: {} };
      const exprContext: ExpressionContext = {
        json: sampleItem.json,
        node: nodeOutputsByName,
        trigger: initialItems[0]?.json || {},
        user: options.user,
        now: new Date().toISOString(),
      };

      let resolvedConfig = node.config || {};
      let stepOutput: any = null;
      let stepError: string | null = null;
      let stepStatus: 'success' | 'failed' | 'waiting' = 'success';
      let runResult: Record<string, WorkflowItem[]> = {};

      try {
        // Evaluate config expressions
        resolvedConfig = await resolveConfigExpressions(node.config || {}, exprContext);

        // Execute node run function
        runResult = await def.run(nodeContext, incomingItems, resolvedConfig);
        stepOutput = runResult;

        // Save output under node name for downstream expression evaluation
        const firstOutputItem = Object.values(runResult).flat()[0];
        if (firstOutputItem) {
          nodeOutputsByName[node.name] = { json: firstOutputItem.json };
        }
      } catch (err: any) {
        stepStatus = 'failed';
        stepError = err.message || 'Execution error';
        logger.error(`Node ${node.name} (${node.id}) failed: ${stepError}`);

        if (node.settings?.onError === 'continue') {
          logger.warn(`onError=continue set for ${node.name}. Recording step failure and continuing other branches.`);
        } else {
          fatalError = stepError;
          executionStatus = 'failed';
        }
      }

      const stepDuration = Date.now() - stepStart;
      const stepFinishedAt = new Date().toISOString();

      const stepResult: WorkflowStepResult = {
        nodeId: node.id,
        nodeType: node.type,
        itemIndex: 0,
        status: stepStatus,
        input: truncatePayload(incomingItems),
        output: stepOutput ? truncatePayload(stepOutput) : null,
        error: stepError,
        attempts: 1,
        durationMs: stepDuration,
        startedAt: stepStartedAt,
        finishedAt: stepFinishedAt,
      };

      steps.push(stepResult);

      if (options.onStepComplete) {
        try {
          await options.onStepComplete(stepResult);
        } catch (dbErr) {
          logger.error(`Error saving step checkpoint:`, dbErr);
        }
      }

      // If fatal error encountered and onError=stop, halt immediately
      if (stepStatus === 'failed' && node.settings?.onError !== 'continue') {
        break;
      }

      // 4. Route output items to downstream nodes connected on matching handles
      const nodeEdges = outgoing.get(node.id) || [];
      for (const [handle, outItems] of Object.entries(runResult)) {
        if (!outItems || outItems.length === 0) continue;

        // Find edges connected to this output handle
        const matchingEdges = nodeEdges.filter((e) => e.sourceHandle === handle);
        for (const edge of matchingEdges) {
          queue.push({
            nodeId: edge.target,
            incomingItems: outItems,
          });
        }
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      executionId,
      workflowId,
      mode,
      status: executionStatus,
      error: fatalError,
      steps,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs,
    };
  }
}
