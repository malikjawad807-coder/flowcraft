import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
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
  Trash2, RefreshCw
} from 'lucide-react';

// Node category definitions
const NODE_PALETTE = [
  {
    category: 'Triggers',
    nodes: [
      { type: 'manual_trigger', label: 'Manual Trigger', icon: Play, desc: 'Trigger on button click or API' },
      { type: 'schedule_trigger', label: 'Schedule Trigger', icon: Clock, desc: 'Run on cron schedule (e.g. daily 9am)' },
      { type: 'webhook_trigger', label: 'Webhook Trigger', icon: Mail, desc: 'Listen on unique inbound URL' },
    ],
  },
  {
    category: 'Data & Loops',
    nodes: [
      { type: 'get_leads', label: 'Get Leads', icon: Database, desc: 'Query database by status & limit' },
      { type: 'limit', label: 'Limit', icon: Filter, desc: 'Keep first N items only' },
      { type: 'loop_over_items', label: 'Loop Over Items', icon: RefreshCw, desc: 'Batch size 1 item processor' },
    ],
  },
  {
    category: 'Logic & Transforms',
    nodes: [
      { type: 'if_condition', label: 'IF Condition', icon: Sliders, desc: 'Branch on true / false conditions' },
      { type: 'edit_fields', label: 'Edit Fields (Set)', icon: Cpu, desc: 'Transform fields using expressions' },
      { type: 'wait', label: 'Wait Delay', icon: Pause, desc: 'Pacing delay (default 45s)' },
      { type: 'ai_write_email', label: 'AI Write Email', icon: Sparkles, desc: 'Generate copy via LLM' },
    ],
  },
  {
    category: 'Email Actions',
    nodes: [
      { type: 'send_email', label: 'Send Email', icon: Send, desc: 'Dispatch SMTP email with safety limits' },
      { type: 'update_lead', label: 'Update Lead', icon: UserCheck, desc: 'Update status (Sent, Replied, etc.)' },
    ],
  },
  {
    category: 'Utility',
    nodes: [
      { type: 'stop_and_error', label: 'Stop and Error', icon: ShieldAlert, desc: 'Halt workflow with custom error' },
    ],
  },
];

// -------------------------------------------------------------
// Custom Node Component for React Flow
// -------------------------------------------------------------
function FlowCartCustomNode({ id, data, selected }) {
  const status = data.runStatus || 'idle'; // idle | running | success | error

  const getStatusDot = () => {
    if (status === 'running') {
      return <div className="w-2.5 h-2.5 bg-[#E10600] rounded-full animate-ping" />;
    }
    if (status === 'success') {
      return <div className="w-2.5 h-2.5 bg-[#10B981] rounded-full" title="Node Succeeded" />;
    }
    if (status === 'error') {
      return <div className="w-2.5 h-2.5 bg-[#EF4444] rounded-full" title="Node Failed" />;
    }
    return <div className="w-2 h-2 bg-[#444444] rounded-full" title="Idle" />;
  };

  const isTrigger = data.type?.includes('trigger');
  const isIf = data.type === 'if_condition';

  return (
    <div
      className={`min-w-[210px] bg-[#141414] border transition-all text-xs font-mono shadow-xl relative ${
        selected ? 'border-[#E10600] ring-1 ring-[#E10600]' : 'border-[#2A2A2A] hover:border-[#444444]'
      }`}
    >
      {/* Input Handle (all except triggers) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-[#2A2A2A] !border-2 !border-[#E10600] !-left-1.5"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-2.5 border-b border-[#222222] bg-[#0E0E0E]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#E10600]" />
          <span className="font-bold text-white uppercase text-[11px] tracking-wider truncate max-w-[130px]">
            {data.label || 'Node'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">{getStatusDot()}</div>
      </div>

      {/* Body preview */}
      <div className="p-2.5 text-[10px] text-[#888888]">
        {data.type === 'get_leads' && (
          <div>Status: <span className="text-white">{data.status || 'Pending'}</span> (Limit: {data.limit || 10})</div>
        )}
        {data.type === 'send_email' && (
          <div className="truncate">To: <span className="text-white">{data.to || '{{ $json.email }}'}</span></div>
        )}
        {data.type === 'if_condition' && (
          <div>Operator: <span className="text-[#E10600] font-semibold">{data.operator || 'is_not_empty'}</span></div>
        )}
        {data.type === 'wait' && (
          <div>Delay: <span className="text-white">{data.seconds || 45} seconds</span></div>
        )}
        {data.type === 'schedule_trigger' && (
          <div>Cron: <span className="text-white">{data.cron || '0 9 * * *'}</span></div>
        )}
        {(!data.type || !['get_leads', 'send_email', 'if_condition', 'wait', 'schedule_trigger'].includes(data.type)) && (
          <div className="truncate text-[#666666]">{data.desc || data.type}</div>
        )}
      </div>

      {/* Output Handles */}
      {isIf ? (
        <>
          <div className="absolute right-0 top-[28%] translate-x-1/2 flex items-center">
            <span className="text-[9px] text-[#10B981] font-bold mr-1">T</span>
            <Handle
              id="true"
              type="source"
              position={Position.Right}
              className="!w-3 !h-3 !bg-[#10B981] !border-2 !border-black !-right-1.5"
            />
          </div>
          <div className="absolute right-0 top-[72%] translate-x-1/2 flex items-center">
            <span className="text-[9px] text-[#EF4444] font-bold mr-1">F</span>
            <Handle
              id="false"
              type="source"
              position={Position.Right}
              className="!w-3 !h-3 !bg-[#EF4444] !border-2 !border-black !-right-1.5"
            />
          </div>
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-[#E10600] !border-2 !border-black !-right-1.5"
        />
      )}
    </div>
  );
}

const nodeTypes = {
  customNode: FlowCartCustomNode,
};

// -------------------------------------------------------------
// Main Editor Component
// -------------------------------------------------------------
export default function EditorPage({ workflowId, onBack }) {
  const [workflow, setWorkflow] = useState(null);
  const [name, setName] = useState('Untitled Workflow');
  const [isActive, setIsActive] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [credentials, setCredentials] = useState([]);
  
  // Running state
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load workflow & credentials
  useEffect(() => {
    loadCredentials();
    if (workflowId && workflowId !== 'new') {
      loadWorkflow(workflowId);
    } else {
      initNewWorkflow();
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

  const initNewWorkflow = () => {
    const initialNodes = [
      {
        id: 'node-start',
        type: 'customNode',
        position: { x: 120, y: 180 },
        data: { type: 'manual_trigger', label: 'Manual Trigger', desc: 'Click Test Run or invoke via API' },
      },
      {
        id: 'node-leads',
        type: 'customNode',
        position: { x: 380, y: 180 },
        data: { type: 'get_leads', label: 'Get Pending Leads', status: 'Pending', limit: 10 },
      },
    ];
    const initialEdges = [
      { id: 'e-start-leads', source: 'node-start', target: 'node-leads' },
    ];
    setWorkflow({ id: null });
    setName('New Cold Outreach Workflow');
    setIsActive(false);
    setNodes(initialNodes);
    setEdges(initialEdges);
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

      const parsedNodes = JSON.parse(wf.nodes_json || '[]').map((n) => ({
        ...n,
        type: 'customNode',
        data: { ...n.data, type: n.type },
      }));
      const parsedEdges = JSON.parse(wf.connections_json || '[]');

      setNodes(parsedNodes);
      setEdges(parsedEdges);
    } catch (err) {
      showToast('Failed to load workflow', 'error');
    }
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
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    []
  );

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const onPaneClick = () => {
    setSelectedNode(null);
  };

  // Add node from left palette
  const handleAddNode = (template) => {
    const newId = `node-${Date.now()}`;
    const newNode = {
      id: newId,
      type: 'customNode',
      position: { x: 250 + nodes.length * 30, y: 150 + nodes.length * 20 },
      data: {
        type: template.type,
        label: template.label,
        desc: template.desc,
        ...(template.type === 'get_leads' ? { status: 'Pending', limit: 10 } : {}),
        ...(template.type === 'if_condition' ? { field: '{{ $json.email }}', operator: 'contains', compareValue: '@' } : {}),
        ...(template.type === 'wait' ? { seconds: 45 } : {}),
        ...(template.type === 'schedule_trigger' ? { cron: '0 9 * * *' } : {}),
        ...(template.type === 'send_email' ? { to: '{{ $json.email }}', subject: '{{ $json.email_subject }}', body: '{{ $json.email_body }}' } : {}),
      },
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNode(newNode);
    showToast(`Added ${template.label}`);
  };

  // Update selected node configuration
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

  const handleDeleteSelectedNode = () => {
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
        trigger_type: nodes.find((n) => n.data.type?.includes('schedule')) ? 'schedule' : 'manual',
        nodes_json: JSON.stringify(
          nodes.map((n) => ({
            id: n.id,
            type: n.data.type,
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

  // Execute test run
  const handleTestRun = async () => {
    try {
      setRunning(true);
      showToast('Executing test run...', 'info');

      // Set all nodes to running state
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, runStatus: 'running' } }))
      );

      // Auto-save first
      let currentWfId = workflow?.id;
      const payload = {
        name,
        is_active: isActive,
        trigger_type: 'manual',
        nodes_json: JSON.stringify(
          nodes.map((n) => ({
            id: n.id,
            type: n.data.type,
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

      // Trigger test execution
      const runRes = await fetch(`/api/workflows/${currentWfId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTestRun: true }),
      });
      const runData = await runRes.json();
      if (!runRes.ok) throw new Error(runData.error);

      const resObj = runData.result;
      setExecutionResult(resObj);

      // Update node visual statuses based on results
      setNodes((nds) =>
        nds.map((n) => {
          const nodeRes = resObj.nodeResults?.[n.id];
          return {
            ...n,
            data: {
              ...n.data,
              runStatus: nodeRes ? nodeRes.status : 'idle',
              lastRunOutput: nodeRes ? nodeRes.output : null,
              lastRunError: nodeRes ? nodeRes.error : null,
            },
          };
        })
      );

      if (resObj.status === 'success') {
        showToast(`Test Run Finished in ${resObj.durationMs}ms`);
      } else {
        showToast(`Test Run Failed: ${resObj.error}`, 'error');
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

  return (
    <div className="h-screen w-full flex flex-col bg-[#0A0A0A] text-white font-sans overflow-hidden">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 border text-xs font-mono shadow-2xl ${
          toast.type === 'error'
            ? 'bg-[#1C0000] border-[#E10600] text-[#FF4D4D]'
            : 'bg-[#001A09] border-[#10B981] text-[#34D399]'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-[#E10600]" /> : <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="h-14 bg-[#141414] border-b border-[#2A2A2A] px-4 flex items-center justify-between shrink-0 font-mono text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 border border-[#2A2A2A] hover:border-[#888888] text-[#888888] hover:text-white transition-colors flex items-center gap-1 text-[11px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workflows</span>
          </button>

          <div className="h-4 w-[1px] bg-[#2A2A2A]" />

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent font-bold text-white text-sm focus:bg-[#0A0A0A] px-2 py-1 border border-transparent focus:border-[#E10600] focus:outline-none w-64 md:w-80"
          />
        </div>

        <div className="flex items-center gap-2.5">
          {/* Active Status Toggle */}
          <button
            onClick={() => setIsActive(!isActive)}
            className={`px-3 py-1.5 border uppercase font-semibold text-[11px] tracking-wider transition-colors flex items-center gap-1.5 ${
              isActive
                ? 'bg-[#001A09] border-[#10B981] text-[#10B981]'
                : 'bg-[#1C1C1C] border-[#2A2A2A] text-[#888888] hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#10B981]' : 'bg-[#555555]'}`} />
            <span>{isActive ? 'Active' : 'Inactive'}</span>
          </button>

          {/* Test Run Button */}
          <button
            onClick={handleTestRun}
            disabled={running}
            className="bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#E10600] text-white px-3.5 py-1.5 uppercase font-semibold text-[11px] tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {running ? (
              <>
                <div className="w-3 h-3 border-2 border-[#E10600] border-t-transparent animate-spin rounded-full" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-[#E10600]" />
                <span>Test Run</span>
              </>
            )}
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-4 py-1.5 uppercase font-semibold text-[11px] tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save</span>
          </button>
        </div>
      </header>

      {/* Main Builder Area: Left Palette + Canvas + Right Drawer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Palette: Available Nodes */}
        <aside className="w-64 bg-[#141414] border-r border-[#2A2A2A] flex flex-col shrink-0 overflow-y-auto font-mono text-xs">
          <div className="p-3 border-b border-[#2A2A2A] font-bold text-white uppercase text-[11px] tracking-wider flex items-center justify-between">
            <span>Node Library</span>
            <span className="text-[10px] text-[#666666]">Click to add</span>
          </div>

          <div className="p-3 space-y-4">
            {NODE_PALETTE.map((cat) => (
              <div key={cat.category}>
                <div className="text-[10px] uppercase text-[#666666] font-bold mb-2">
                  {cat.category}
                </div>
                <div className="space-y-1.5">
                  {cat.nodes.map((nodeTpl) => {
                    const IconComponent = nodeTpl.icon;
                    return (
                      <button
                        key={nodeTpl.type}
                        onClick={() => handleAddNode(nodeTpl)}
                        className="w-full text-left p-2 bg-[#0A0A0A] border border-[#222222] hover:border-[#E10600] transition-colors group flex items-start gap-2"
                      >
                        <div className="p-1 bg-[#141414] border border-[#2A2A2A] group-hover:border-[#E10600]">
                          <IconComponent className="w-3.5 h-3.5 text-[#E10600]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold text-[11px] truncate group-hover:text-[#E10600]">
                            {nodeTpl.label}
                          </div>
                          <div className="text-[#666666] text-[10px] truncate">
                            {nodeTpl.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas Area */}
        <div className="flex-1 h-full bg-[#0A0A0A] relative">
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
            className="bg-[#0A0A0A]"
          >
            <Background color="#222222" gap={16} size={1} />
            <Controls className="!bg-[#141414] !border-[#2A2A2A] !fill-white" />
            <MiniMap
              className="!bg-[#141414] !border-[#2A2A2A]"
              nodeColor={() => '#E10600'}
              maskColor="rgba(0, 0, 0, 0.7)"
            />
          </ReactFlow>
        </div>

        {/* Right Configuration & Inspection Drawer */}
        {selectedNode && (
          <aside className="w-96 bg-[#141414] border-l border-[#2A2A2A] flex flex-col shrink-0 overflow-y-auto font-mono text-xs">
            <div className="p-3 border-b border-[#2A2A2A] flex items-center justify-between">
              <div>
                <span className="font-bold text-white uppercase text-xs">
                  {selectedNode.data.label || 'Node Configuration'}
                </span>
                <div className="text-[10px] text-[#666666]">Type: {selectedNode.data.type}</div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[#888888] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Node Title */}
              <div>
                <label className="block text-[#888888] uppercase text-[10px] mb-1">Node Title</label>
                <input
                  type="text"
                  value={selectedNode.data.label || ''}
                  onChange={(e) => handleUpdateNodeData({ label: e.target.value })}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                />
              </div>

              {/* Node-Specific Config Forms */}
              {selectedNode.data.type === 'get_leads' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Status Filter</label>
                    <select
                      value={selectedNode.data.status || 'Pending'}
                      onChange={(e) => handleUpdateNodeData({ status: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Sent">Sent</option>
                      <option value="Replied">Replied</option>
                      <option value="Failed">Failed</option>
                      <option value="all">All Statuses</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Max Leads Limit</label>
                    <input
                      type="number"
                      value={selectedNode.data.limit || 10}
                      onChange={(e) => handleUpdateNodeData({ limit: Number(e.target.value) })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.type === 'schedule_trigger' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Cron Expression</label>
                    <input
                      type="text"
                      value={selectedNode.data.cron || '0 9 * * *'}
                      onChange={(e) => handleUpdateNodeData({ cron: e.target.value })}
                      placeholder="0 9 * * *"
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div className="text-[10px] text-[#666666] space-y-1">
                    <div>• <code>0 9 * * *</code> = Every day at 9:00 AM</div>
                    <div>• <code>0 10 * * *</code> = Every day at 10:00 AM</div>
                    <div>• <code>*/15 * * * *</code> = Every 15 minutes</div>
                  </div>
                </div>
              )}

              {selectedNode.data.type === 'if_condition' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Field Expression</label>
                    <input
                      type="text"
                      value={selectedNode.data.field || '{{ $json.email }}'}
                      onChange={(e) => handleUpdateNodeData({ field: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Condition Operator</label>
                    <select
                      value={selectedNode.data.operator || 'is_not_empty'}
                      onChange={(e) => handleUpdateNodeData({ operator: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    >
                      <option value="is_not_empty">Is Not Empty</option>
                      <option value="is_empty">Is Empty</option>
                      <option value="contains">Contains</option>
                      <option value="not_contains">Does Not Contain</option>
                      <option value="equals">Equals</option>
                      <option value="not_equals">Not Equals</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Compare Value</label>
                    <input
                      type="text"
                      value={selectedNode.data.compareValue || ''}
                      onChange={(e) => handleUpdateNodeData({ compareValue: e.target.value })}
                      placeholder="@"
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>
              )}

              {selectedNode.data.type === 'ai_write_email' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Prompt Template</label>
                    <textarea
                      rows={4}
                      value={selectedNode.data.promptTemplate || 'Draft a personalized cold outreach email to {{ $json.name }} at {{ $json.business }}.'}
                      onChange={(e) => handleUpdateNodeData({ promptTemplate: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] p-2 text-white"
                    />
                  </div>
                  <div className="text-[10px] text-[#777777]">
                    Supports variables: <code>{'{{ $json.name }}'}</code>, <code>{'{{ $json.business }}'}</code>, <code>{'{{ $json.city }}'}</code>
                  </div>
                </div>
              )}

              {selectedNode.data.type === 'send_email' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">SMTP Credential Vault</label>
                    <select
                      value={selectedNode.data.credential_id || ''}
                      onChange={(e) => handleUpdateNodeData({ credential_id: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    >
                      <option value="">Default (First Available Vault)</option>
                      {credentials.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.user})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Recipient Expression</label>
                    <input
                      type="text"
                      value={selectedNode.data.to || '{{ $json.email }}'}
                      onChange={(e) => handleUpdateNodeData({ to: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Subject</label>
                    <input
                      type="text"
                      value={selectedNode.data.subject || '{{ $json.email_subject }}'}
                      onChange={(e) => handleUpdateNodeData({ subject: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Body HTML / Plain Text</label>
                    <textarea
                      rows={4}
                      value={selectedNode.data.body || '{{ $json.email_body }}'}
                      onChange={(e) => handleUpdateNodeData({ body: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] p-2 text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="retry-fail"
                      checked={selectedNode.data.retryOnFail !== false}
                      onChange={(e) => handleUpdateNodeData({ retryOnFail: e.target.checked })}
                      className="accent-[#E10600]"
                    />
                    <label htmlFor="retry-fail" className="text-white text-[11px] cursor-pointer">
                      Retry on Fail (3 attempts, 5s apart)
                    </label>
                  </div>
                </div>
              )}

              {selectedNode.data.type === 'wait' && (
                <div>
                  <label className="block text-[#888888] uppercase text-[10px] mb-1">Delay Duration (Seconds)</label>
                  <input
                    type="number"
                    value={selectedNode.data.seconds || 45}
                    onChange={(e) => handleUpdateNodeData({ seconds: Number(e.target.value) })}
                    className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                  />
                  <span className="text-[10px] text-[#666666] mt-1 block">Default safe wait: 45 seconds</span>
                </div>
              )}

              {selectedNode.data.type === 'update_lead' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Set Lead Status</label>
                    <select
                      value={selectedNode.data.status || 'Sent'}
                      onChange={(e) => handleUpdateNodeData({ status: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    >
                      <option value="Sent">Sent</option>
                      <option value="Pending">Pending</option>
                      <option value="Replied">Replied</option>
                      <option value="Failed">Failed</option>
                      <option value="Unsubscribed">Unsubscribed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#888888] uppercase text-[10px] mb-1">Set Pipeline Step</label>
                    <input
                      type="text"
                      value={selectedNode.data.step || 'Outreach Dispatched'}
                      onChange={(e) => handleUpdateNodeData({ step: e.target.value })}
                      className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-2.5 py-1.5 text-white"
                    />
                  </div>
                </div>
              )}

              {/* Node Test Output Display */}
              {selectedNode.data.lastRunOutput && (
                <div className="pt-3 border-t border-[#2A2A2A]">
                  <div className="text-[10px] uppercase text-[#10B981] font-bold mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Last Run Output JSON</span>
                  </div>
                  <pre className="bg-[#0A0A0A] p-2.5 border border-[#2A2A2A] text-[10px] overflow-x-auto text-[#CCCCCC] max-h-40">
                    {JSON.stringify(selectedNode.data.lastRunOutput, null, 2)}
                  </pre>
                </div>
              )}

              {selectedNode.data.lastRunError && (
                <div className="pt-3 border-t border-[#2A2A2A]">
                  <div className="text-[10px] uppercase text-[#EF4444] font-bold mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Last Run Error</span>
                  </div>
                  <div className="bg-[#1C0000] p-2.5 border border-[#E10600] text-[10px] text-[#FF4D4D]">
                    {selectedNode.data.lastRunError}
                  </div>
                </div>
              )}

              {/* Delete Node Button */}
              <div className="pt-4 border-t border-[#2A2A2A]">
                <button
                  type="button"
                  onClick={handleDeleteSelectedNode}
                  className="w-full py-1.5 bg-[#1C0000] border border-[#E10600] hover:bg-[#E10600] text-white text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Node</span>
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
