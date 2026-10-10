'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import confetti from 'canvas-confetti';

import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { NodeLibrary } from '@/components/sidebar/NodeLibrary';
import { BuilderHeader } from '@/components/header/BuilderHeader';
import { NodeConfigDrawer } from '@/components/drawers/NodeConfigDrawer';
import { ExecutionDrawer } from '@/components/drawers/ExecutionDrawer';
import { TemplatesModal } from '@/components/modals/TemplatesModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { AiAssistantPanel } from '@/components/ai-assistant/AiAssistantPanel';
import { SAMPLE_WORKFLOWS } from '@/lib/sample-workflows';
import {
  NodeType,
  WorkflowNodeData,
  WorkflowExecutionResult,
  WorkflowTemplate,
} from '@/types/workflow';

export default function WorkflowBuilderPage() {
  const initialWorkflow = SAMPLE_WORKFLOWS[0];

  const [workflowName, setWorkflowName] = useState(initialWorkflow.name);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow.edges as Edge[]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);

  // Workflow Persistence & Test Runs (Phase 4)
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [sampleEmailId, setSampleEmailId] = useState<string>('support_question');
  const [sampleEmails, setSampleEmails] = useState<Array<{ id: string; name: string }>>([]);
  const [validationErrors, setValidationErrors] = useState<Array<{ nodeId?: string; message: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Modals & Panels
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);

  // AI Assistant active model state
  const [selectedAiModel, setSelectedAiModel] = useState<string>('gpt-4o');

  // API Credentials
  const [apiKeys, setApiKeys] = useState<{
    openaiApiKey?: string;
    anthropicApiKey?: string;
    geminiApiKey?: string;
    userEmail?: string;
    appPassword?: string;
    gmailToken?: string;
  }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch sample email fixtures and existing workflows on mount
  useEffect(() => {
    apiFetch<{ sampleEmails: Array<{ id: string; name: string }> }>('/api/sample-emails')
      .then((data) => {
        if (data?.sampleEmails && data.sampleEmails.length > 0) {
          setSampleEmails(data.sampleEmails);
          setSampleEmailId(data.sampleEmails[0].id);
        }
      })
      .catch(() => {});

    apiFetch<{ workflows: Array<{ id: string; name: string; graph: any }> }>('/api/workflows')
      .then((data) => {
        if (data?.workflows && data.workflows.length > 0) {
          const latest = data.workflows[0];
          setActiveWorkflowId(latest.id);
          setWorkflowName(latest.name);
          if (latest.graph?.nodes && latest.graph?.edges) {
            setNodes(latest.graph.nodes);
            setEdges(latest.graph.edges);
          }
        }
      })
      .catch(() => {});
  }, [setNodes, setEdges]);

  // Connection handler
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'workflowEdge',
            animated: true,
            style: { stroke: 'var(--muted)', strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Find active node object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const n = nodes.find((node) => node.id === selectedNodeId);
    return n ? (n.data as unknown as WorkflowNodeData) : null;
  }, [selectedNodeId, nodes]);

  // Compute upstream nodes for selected node to expose variables
  const upstreamNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    const incomingEdges = edges.filter((e) => e.target === selectedNodeId);
    const sourceIds = incomingEdges.map((e) => e.source);
    return nodes
      .filter((n) => sourceIds.includes(n.id))
      .map((n) => n.data as unknown as WorkflowNodeData);
  }, [selectedNodeId, edges, nodes]);

  // Node Click
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Pane Click
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Factory to create fresh nodes
  const createNewNode = useCallback(
    (type: NodeType, position?: { x: number; y: number }): Node => {
      const id = `node_${type}_${Math.random().toString(36).substring(2, 7)}`;
      const pos = position || {
        x: 150 + Math.random() * 200,
        y: 120 + Math.random() * 150,
      };

      let category: WorkflowNodeData['category'] = 'logic';
      let label = 'New Node';
      let config: Record<string, any> = {};

      switch (type) {
        case 'email_list_file_upload':
          category = 'trigger';
          label = 'Email List Trigger';
          config = {
            fileName: 'sample_leads.csv',
            rawContent: 'email,name,company\nalex@example.com,Alex,Acme',
            recipients: [{ email: 'alex@example.com', name: 'Alex', company: 'Acme', isValid: true }],
            totalCount: 1,
            validCount: 1,
          };
          break;

        case 'input_form_trigger':
          category = 'trigger';
          label = 'Input Form Trigger';
          config = {
            formTitle: 'Contact Form',
            fields: [{ id: 'f1', name: 'email', label: 'Email', type: 'email', required: true }],
            submittedValues: { email: 'alex@example.com' },
          };
          break;

        case 'openai_llm':
          category = 'ai';
          label = 'AI Assistant';
          config = {
            model: 'gpt-4o-mini',
            userPrompt: 'Draft a short reply to the customer.',
            systemPrompt: 'You are a helpful email assistant.',
            temperature: 0.7,
            maxTokens: 500,
          };
          break;

        case 'vector_store':
          category = 'ai';
          label = 'Long-Term Memory';
          config = {
            provider: 'pinecone',
            indexName: 'user-memory',
            topK: 3,
            searchQuery: '{{input_form_trigger.email}}',
          };
          break;

        case 'gmail_send':
          category = 'action';
          label = 'Gmail Action';
          config = {
            sendMode: 'single',
            to: '{{item.email}}',
            subject: 'Re: Follow up',
            body: 'Hello {{item.name}},\n\nThank you for reaching out.',
          };
          break;

        case 'condition_filter':
          category = 'logic';
          label = 'Condition Filter';
          config = {
            field: '{{openai_llm.output}}',
            operator: 'contains',
            value: 'urgent',
          };
          break;

        default:
          category = 'logic';
          label = type;
      }

      return {
        id,
        type,
        position: pos,
        data: {
          id,
          label,
          category,
          nodeType: type,
          status: 'idle',
          config,
        },
      };
    },
    []
  );

  // Add node from library
  const handleAddNode = useCallback(
    (type: NodeType) => {
      const newNode = createNewNode(type);
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [createNewNode, setNodes]
  );

  // Drag and drop node onto canvas
  const handleDropNode = useCallback(
    (type: NodeType, position: { x: number; y: number }) => {
      const newNode = createNewNode(type, position);
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [createNewNode, setNodes]
  );

  // Update node data
  const handleUpdateNode = useCallback(
    (nodeId: string, updatedData: Partial<WorkflowNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...(n.data as any),
                ...updatedData,
                config: {
                  ...((n.data as any).config || {}),
                  ...(updatedData.config || {}),
                },
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  // Delete node
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [selectedNodeId, setNodes, setEdges]
  );

  // Helper to format canvas nodes into a validated WorkflowGraph
  const getCanvasGraph = useCallback(() => {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.data as any)?.nodeType || n.type || 'manual.trigger',
        name: (n.data as any)?.label || n.id,
        position: n.position,
        config: (n.data as any)?.config || {},
        settings: (n.data as any)?.settings || { retryMax: 0, retryBackoffMs: 2000, onError: 'stop' },
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: (e as any).sourceHandle || 'main',
        target: e.target,
      })),
    };
  }, [nodes, edges]);

  // Save Workflow
  const handleSaveWorkflow = useCallback(async () => {
    setIsSaving(true);
    const graph = getCanvasGraph();

    try {
      if (activeWorkflowId) {
        const res = await apiFetch<{ workflow: any }>(`/api/workflows/${activeWorkflowId}`, {
          method: 'PUT',
          body: JSON.stringify({ name: workflowName, graph }),
        });
        setValidationErrors([]);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } else {
        const res = await apiFetch<{ workflow: any }>('/api/workflows', {
          method: 'POST',
          body: JSON.stringify({ name: workflowName, graph }),
        });
        setActiveWorkflowId(res.workflow.id);
        setValidationErrors([]);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      }
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        setValidationErrors(err.details);
      } else {
        setValidationErrors([{ message: err.message || 'Failed to save workflow' }]);
      }
    } finally {
      setIsSaving(false);
    }
  }, [activeWorkflowId, workflowName, getCanvasGraph]);

  // Run Workflow (Execution with real API)
  const handleRunWorkflow = useCallback(async () => {
    setIsRunning(true);
    setIsLogDrawerOpen(true);
    setValidationErrors([]);

    // Reset status to running
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...(n.data as any),
          status: 'running',
          lastRunError: undefined,
        },
      }))
    );

    const graph = getCanvasGraph();

    try {
      // First ensure workflow exists in DB
      let wfId = activeWorkflowId;
      if (!wfId) {
        const createRes = await apiFetch<{ workflow: any }>('/api/workflows', {
          method: 'POST',
          body: JSON.stringify({ name: workflowName, graph }),
        });
        wfId = createRes.workflow.id;
        setActiveWorkflowId(wfId);
      }

      const response = await apiFetch<{ success: boolean; result: any }>(`/api/workflows/${wfId}/test-run`, {
        method: 'POST',
        body: JSON.stringify({
          sampleEmailId,
          graph,
        }),
      });

      const result = response.result;
      setExecutionResult(result);

      // Update node visual status based on real step execution
      setNodes((nds) =>
        nds.map((n) => {
          const step = result.steps?.find((s: any) => s.nodeId === n.id);
          if (step) {
            return {
              ...n,
              data: {
                ...(n.data as any),
                status: step.status === 'success' ? 'success' : 'error',
                executionDuration: step.durationMs,
                lastRunOutput: step.output,
                lastRunError: step.error,
              },
            };
          }
          return {
            ...n,
            data: {
              ...(n.data as any),
              status: result.status === 'success' ? 'success' : 'idle',
            },
          };
        })
      );

      if (response.success && result.status === 'success') {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.9 },
          colors: ['#E11D2E', '#F4F4F5', '#A1A1AA'],
        });
      }
    } catch (err: any) {
      console.error('Workflow test run failed:', err);
      if (err.details && Array.isArray(err.details)) {
        setValidationErrors(err.details);
      }
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...(n.data as any),
            status: 'error',
            lastRunError: err.message,
          },
        }))
      );
    } finally {
      setIsRunning(false);
    }
  }, [nodes, edges, activeWorkflowId, workflowName, sampleEmailId, getCanvasGraph, setNodes]);

  // Load a template
  const handleSelectTemplate = useCallback(
    (template: WorkflowTemplate) => {
      setWorkflowName(template.name);
      setNodes(template.nodes as Node[]);
      setEdges(template.edges as Edge[]);
      setSelectedNodeId(null);
      setExecutionResult(null);
      setIsLogDrawerOpen(false);
    },
    [setNodes, setEdges]
  );

  const handleLoadTemplateById = useCallback(
    (templateId: string) => {
      const t = SAMPLE_WORKFLOWS.find((tmpl) => tmpl.id === templateId) || SAMPLE_WORKFLOWS[0];
      handleSelectTemplate(t);
    },
    [handleSelectTemplate]
  );

  // Clear canvas
  const handleClearWorkflow = useCallback(() => {
    if (window.confirm('Clear all nodes and reset canvas?')) {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      setExecutionResult(null);
      setIsLogDrawerOpen(false);
    }
  }, [setNodes, setEdges]);

  // Export JSON
  const handleExportWorkflow = useCallback(() => {
    const data = {
      name: workflowName,
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.toLowerCase().replace(/\s+/g, '_')}_workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [workflowName, nodes, edges]);

  // Import JSON
  const handleImportWorkflow = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          if (parsed.nodes && parsed.edges) {
            setWorkflowName(parsed.name || 'Imported Workflow');
            setNodes(parsed.nodes);
            setEdges(parsed.edges);
            setSelectedNodeId(null);
          }
        } catch (err) {
          alert('Invalid workflow JSON file.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [setNodes, setEdges]
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg select-none text-text">
      {/* Top Header */}
      <BuilderHeader
        workflowName={workflowName}
        onRenameWorkflow={setWorkflowName}
        isRunning={isRunning}
        onRunWorkflow={handleRunWorkflow}
        onSaveWorkflow={handleSaveWorkflow}
        isSaving={isSaving}
        isSaved={isSaved}
        sampleEmailId={sampleEmailId}
        onSelectSampleEmail={setSampleEmailId}
        sampleEmails={sampleEmails}
        validationErrors={validationErrors}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleLogs={() => setIsLogDrawerOpen(!isLogDrawerOpen)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onExportWorkflow={handleExportWorkflow}
        onImportWorkflow={handleImportWorkflow}
        onClearWorkflow={handleClearWorkflow}
        hasLogs={executionResult !== null}
        nodeCount={nodes.length}
      />

      {/* Main Workspace: Sidebar + Canvas */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Node Library Sidebar */}
        <NodeLibrary onAddNode={handleAddNode} />

        {/* React Flow Canvas */}
        <main className="flex-1 h-full relative">
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDropNode={handleDropNode}
          />
        </main>

        {/* Node Configuration Drawer (Right) */}
        <NodeConfigDrawer
          node={selectedNode}
          upstreamNodes={upstreamNodes}
          isOpen={selectedNode !== null}
          onClose={() => setSelectedNodeId(null)}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          apiKeys={apiKeys}
        />
      </div>

      {/* Bottom Execution Trace Drawer */}
      <ExecutionDrawer
        result={executionResult}
        isOpen={isLogDrawerOpen && executionResult !== null}
        onClose={() => setIsLogDrawerOpen(false)}
      />

      {/* Hidden File Input for Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* AI Assistant Co-Pilot Side Panel */}
      <AiAssistantPanel
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        selectedModel={selectedAiModel}
        onSelectModel={setSelectedAiModel}
        apiKeys={apiKeys}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onAddNodeToCanvas={handleAddNode}
        onRunWorkflow={handleRunWorkflow}
        onClearWorkflow={handleClearWorkflow}
        onLoadTemplate={handleLoadTemplateById}
      />

      {/* Templates Modal */}
      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeys={apiKeys}
        onSaveKeys={setApiKeys}
      />
    </div>
  );
}
