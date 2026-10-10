import { WorkflowGraph, GraphNode } from '@flowcart/shared';
import { getNodeDefinition } from '@flowcart/nodes';

export interface ValidationError {
  nodeId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationOptions {
  isActivating?: boolean;
  autoSendEnabled?: boolean;
}

/**
 * Validates a workflow graph according to FlowCart v2 Section 8.3 rules.
 */
export function validateGraph(
  graph: WorkflowGraph,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return {
      valid: false,
      errors: [{ message: 'Graph must contain nodes and edges arrays' }],
    };
  }

  const { nodes, edges } = graph;

  // 1. Maximum 40 nodes
  if (nodes.length > 40) {
    errors.push({
      message: `Workflow exceeds the maximum limit of 40 nodes (currently ${nodes.length})`,
    });
  }

  if (nodes.length === 0) {
    return {
      valid: false,
      errors: [{ message: 'Workflow must have at least one node' }],
    };
  }

  // Node lookup map
  const nodeMap = new Map<string, GraphNode>();
  const nameSet = new Set<string>();

  let triggerCount = 0;
  let triggerNode: GraphNode | null = null;

  for (const node of nodes) {
    // Unique ID check
    if (nodeMap.has(node.id)) {
      errors.push({
        nodeId: node.id,
        message: `Duplicate node ID: ${node.id}`,
      });
    }
    nodeMap.set(node.id, node);

    // Node names must be unique within the workflow (Section 8.3)
    if (nameSet.has(node.name.toLowerCase())) {
      errors.push({
        nodeId: node.id,
        message: `Duplicate node name: "${node.name}". Node names must be unique within a workflow.`,
      });
    }
    nameSet.add(node.name.toLowerCase());

    const def = getNodeDefinition(node.type);
    const isTrigger = def ? def.category === 'trigger' : node.type.endsWith('.trigger');
    if (isTrigger) {
      triggerCount++;
      triggerNode = node;
    }

    // Config validation against Zod schema
    if (def && def.configSchema) {
      const parsed = def.configSchema.safeParse(node.config || {});
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({
            nodeId: node.id,
            message: `Configuration error in ${node.name}: ${issue.path.join('.') || 'config'} - ${issue.message}`,
          });
        }
      }
    }
  }

  // 2. Exactly one trigger node
  if (triggerCount === 0) {
    errors.push({
      message: 'Workflow must have exactly one trigger node (e.g., manual.trigger or gmail.trigger)',
    });
  } else if (triggerCount > 1) {
    errors.push({
      message: `Workflow must have exactly one trigger node, but found ${triggerCount}`,
    });
  }

  // Build incoming & outgoing adjacency lists
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, Array<{ target: string; sourceHandle?: string }>>();

  for (const node of nodes) {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeMap.has(edge.source)) {
      errors.push({
        message: `Edge references non-existent source node: ${edge.source}`,
      });
      continue;
    }
    if (!nodeMap.has(edge.target)) {
      errors.push({
        message: `Edge references non-existent target node: ${edge.target}`,
      });
      continue;
    }

    incoming.get(edge.target)!.push(edge.source);
    outgoing.get(edge.source)!.push({
      target: edge.target,
      sourceHandle: edge.sourceHandle || 'main',
    });

    // Verify source handle exists on source node definition
    const srcDef = getNodeDefinition(nodeMap.get(edge.source)!.type);
    if (srcDef && srcDef.outputs && srcDef.outputs.length > 0) {
      const handle = edge.sourceHandle || 'main';
      if (!srcDef.outputs.includes(handle) && !srcDef.outputs.includes('fallback')) {
        errors.push({
          nodeId: edge.source,
          message: `Source handle "${handle}" does not exist on node type "${srcDef.type}"`,
        });
      }
    }
  }

  // 3. Every non-trigger node has exactly one incoming edge (no merging in v2)
  for (const node of nodes) {
    const def = getNodeDefinition(node.type);
    const isTrigger = def ? def.category === 'trigger' : node.type.endsWith('.trigger');
    const inCount = incoming.get(node.id)?.length ?? 0;

    if (isTrigger) {
      if (inCount > 0) {
        errors.push({
          nodeId: node.id,
          message: `Trigger node "${node.name}" cannot have incoming connections`,
        });
      }
    } else {
      if (inCount === 0) {
        errors.push({
          nodeId: node.id,
          message: `Node "${node.name}" is disconnected and has no incoming connection`,
        });
      } else if (inCount > 1) {
        errors.push({
          nodeId: node.id,
          message: `Node "${node.name}" has ${inCount} incoming connections. FlowCart v2 requires exactly one incoming connection per non-trigger node (no merging).`,
        });
      }
    }
  }

  // 4. Cycle detection (DAG verification) using Kahn's algorithm
  const inDegree = new Map<string, number>();
  for (const [id, inc] of incoming.entries()) {
    inDegree.set(id, inc.length);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    visitedCount++;

    const neighbors = outgoing.get(curr) || [];
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor.target) || 0) - 1;
      inDegree.set(neighbor.target, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor.target);
      }
    }
  }

  if (visitedCount < nodes.length) {
    errors.push({
      message: 'Workflow contains a cycle or loop. FlowCart v2 workflows must be directed acyclic graphs (DAGs).',
    });
  }

  // 5. Strict activation check (auto-send / approval upstream check)
  if (options.isActivating) {
    for (const node of nodes) {
      if (node.type === 'gmail.reply' && node.config?.mode === 'send' && !options.autoSendEnabled) {
        // Must have control.approval somewhere upstream
        let hasApprovalUpstream = false;
        let currId: string | undefined = node.id;
        while (currId) {
          const parents = incoming.get(currId);
          if (!parents || parents.length === 0) break;
          const parentNode = nodeMap.get(parents[0]);
          if (parentNode && parentNode.type === 'control.approval') {
            hasApprovalUpstream = true;
            break;
          }
          currId = parents[0];
        }

        if (!hasApprovalUpstream) {
          errors.push({
            nodeId: node.id,
            message: `gmail.reply in "send" mode requires a control.approval node upstream unless Auto-Send is enabled in Settings.`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
