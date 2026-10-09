import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  Play, Save, ArrowLeft, Plus, Check, AlertCircle, Clock,
  Mail, Database, Filter, Sliders, Cpu, Pause, Send,
  UserCheck, ShieldAlert, Sparkles, X, ChevronRight, Copy, CheckCircle2,
  Trash2, RefreshCw, MessageSquare, Bot, Key, RotateCcw,
  Maximize2, ZoomIn, ZoomOut, Wand2, Zap, MoreHorizontal, ChevronDown
} from 'lucide-react';

// -------------------------------------------------------------
// Node Library Definition for Palette
// -------------------------------------------------------------
const NODE_PALETTE = [
  {
    category: 'Triggers',
    nodes: [
      { type: 'triggerNode', subType: 'manual_trigger', label: 'When chat message received', icon: MessageSquare, isTrigger: true },
      { type: 'triggerNode', subType: 'schedule_trigger', label: 'Schedule Trigger', icon: Clock, isTrigger: true },
      { type: 'triggerNode', subType: 'webhook_trigger', label: 'Webhook Trigger', icon: Mail, isTrigger: true },
    ],
  },
  {
    category: 'AI & Agents',
    nodes: [
      { type: 'actionNode', subType: 'ai_agent', label: 'AI Agent', icon: Bot, isAgent: true },
      { type: 'subNode', subType: 'openai_model', label: 'OpenAI Chat Model', icon: Sparkles, isSubNode: true },
      { type: 'actionNode', subType: 'ai_write_email', label: 'AI Write Email', icon: Sparkles, isAgent: true },
    ],
  },
  {
    category: 'Data & Loops',
    nodes: [
      { type: 'actionNode', subType: 'get_leads', label: 'Get Leads', icon: Database },
      { type: 'actionNode', subType: 'limit', label: 'Limit', icon: Filter },
      { type: 'actionNode', subType: 'loop_over_items', label: 'Loop Over Items', icon: RefreshCw },
    ],
  },
  {
    category: 'Logic & Transforms',
    nodes: [
      { type: 'actionNode', subType: 'if_condition', label: 'IF Condition', icon: Sliders },
      { type: 'actionNode', subType: 'edit_fields', label: 'Edit Fields (Set)', icon: Cpu },
      { type: 'actionNode', subType: 'wait', label: 'Wait Delay', icon: Pause },
    ],
  },
  {
    category: 'Email & Actions',
    nodes: [
      { type: 'actionNode', subType: 'send_email', label: 'Send Email', icon: Send },
      { type: 'subNode', subType: 'smtp_vault', label: 'SMTP Credential Vault', icon: Key, isSubNode: true },
      { type: 'actionNode', subType: 'update_lead', label: 'Update Lead', icon: UserCheck },
      { type: 'actionNode', subType: 'stop_and_error', label: 'Stop and Error', icon: ShieldAlert },
    ],
  },
];

// -------------------------------------------------------------
// 1. TRIGGER NODE COMPONENT (Matches Reference: Rounded square with ⚡)
// -------------------------------------------------------------
function TriggerNodeComponent({ id, data, selected }) {
  const Icon = data.icon || MessageSquare;
  const status = data.runStatus || 'idle';

  return (
    <div className="flex flex-col items-center group select-none">
      <div
        className={`w-20 h-20 rounded-2xl bg-[#1e2026] border transition-all flex items-center justify-center relative shadow-2xl ${
          selected
            ? 'border-[#ff6d5a] ring-2 ring-[#ff6d5a]/30'
            : 'border-[#32353e] hover:border-[#4b4f5d]'
        }`}
      >
        {/* Amber Lightning Bolt Badge on left border */}
        <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#f59e0b] flex items-center justify-center shadow-lg border border-[#1e2026]">
          <Zap className="w-3 h-3 text-black fill-black" />
        </div>

        {/* Center Icon */}
        <Icon className="w-8 h-8 text-white stroke-[1.75]" />

        {/* Status Indicator */}
        {status === 'running' && (
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f59e0b] animate-ping" />
        )}
        {status === 'success' && (
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#10B981]" />
        )}
        {status === 'error' && (
          <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444]" />
        )}

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-[#8c90a0] !border-2 !border-[#1e2026] !-right-1.5 hover:!bg-[#ff6d5a] hover:!scale-125 transition-all"
        />
      </div>

      {/* Label Underneath Node (Authentic n8n Style) */}
      <span className="text-[12px] text-white font-medium text-center mt-2.5 max-w-[140px] leading-tight">
        {data.label || 'Trigger'}
      </span>
    </div>
  );
}

// -------------------------------------------------------------
// 2. MAIN ACTION / AGENT NODE COMPONENT (Matches Reference: AI Agent)
// -------------------------------------------------------------
function ActionNodeComponent({ id, data, selected }) {
  const Icon = data.icon || Bot;
  const status = data.runStatus || 'idle';
  const isAgent = data.isAgent || data.subType === 'ai_agent' || data.subType === 'ai_write_email';
  const isIf = data.subType === 'if_condition';

  return (
    <div className="flex flex-col items-center group select-none">
      <div
        className={`w-60 bg-[#1e2026] border rounded-2xl p-3.5 transition-all relative shadow-2xl ${
          selected
            ? 'border-[#ff6d5a] ring-2 ring-[#ff6d5a]/30'
            : 'border-[#32353e] hover:border-[#4b4f5d]'
        }`}
      >
        {/* Input Handle on left */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-[#8c90a0] !border-2 !border-[#1e2026] !-left-1.5 hover:!bg-[#ff6d5a] hover:!scale-125 transition-all"
        />

        {/* Node Content */}
        <div className="flex items-center gap-3">
          {/* Rounded Icon Box */}
          <div className="w-10 h-10 rounded-xl bg-[#2a2d36] border border-[#3b3e49] flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-white stroke-[1.75]" />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-[13px] font-bold text-white tracking-wide truncate">
              {data.label || 'Action'}
            </h4>
            <p className="text-[10px] text-[#8c90a0] truncate mt-0.5 font-mono">
              {data.subType || data.type}
            </p>
          </div>

          {/* Status Dot */}
          <div className="shrink-0">
            {status === 'running' && (
              <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] animate-ping" />
            )}
            {status === 'success' && (
              <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" title="Succeeded" />
            )}
            {status === 'error' && (
              <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" title="Failed" />
            )}
            {status === 'idle' && (
              <div className="w-2 h-2 rounded-full bg-[#444754]" />
            )}
          </div>
        </div>

        {/* Output Handle on right with floating '+' button */}
        {!isIf ? (
          <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 flex items-center">
            <Handle
              type="source"
              position={Position.Right}
              className="!w-3 !h-3 !bg-[#8c90a0] !border-2 !border-[#1e2026] !relative !right-0 hover:!bg-[#ff6d5a] hover:!scale-125 transition-all"
            />
            <div className="w-4 h-4 rounded-full bg-[#2a2d36] border border-[#3b3e49] text-[#8c90a0] hover:text-white hover:bg-[#ff6d5a] hover:border-[#ff6d5a] flex items-center justify-center ml-1 text-[11px] cursor-pointer transition-colors shadow-md">
              +
            </div>
          </div>
        ) : (
          <>
            {/* IF node has True and False branch handles */}
            <div className="absolute right-0 top-[28%] translate-x-1/2 flex items-center">
              <span className="text-[9px] text-[#10B981] font-bold mr-1 font-mono">T</span>
              <Handle
                id="true"
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-[#10B981] !border-2 !border-[#1e2026] !-right-1.5"
              />
            </div>
            <div className="absolute right-0 top-[72%] translate-x-1/2 flex items-center">
              <span className="text-[9px] text-[#EF4444] font-bold mr-1 font-mono">F</span>
              <Handle
                id="false"
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-[#EF4444] !border-2 !border-[#1e2026] !-right-1.5"
              />
            </div>
          </>
        )}

        {/* Bottom Sub-Handles (Sub-Node Ports: Chat Model*, Memory, Tool) */}
        {isAgent && (
          <div className="mt-3 pt-2.5 border-t border-[#2d303a] flex items-center justify-around text-[10px] text-[#8c90a0]">
            {/* Chat Model Port */}
            <div className="flex flex-col items-center relative">
              <Handle
                id="model"
                type="target"
                position={Position.Bottom}
                className="!w-2.5 !h-2.5 !bg-[#8c90a0] !border-2 !border-[#1e2026] !rotate-45 !-bottom-2.5 hover:!bg-[#ff6d5a]"
              />
              <span className="mt-1 text-[10px]">
                Chat Model<span className="text-[#ea4b71]">*</span>
              </span>
            </div>

            {/* Memory Port */}
            <div className="flex flex-col items-center relative">
              <Handle
                id="memory"
                type="target"
                position={Position.Bottom}
                className="!w-2.5 !h-2.5 !bg-[#8c90a0] !border-2 !border-[#1e2026] !rotate-45 !-bottom-2.5 hover:!bg-[#ff6d5a]"
              />
              <span className="mt-1 text-[10px]">Memory</span>
              <div className="w-3.5 h-3.5 rounded-full bg-[#2a2d36] border border-[#3b3e49] text-[#8c90a0] hover:text-white flex items-center justify-center text-[9px] mt-0.5 cursor-pointer">
                +
              </div>
            </div>

            {/* Tool Port */}
            <div className="flex flex-col items-center relative">
              <Handle
                id="tool"
                type="target"
                position={Position.Bottom}
                className="!w-2.5 !h-2.5 !bg-[#8c90a0] !border-2 !border-[#1e2026] !rotate-45 !-bottom-2.5 hover:!bg-[#ff6d5a]"
              />
              <span className="mt-1 text-[10px]">Tool</span>
              <div className="w-3.5 h-3.5 rounded-full bg-[#2a2d36] border border-[#3b3e49] text-[#8c90a0] hover:text-white flex items-center justify-center text-[9px] mt-0.5 cursor-pointer">
                +
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 3. SUB-NODE COMPONENT (Matches Reference: Circular OpenAI Chat Model)
// -------------------------------------------------------------
function SubNodeComponent({ id, data, selected }) {
  const Icon = data.icon || Sparkles;

  return (
    <div className="flex flex-col items-center group select-none">
      {/* Top Handle Port with "Model" label */}
      <span className="text-[10px] text-[#8c90a0] mb-1 font-mono">
        {data.subType === 'smtp_vault' ? 'Credential' : 'Model'}
      </span>

      <div
        className={`w-14 h-14 rounded-full bg-[#1e2026] border transition-all flex items-center justify-center relative shadow-2xl ${
          selected
            ? 'border-[#ff6d5a] ring-2 ring-[#ff6d5a]/30'
            : 'border-[#32353e] hover:border-[#4b4f5d]'
        }`}
      >
        {/* Top Source Handle */}
        <Handle
          type="source"
          position={Position.Top}
          className="!w-2.5 !h-2.5 !bg-[#8c90a0] !border-2 !border-[#1e2026] !-top-1.5 hover:!bg-[#ff6d5a] hover:!scale-125 transition-all"
        />

        {/* Center Logo Icon */}
        <Icon className="w-6 h-6 text-white" />
      </div>

      {/* Label Underneath Node */}
      <span className="text-[12px] text-white font-medium text-center mt-2 max-w-[130px] leading-tight">
        {data.label || 'Sub Node'}
      </span>
    </div>
  );
}

const nodeTypes = {
  triggerNode: TriggerNodeComponent,
  actionNode: ActionNodeComponent,
  subNode: SubNodeComponent,
};

// -------------------------------------------------------------
// MAIN CANVAS EDITOR PAGE
// -------------------------------------------------------------
export default function EditorPage({ workflowId, onBack }) {
  const [workflow, setWorkflow] = useState(null);
  const [name, setName] = useState('My workflow');
  const [isActive, setIsActive] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeModeTab, setActiveModeTab] = useState('editor'); // 'editor' | 'executions' | 'evaluations'

  // Bottom dock panel state
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [activeBottomTab, setActiveBottomTab] = useState('chat'); // 'chat' | 'logs'
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);

  // Execution state
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    loadCredentials();
    if (workflowId && workflowId !== 'new') {
      loadWorkflow(workflowId);
    } else {
      initMatchingReferenceWorkflow();
    }
  }, [workflowId]);

  const loadCredentials = async () => {
    try {
      const res = await fetch('/api/credentials');
      const data = await res.json();
      setCredentials(data.credentials || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Initialize nodes matching the reference screenshot exactly!
  const initMatchingReferenceWorkflow = () => {
    const referenceNodes = [
      {
        id: 'node-trigger',
        type: 'triggerNode',
        position: { x: 340, y: 160 },
        data: {
          subType: 'manual_trigger',
          label: 'When chat message received',
          icon: MessageSquare,
          isTrigger: true,
        },
      },
      {
        id: 'node-agent',
        type: 'actionNode',
        position: { x: 620, y: 120 },
        data: {
          subType: 'ai_agent',
          label: 'AI Agent',
          icon: Bot,
          isAgent: true,
        },
      },
      {
        id: 'node-model',
        type: 'subNode',
        position: { x: 500, y: 280 },
        data: {
          subType: 'openai_model',
          label: 'OpenAI Chat Model',
          icon: Sparkles,
          isSubNode: true,
        },
      },
    ];

    const referenceEdges = [
      // Flow edge from trigger to agent (solid curved line)
      {
        id: 'e-trigger-agent',
        source: 'node-trigger',
        target: 'node-agent',
        style: { stroke: '#555866', strokeWidth: 2 },
      },
      // Sub-node edge from OpenAI model up to AI Agent's Chat Model port (dashed curved line!)
      {
        id: 'e-model-agent',
        source: 'node-model',
        target: 'node-agent',
        targetHandle: 'model',
        style: { stroke: '#666a7a', strokeWidth: 1.5, strokeDasharray: '5,5' },
      },
    ];

    setName('My workflow');
    setIsActive(false);
    setNodes(referenceNodes);
    setEdges(referenceEdges);
  };

  const loadWorkflow = async (id) => {
    try {
      const res = await fetch(`/api/workflows/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const wf = data.workflow;
      setWorkflow(wf);
      setName(wf.name);
      setIsActive(Boolean(wf.is_active));

      const parsedNodes = JSON.parse(wf.nodes_json || '[]').map((n) => {
        let nType = 'actionNode';
        if (n.type?.includes('trigger') || n.data?.isTrigger) nType = 'triggerNode';
        else if (n.data?.isSubNode || n.type?.includes('model') || n.type?.includes('vault')) nType = 'subNode';

        return {
          ...n,
          type: nType,
          data: {
            ...n.data,
            subType: n.type,
            icon: resolveNodeIcon(n.type),
            isAgent: n.type?.includes('ai'),
            isTrigger: n.type?.includes('trigger'),
            isSubNode: n.data?.isSubNode || n.type?.includes('model'),
          },
        };
      });

      const parsedEdges = JSON.parse(wf.connections_json || '[]').map((e) => ({
        ...e,
        style: e.targetHandle === 'model' || e.targetHandle === 'credential'
          ? { stroke: '#666a7a', strokeWidth: 1.5, strokeDasharray: '5,5' }
          : { stroke: '#555866', strokeWidth: 2 },
      }));

      setNodes(parsedNodes);
      setEdges(parsedEdges);
    } catch (err) {
      showToast('Failed to load workflow', 'error');
    }
  };

  const resolveNodeIcon = (type) => {
    if (type?.includes('trigger') || type === 'manual_trigger') return MessageSquare;
    if (type?.includes('schedule')) return Clock;
    if (type?.includes('agent') || type === 'ai_agent') return Bot;
    if (type?.includes('model') || type?.includes('ai')) return Sparkles;
    if (type?.includes('mail') || type === 'send_email') return Send;
    if (type?.includes('lead')) return Database;
    if (type?.includes('credential') || type === 'smtp_vault') return Key;
    return Cpu;
  };

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (connection) => {
      const isSubConnect = connection.targetHandle === 'model' || connection.targetHandle === 'memory' || connection.targetHandle === 'tool';
      const edge = {
        ...connection,
        style: isSubConnect
          ? { stroke: '#666a7a', strokeWidth: 1.5, strokeDasharray: '5,5' }
          : { stroke: '#555866', strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    []
  );

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  // Add node from palette
  const handleAddNode = (template) => {
    const newId = `node-${Date.now()}`;
    const newNode = {
      id: newId,
      type: template.type,
      position: { x: 300 + nodes.length * 40, y: 150 + nodes.length * 20 },
      data: {
        subType: template.subType,
        label: template.label,
        icon: template.icon,
        isTrigger: template.isTrigger,
        isAgent: template.isAgent,
        isSubNode: template.isSubNode,
        ...(template.subType === 'get_leads' ? { status: 'Pending', limit: 10 } : {}),
        ...(template.subType === 'if_condition' ? { field: '{{ $json.email }}', operator: 'contains', compareValue: '@' } : {}),
        ...(template.subType === 'wait' ? { seconds: 45 } : {}),
        ...(template.subType === 'send_email' ? { to: '{{ $json.email }}', subject: '{{ $json.email_subject }}', body: '{{ $json.email_body }}' } : {}),
      },
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNode(newNode);
    showToast(`Added ${template.label}`);
  };

  const handleUpdateNodeData = (updates) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          const updated = {
            ...n,
            data: { ...n.data, ...updates },
          };
          setSelectedNode(updated);
          return updated;
        }
        return n;
      })
    );
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    showToast('Node removed');
  };

  // Save workflow
  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        name,
        is_active: isActive,
        trigger_type: nodes.find((n) => n.data.subType?.includes('schedule')) ? 'schedule' : 'manual',
        nodes_json: JSON.stringify(
          nodes.map((n) => ({
            id: n.id,
            type: n.data.subType || n.type,
            data: n.data,
            position: n.position,
          }))
        ),
        connections_json: JSON.stringify(edges),
      };

      const url = workflow?.id ? `/api/workflows/${workflow.id}` : '/api/workflows';
      const method = workflow?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setWorkflow(data.workflow);
      showToast('Workflow saved successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Run execution
  const handleExecuteRun = async () => {
    try {
      setRunning(true);
      showToast('Executing workflow run...', 'info');

      // Set nodes to running animation
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, runStatus: 'running' } }))
      );

      // Save first
      let currentWfId = workflow?.id;
      const payload = {
        name,
        is_active: isActive,
        trigger_type: 'manual',
        nodes_json: JSON.stringify(
          nodes.map((n) => ({
            id: n.id,
            type: n.data.subType || n.type,
            data: n.data,
            position: n.position,
          }))
        ),
        connections_json: JSON.stringify(edges),
      };

      const saveRes = await fetch(currentWfId ? `/api/workflows/${currentWfId}` : '/api/workflows', {
        method: currentWfId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const saveData = await saveRes.json();
      currentWfId = saveData.workflow.id;
      setWorkflow(saveData.workflow);

      const runRes = await fetch(`/api/workflows/${currentWfId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTestRun: true }),
      });
      const runData = await runRes.json();
      if (!runRes.ok) throw new Error(runData.error);

      const resObj = runData.result;
      setExecutionResult(resObj);

      // Update node statuses
      setNodes((nds) =>
        nds.map((n) => {
          const nodeRes = resObj.nodeResults?.[n.id];
          return {
            ...n,
            data: {
              ...n.data,
              runStatus: nodeRes ? nodeRes.status : 'success',
              lastRunOutput: nodeRes ? nodeRes.output : null,
              lastRunError: nodeRes ? nodeRes.error : null,
            },
          };
        })
      );

      // Open bottom logs panel to show result!
      setShowBottomPanel(true);
      setActiveBottomTab('logs');

      if (resObj.status === 'success') {
        showToast(`Execution finished in ${resObj.durationMs}ms`);
      } else {
        showToast(`Execution error: ${resObj.error}`, 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, runStatus: 'idle' } }))
      );
    } finally {
      setRunning(false);
    }
  };

  // Bottom dock chat handler
  const handleSendDockChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || chatSending) return;

    const userText = chatInput.trim();
    setChatInput('');
    setChatSending(true);

    setChatMessages((prev) => [...prev, { role: 'user', content: userText }]);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply || 'Workflow updated.' },
      ]);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[#101114] text-white font-sans overflow-hidden select-none">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-lg border text-xs font-mono shadow-2xl ${
          toast.type === 'error'
            ? 'bg-[#2a1717] border-[#EF4444] text-[#ff8080]'
            : 'bg-[#15271d] border-[#10B981] text-[#6ee7b7]'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-[#EF4444]" /> : <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Bar (Authentic n8n Layout) */}
      <header className="h-12 bg-[#16171b] border-b border-[#22242a] px-4 flex items-center justify-between shrink-0 text-xs">
        {/* Left: Breadcrumbs & Workflow Name */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 hover:bg-[#22242b] rounded text-[#8c90a0] hover:text-white transition-colors"
            title="Back to Workflows"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 text-[#8c90a0]">
            <span className="hover:text-white cursor-pointer flex items-center gap-1">
              Personal
            </span>
            <span>/</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-transparent font-medium text-white text-xs hover:bg-[#22242b] px-2 py-1 rounded focus:bg-[#22242b] focus:outline-none w-48 transition-colors"
            />
            <button className="p-1 text-[#8c90a0] hover:text-white hover:bg-[#22242b] rounded">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Mode Switcher Pills ([ Editor | Executions | Evaluations ]) */}
        <div className="flex items-center bg-[#101114] border border-[#26282e] rounded-lg p-0.5 text-xs font-medium">
          <button
            onClick={() => setActiveModeTab('editor')}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeModeTab === 'editor'
                ? 'bg-[#22242b] text-white shadow-sm'
                : 'text-[#8c90a0] hover:text-white'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => {
              setActiveModeTab('executions');
              setShowBottomPanel(true);
              setActiveBottomTab('logs');
            }}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeModeTab === 'executions'
                ? 'bg-[#22242b] text-white shadow-sm'
                : 'text-[#8c90a0] hover:text-white'
            }`}
          >
            Executions
          </button>
          <button
            onClick={() => setActiveModeTab('evaluations')}
            className={`px-3 py-1 rounded-md transition-colors ${
              activeModeTab === 'evaluations'
                ? 'bg-[#22242b] text-white shadow-sm'
                : 'text-[#8c90a0] hover:text-white'
            }`}
          >
            Evaluations
          </button>
        </div>

        {/* Right: Actions (Active Toggle, Save, Run Execution) */}
        <div className="flex items-center gap-2">
          {/* Active Switch */}
          <button
            onClick={() => setIsActive(!isActive)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1.5 transition-colors ${
              isActive
                ? 'bg-[#1bb978]/15 border-[#1bb978]/40 text-[#1bb978]'
                : 'bg-[#22242b] border-[#333642] text-[#8c90a0] hover:text-white'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#1bb978]' : 'bg-[#727582]'}`} />
            <span>{isActive ? 'Active' : 'Inactive'}</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 bg-[#22242b] hover:bg-[#2d303a] border border-[#333642] rounded-md text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save</span>
          </button>

          {/* Test Run Execution Button (n8n green lightning bolt) */}
          <button
            onClick={handleExecuteRun}
            disabled={running}
            className="px-3 py-1 bg-[#1bb978] hover:bg-[#22c55e] text-black font-semibold rounded-md text-xs flex items-center gap-1.5 transition-colors shadow-md"
            title="Execute Workflow Test Run"
          >
            {running ? (
              <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent animate-spin rounded-full" />
            ) : (
              <Zap className="w-3.5 h-3.5 fill-black" />
            )}
            <span>Test step</span>
          </button>
        </div>
      </header>

      {/* Main Canvas & Palette Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Draggable/Clickable Node Palette */}
        <aside className="w-56 bg-[#16171b] border-r border-[#22242a] flex flex-col shrink-0 overflow-y-auto text-xs select-none">
          <div className="p-3 border-b border-[#22242a] flex items-center justify-between text-[#8c90a0]">
            <span className="font-semibold text-white uppercase text-[11px] tracking-wider">Nodes</span>
            <span className="text-[10px]">Click to add</span>
          </div>

          <div className="p-2 space-y-4">
            {NODE_PALETTE.map((cat) => (
              <div key={cat.category}>
                <div className="text-[10px] uppercase text-[#727582] font-semibold px-2 mb-1.5">
                  {cat.category}
                </div>
                <div className="space-y-1">
                  {cat.nodes.map((n) => {
                    const NodeIcon = n.icon;
                    return (
                      <button
                        key={n.subType}
                        onClick={() => handleAddNode(n)}
                        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg bg-[#1a1b20] hover:bg-[#22242b] border border-transparent hover:border-[#333642] transition-colors text-left group"
                      >
                        <div className="w-7 h-7 rounded-md bg-[#24262e] flex items-center justify-center shrink-0 group-hover:bg-[#2e313b]">
                          <NodeIcon className="w-4 h-4 text-[#ff6d5a]" />
                        </div>
                        <span className="text-white text-xs truncate font-medium">
                          {n.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Infinite Canvas */}
        <div className="flex-1 h-full bg-[#101114] relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-[#101114]"
          >
            {/* Subtle dot background just like n8n screenshot */}
            <Background color="#26282f" gap={20} size={1.2} />
          </ReactFlow>

          {/* Floating Canvas Controls (Bottom-Left Pill) */}
          <div className="absolute left-6 bottom-6 z-10 flex items-center bg-[#1e2026] border border-[#32353e] rounded-xl p-1 shadow-2xl text-[#8c90a0]">
            <button
              onClick={() => {}}
              className="p-1.5 hover:text-white hover:bg-[#2a2d36] rounded-lg transition-colors"
              title="Fit View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {}}
              className="p-1.5 hover:text-white hover:bg-[#2a2d36] rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {}}
              className="p-1.5 hover:text-white hover:bg-[#2a2d36] rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {}}
              className="p-1.5 hover:text-white hover:bg-[#2a2d36] rounded-lg transition-colors"
              title="Clean Up Layout"
            >
              <Wand2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Floating "Hide chat" / "Show chat" Button (Bottom-Center) */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10">
            <button
              onClick={() => setShowBottomPanel(!showBottomPanel)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#1e2026] hover:bg-[#262830] border border-[#32353e] rounded-xl text-xs text-white font-medium shadow-2xl transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#ff6d5a]" />
              <span>{showBottomPanel ? 'Hide chat' : 'Open chat'}</span>
            </button>
          </div>
        </div>

        {/* Right Drawer: Selected Node Properties Config */}
        {selectedNode && (
          <aside className="w-80 bg-[#16171b] border-l border-[#22242a] flex flex-col shrink-0 overflow-y-auto text-xs">
            <div className="p-3.5 border-b border-[#22242a] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">
                  {selectedNode.data.label || 'Node'}
                </h3>
                <span className="text-[10px] text-[#8c90a0] font-mono">
                  {selectedNode.data.subType || selectedNode.type}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 text-[#8c90a0] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[11px] text-[#8c90a0] mb-1">Title</label>
                <input
                  type="text"
                  value={selectedNode.data.label || ''}
                  onChange={(e) => handleUpdateNodeData({ label: e.target.value })}
                  className="w-full bg-[#101114] border border-[#2a2d36] focus:border-[#ff6d5a] px-2.5 py-1.5 rounded text-white outline-none"
                />
              </div>

              {/* Get Leads Config */}
              {selectedNode.data.subType === 'get_leads' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-[#8c90a0] mb-1">Status</label>
                    <select
                      value={selectedNode.data.status || 'Pending'}
                      onChange={(e) => handleUpdateNodeData({ status: e.target.value })}
                      className="w-full bg-[#101114] border border-[#2a2d36] p-1.5 rounded text-white"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Sent">Sent</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8c90a0] mb-1">Limit</label>
                    <input
                      type="number"
                      value={selectedNode.data.limit || 10}
                      onChange={(e) => handleUpdateNodeData({ limit: Number(e.target.value) })}
                      className="w-full bg-[#101114] border border-[#2a2d36] p-1.5 rounded text-white"
                    />
                  </div>
                </div>
              )}

              {/* Send Email Config */}
              {selectedNode.data.subType === 'send_email' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-[#8c90a0] mb-1">SMTP Vault</label>
                    <select
                      value={selectedNode.data.credential_id || ''}
                      onChange={(e) => handleUpdateNodeData({ credential_id: e.target.value })}
                      className="w-full bg-[#101114] border border-[#2a2d36] p-1.5 rounded text-white"
                    >
                      <option value="">Default Available Vault</option>
                      {credentials.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8c90a0] mb-1">Recipient</label>
                    <input
                      type="text"
                      value={selectedNode.data.to || '{{ $json.email }}'}
                      onChange={(e) => handleUpdateNodeData({ to: e.target.value })}
                      className="w-full bg-[#101114] border border-[#2a2d36] p-1.5 rounded text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8c90a0] mb-1">Subject</label>
                    <input
                      type="text"
                      value={selectedNode.data.subject || '{{ $json.email_subject }}'}
                      onChange={(e) => handleUpdateNodeData({ subject: e.target.value })}
                      className="w-full bg-[#101114] border border-[#2a2d36] p-1.5 rounded text-white"
                    />
                  </div>
                </div>
              )}

              {/* Node Output Preview */}
              {selectedNode.data.lastRunOutput && (
                <div className="pt-3 border-t border-[#22242a]">
                  <span className="text-[10px] text-[#10B981] font-bold block mb-1">OUTPUT PAYLOAD</span>
                  <pre className="bg-[#101114] p-2 rounded border border-[#26282e] text-[10px] text-[#a0a5b8] max-h-36 overflow-auto font-mono">
                    {JSON.stringify(selectedNode.data.lastRunOutput, null, 2)}
                  </pre>
                </div>
              )}

              <button
                onClick={handleDeleteNode}
                className="w-full py-1.5 bg-[#2a1717] hover:bg-[#3d1a1a] text-[#ff8080] rounded border border-[#521b1b] text-xs font-medium transition-colors"
              >
                Delete node
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* --------------------------------------------------------- */}
      {/* 4. BOTTOM DOCKED PANEL (Chat & Logs: Exactly like screenshot) */}
      {/* --------------------------------------------------------- */}
      {showBottomPanel && (
        <div className="h-64 bg-[#16171b] border-t border-[#22242a] flex shrink-0 text-xs font-sans">
          {/* Left Split Pane: Chat */}
          <div className="w-1/2 border-r border-[#22242a] flex flex-col justify-between">
            {/* Chat Pane Header */}
            <div className="h-9 px-4 border-b border-[#22242a] flex items-center justify-between text-[#8c90a0]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">Chat</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span>Session: 1887f...</span>
                <button
                  onClick={() => setChatMessages([])}
                  className="p-1 hover:text-white"
                  title="Reset session"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Chat Message Scroll Area */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-[#727582] text-xs">
                  Ask AI assistant to adjust parameters, test conditions, or build workflows.
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-md p-2.5 rounded-xl border leading-relaxed text-xs ${
                        msg.role === 'user'
                          ? 'bg-[#22242b] border-[#333642] text-white'
                          : 'bg-[#1e2026] border-[#2a2d36] text-[#d1d5db]'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input Box (Exact placeholder & styling from screenshot) */}
            <form onSubmit={handleSendDockChat} className="p-3 border-t border-[#22242a] flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type message, or press 'up' for previous one"
                className="flex-1 bg-[#101114] border border-[#2a2d36] focus:border-[#ff6d5a] px-3 py-2 rounded-lg text-white placeholder-[#555866] outline-none text-xs"
              />
              <button
                type="submit"
                disabled={chatSending || !chatInput.trim()}
                className="p-2 bg-[#ff6d5a] hover:bg-[#ea4b71] disabled:opacity-40 text-white rounded-lg transition-colors"
                title="Send"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Right Split Pane: Logs */}
          <div className="w-1/2 flex flex-col">
            {/* Logs Pane Header */}
            <div className="h-9 px-4 border-b border-[#22242a] flex items-center justify-between text-[#8c90a0]">
              <span className="font-semibold text-white">Logs</span>
            </div>

            {/* Logs Body */}
            <div className="flex-1 p-4 overflow-y-auto flex items-center justify-center text-center">
              {executionResult ? (
                <div className="w-full text-left font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-white pb-2 border-b border-[#22242a]">
                    <span>Status: <strong className={executionResult.status === 'success' ? 'text-[#10B981]' : 'text-[#EF4444]'}>{executionResult.status.toUpperCase()}</strong></span>
                    <span>Duration: {executionResult.durationMs}ms</span>
                  </div>
                  <pre className="bg-[#101114] p-3 rounded border border-[#26282e] text-[#a0a5b8] max-h-40 overflow-auto">
                    {JSON.stringify(executionResult.nodeResults, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-[#727582] text-xs">
                  Nothing to display yet. Execute the workflow to see execution logs.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
