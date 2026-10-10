export * from './types.js';
export * from './logic/helpers.js';
export * from './trigger/manual-trigger.js';
export * from './trigger/gmail-trigger.js';
export * from './logic/filter.js';
export * from './logic/if.js';
export * from './logic/switch.js';
export * from './data/set.js';
export * from './util/log.js';
export * from './gmail/helpers.js';
export * from './gmail/create-draft.js';
export * from './gmail/reply.js';
export * from './gmail/add-label.js';
export * from './gmail/update.js';
export * from './ai/classify.js';
export * from './ai/agent.js';
export * from './control/approval.js';

import { manualTriggerNode } from './trigger/manual-trigger.js';
import { gmailTriggerNode } from './trigger/gmail-trigger.js';
import { logicFilterNode } from './logic/filter.js';
import { logicIfNode } from './logic/if.js';
import { logicSwitchNode } from './logic/switch.js';
import { dataSetNode } from './data/set.js';
import { utilLogNode } from './util/log.js';
import { gmailCreateDraftNode } from './gmail/create-draft.js';
import { gmailReplyNode } from './gmail/reply.js';
import { gmailAddLabelNode } from './gmail/add-label.js';
import { gmailUpdateNode } from './gmail/update.js';
import { aiClassifyNode } from './ai/classify.js';
import { aiAgentNode } from './ai/agent.js';
import { controlApprovalNode } from './control/approval.js';
import { NodeDefinition } from './types.js';

export const NODE_REGISTRY: Record<string, NodeDefinition> = {
  [manualTriggerNode.type]: manualTriggerNode,
  [gmailTriggerNode.type]: gmailTriggerNode,
  [logicFilterNode.type]: logicFilterNode,
  [logicIfNode.type]: logicIfNode,
  [logicSwitchNode.type]: logicSwitchNode,
  [dataSetNode.type]: dataSetNode,
  [utilLogNode.type]: utilLogNode,
  [gmailCreateDraftNode.type]: gmailCreateDraftNode,
  [gmailReplyNode.type]: gmailReplyNode,
  [gmailAddLabelNode.type]: gmailAddLabelNode,
  [gmailUpdateNode.type]: gmailUpdateNode,
  [aiClassifyNode.type]: aiClassifyNode,
  [aiAgentNode.type]: aiAgentNode,
  [controlApprovalNode.type]: controlApprovalNode,
};

export const NODES_CATALOGUE = NODE_REGISTRY;

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_REGISTRY[type];
}

