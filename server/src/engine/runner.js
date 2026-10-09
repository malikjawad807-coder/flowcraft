import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { NODE_HANDLERS } from './nodes.js';

/**
 * Executes a workflow graph.
 * 
 * Supports:
 * - Linear sequences and DAG topological ordering
 * - Branching logic (IF condition true/false outputs)
 * - Safe expression resolution
 * - Execution state persistence in SQLite (status, timings, node inputs/outputs, errors)
 */
export async function executeWorkflow(workflow, options = {}) {
  const executionId = uuidv4();
  const startTime = Date.now();

  const triggerType = options.triggerType || workflow.trigger_type || 'manual';
  const isTestRun = Boolean(options.isTestRun);

  // Load app settings for safety limits and templates
  const settingRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const s of settingRows) {
    settings[s.key] = s.value;
  }

  // Insert initial execution record
  const insertExecStmt = db.prepare(`
    INSERT INTO executions (id, workflow_id, workflow_name, trigger_type, status, started_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  insertExecStmt.run(executionId, workflow.id, workflow.name, triggerType, 'running');

  // Parse nodes and connections
  let nodes = [];
  let connections = [];
  try {
    nodes = typeof workflow.nodes_json === 'string' ? JSON.parse(workflow.nodes_json) : (workflow.nodes_json || []);
    connections = typeof workflow.connections_json === 'string' ? JSON.parse(workflow.connections_json) : (workflow.connections_json || []);
  } catch (err) {
    console.error('[Engine] Failed to parse workflow graph JSON:', err);
    finalizeExecution(executionId, 'error', 0, err.message, {});
    throw err;
  }

  const nodeMap = new Map();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Build adjacency graph
  // Map from sourceNodeId -> array of { targetId, sourceHandle, targetHandle }
  const adjacency = new Map();
  const inDegree = new Map();
  nodes.forEach((n) => {
    adjacency.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  connections.forEach((edge) => {
    if (adjacency.has(edge.source)) {
      adjacency.get(edge.source).push({
        targetId: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      });
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  });

  // Identify starting node(s)
  // Look for triggers first, then any 0 in-degree node
  let startNode = nodes.find(
    (n) => n.type === 'manual_trigger' || n.type === 'schedule_trigger' || n.type === 'webhook_trigger'
  );

  if (!startNode) {
    startNode = nodes.find((n) => inDegree.get(n.id) === 0);
  }

  if (!startNode && nodes.length > 0) {
    startNode = nodes[0];
  }

  const nodeResults = {};
  const queue = [];

  if (startNode) {
    queue.push({
      nodeId: startNode.id,
      inputItems: options.initialData || [],
    });
  }

  const visitedNodes = new Set();
  let executionError = null;

  const executionContext = {
    workflow,
    settings,
    nodeResults,
    executionId,
    isTestRun,
    webhookPayload: options.webhookPayload || {},
  };

  try {
    while (queue.length > 0) {
      const { nodeId, inputItems } = queue.shift();
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const nodeType = node.type;
      const handler = NODE_HANDLERS[nodeType];

      if (!handler) {
        throw new Error(`Unknown node handler type: "${nodeType}" on node "${node.data?.label || nodeId}"`);
      }

      const nodeStart = Date.now();
      console.log(`[Engine] Executing node: "${node.data?.label || nodeType}" (${nodeId})...`);

      let outputResult;
      try {
        outputResult = await handler(node, inputItems, executionContext);
      } catch (err) {
        console.error(`[Engine] Error in node "${node.data?.label || nodeId}":`, err.message);
        nodeResults[nodeId] = {
          label: node.data?.label || nodeType,
          type: nodeType,
          status: 'error',
          input: inputItems,
          output: null,
          error: err.message,
          duration_ms: Date.now() - nodeStart,
        };
        throw err;
      }

      const nodeDuration = Date.now() - nodeStart;

      // Handle branching (e.g. IF condition)
      if (outputResult && outputResult.branching) {
        nodeResults[nodeId] = {
          label: node.data?.label || nodeType,
          type: nodeType,
          status: 'success',
          input: inputItems,
          output: {
            trueBranchCount: outputResult.trueItems.length,
            falseBranchCount: outputResult.falseItems.length,
          },
          duration_ms: nodeDuration,
        };

        const outgoingEdges = adjacency.get(nodeId) || [];
        for (const edge of outgoingEdges) {
          if (edge.sourceHandle === 'false' || edge.sourceHandle === 'no') {
            queue.push({ nodeId: edge.targetId, inputItems: outputResult.falseItems });
          } else {
            // Default or true branch
            queue.push({ nodeId: edge.targetId, inputItems: outputResult.trueItems });
          }
        }
      } else {
        // Standard single output
        const outputItems = Array.isArray(outputResult) ? outputResult : [outputResult];
        nodeResults[nodeId] = {
          label: node.data?.label || nodeType,
          type: nodeType,
          status: 'success',
          input: inputItems,
          output: outputItems,
          duration_ms: nodeDuration,
        };

        const outgoingEdges = adjacency.get(nodeId) || [];
        for (const edge of outgoingEdges) {
          queue.push({ nodeId: edge.targetId, inputItems: outputItems });
        }
      }

      visitedNodes.add(nodeId);
    }
  } catch (err) {
    executionError = err.message;
  }

  const durationMs = Date.now() - startTime;
  const finalStatus = executionError ? 'error' : 'success';

  finalizeExecution(executionId, finalStatus, durationMs, executionError, nodeResults);

  // Update last_run_at on workflow
  try {
    db.prepare('UPDATE workflows SET last_run_at = CURRENT_TIMESTAMP WHERE id = ?').run(workflow.id);
  } catch (err) {
    console.error('[Engine] Failed to update workflow last_run_at:', err);
  }

  return {
    executionId,
    workflowId: workflow.id,
    status: finalStatus,
    durationMs,
    error: executionError,
    nodeResults,
  };
}

function finalizeExecution(executionId, status, durationMs, error, nodeResults) {
  try {
    db.prepare(`
      UPDATE executions 
      SET 
        status = ?,
        finished_at = CURRENT_TIMESTAMP,
        duration_ms = ?,
        error = ?,
        node_results_json = ?
      WHERE id = ?
    `).run(
      status,
      durationMs,
      error || null,
      JSON.stringify(nodeResults || {}),
      executionId
    );
  } catch (err) {
    console.error('[Engine] Failed to finalize execution record:', err);
  }
}
