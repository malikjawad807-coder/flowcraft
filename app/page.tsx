'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { UniversalExtractorModal } from '@/components/extractor/UniversalExtractorModal';
import { EmailComposerModal } from '@/components/email/EmailComposerModal';
import { AiAssistantPanel, AI_MODELS } from '@/components/ai-assistant/AiAssistantPanel';
import { ExtractedEmail } from '@/lib/email-extractor';
import { SAMPLE_WORKFLOWS } from '@/lib/sample-workflows';
import { HeroPage } from '@/components/hero/HeroPage';
import {
  NodeType,
  WorkflowNodeData,
  WorkflowExecutionResult,
  WorkflowTemplate,
} from '@/types/workflow';

export default function WorkflowBuilderPage() {
  const initialWorkflow = SAMPLE_WORKFLOWS[0];

  // Active view: 'hero' or 'builder'
  const [activeView, setActiveView] = useState<'hero' | 'builder'>('hero');

  const [workflowName, setWorkflowName] = useState(initialWorkflow.name);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow.edges as Edge[]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<WorkflowExecutionResult | null>(null);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);

  // Modals & Panels
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExtractorOpen, setIsExtractorOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);

  // Extractor & Email Composer state
  const [extractedEmails, setExtractedEmails] = useState<ExtractedEmail[]>([]);
  const [composerMode, setComposerMode] = useState<'single' | 'bulk'>('single');
  const [targetComposerEmails, setTargetComposerEmails] = useState<ExtractedEmail[]>([]);

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

  // Connection handler
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'workflowEdge',
            animated: true,
            style: { stroke: '#475569', strokeWidth: 2 },
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
        x: 100 + Math.random() * 300,
        y: 100 + Math.random() * 250,
      };

      let category: WorkflowNodeData['category'] = 'logic';
      let label = 'New Node';
      let config: Record<string, any> = {};

      switch (type) {
        case 'email_list_file_upload':
          category = 'trigger';
          label = 'Email List CSV';
          config = {
            fileName: 'sample_leads.csv',
            rawContent: 'email,name,company,role\nalex@techcorp.io,Alex,TechCorp,VP Engineering\nsarah@growthlab.com,Sarah,GrowthLab,Director\njordan@cloudpulse.ai,Jordan,CloudPulse,Head of AI',
            emailColumn: 'email',
            nameColumn: 'name',
            companyColumn: 'company',
            recipients: [
              { email: 'alex@techcorp.io', name: 'Alex', company: 'TechCorp', role: 'VP Engineering', isValid: true },
              { email: 'sarah@growthlab.com', name: 'Sarah', company: 'GrowthLab', role: 'Director', isValid: true },
              { email: 'jordan@cloudpulse.ai', name: 'Jordan', company: 'CloudPulse', role: 'Head of AI', isValid: true },
            ],
            totalCount: 3,
            validCount: 3,
            invalidCount: 0,
          };
          break;

        case 'input_form_trigger':
          category = 'trigger';
          label = 'Input Form';
          config = {
            formTitle: 'User Feedback / Lead Intake',
            formDescription: 'Collect data directly via canvas form',
            fields: [
              { id: 'f1', name: 'name', label: 'Name', type: 'text', defaultValue: 'Jordan Lee', required: true },
              { id: 'f2', name: 'email', label: 'Email', type: 'email', defaultValue: 'jordan@example.com', required: true },
              { id: 'f3', name: 'notes', label: 'Inquiry Details', type: 'textarea', defaultValue: 'Inquiring about workflow automation setup.', required: true },
            ],
            submittedValues: {
              name: 'Jordan Lee',
              email: 'jordan@example.com',
              notes: 'Inquiring about workflow automation setup.',
            },
          };
          break;

        case 'file_upload_trigger':
          category = 'trigger';
          label = 'File Upload';
          config = {
            sampleFileName: 'incoming_payload.json',
            sampleFileContent: JSON.stringify({ documentId: 'doc_101', status: 'pending_review', author: 'Alex' }, null, 2),
            parsedData: { documentId: 'doc_101', status: 'pending_review', author: 'Alex' },
          };
          break;

        case 'webhook_trigger':
          category = 'trigger';
          label = 'Webhook Event';
          config = {
            endpoint: '/api/v1/webhook',
            payload: { event: 'user_created', userId: 'u_123', email: 'hello@example.com' },
          };
          break;

        case 'openai_llm':
          category = 'ai';
          label = 'OpenAI Reasoning';
          config = {
            apiKeySource: 'global',
            model: 'gpt-4o-mini',
            executionMode: 'single',
            systemPrompt: 'You are an intelligent workflow automation AI.',
            userPrompt: 'Draft a personalized outreach pitch to {{item.name}} at {{item.company}}.',
            temperature: 0.7,
            maxTokens: 500,
            mockFallback: true,
          };
          break;

        case 'openai_classifier':
          category = 'ai';
          label = 'AI Sentiment Router';
          config = {
            apiKeySource: 'global',
            model: 'gpt-4o-mini',
            executionMode: 'single',
            systemPrompt: 'You are an AI sentiment and priority classifier.',
            userPrompt: 'Determine priority (High / Medium / Low) and tone of the input message.',
            temperature: 0.3,
            maxTokens: 300,
            mockFallback: true,
          };
          break;

        case 'vector_store':
          category = 'ai';
          label = 'Vector Database Memory';
          config = {
            provider: 'pinecone',
            indexName: 'executive-longterm-memory',
            topK: 3,
            searchQuery: '{{input_form_trigger.submittedValues.notes}}',
            similarityMetric: 'cosine',
            namespace: 'vip-leads',
          };
          break;

        case 'gmail_send':
          category = 'action';
          label = 'Gmail Dispatch';
          config = {
            authMethod: 'sandbox',
            sendMode: 'single',
            to: 'recipient@example.com',
            subject: 'Automated Notification',
            body: 'Hello,\n\nThis is an automated workflow confirmation message.',
            isHtml: false,
            sendAsDraft: false,
          };
          break;

        case 'code_transform':
          category = 'logic';
          label = 'Code Transform';
          config = {
            code: 'return { ...input, timestamp: Date.now(), processed: true };',
          };
          break;

        case 'condition_filter':
          category = 'logic';
          label = 'If / Else Branch';
          config = {
            field: 'status',
            operator: 'equals',
            value: 'active',
          };
          break;
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

  // Drop node onto canvas coordinates
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
                ...n.data,
                ...updatedData,
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

  // Run Workflow execution engine
  const handleRunWorkflow = useCallback(async () => {
    if (nodes.length === 0 || isRunning) return;

    setIsRunning(true);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: 'running',
        },
      }))
    );

    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: {
          ...e.data,
          isRunning: true,
        },
      }))
    );

    try {
      const res = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          edges,
          apiKeys,
        }),
      });

      const result: WorkflowExecutionResult = await res.json();
      setExecutionResult(result);
      setIsLogDrawerOpen(true);

      const logMap = new Map(result.logs.map((l) => [l.nodeId, l]));

      setNodes((nds) =>
        nds.map((n) => {
          const log = logMap.get(n.id);
          if (log) {
            return {
              ...n,
              data: {
                ...n.data,
                status: log.status,
                executionDuration: log.durationMs,
                lastRunOutput: log.outputPayload,
                lastRunError: log.error,
              },
            };
          }
          return {
            ...n,
            data: {
              ...n.data,
              status: result.success ? 'success' : 'idle',
            },
          };
        })
      );

      if (result.success) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.15 },
          colors: ['#ff6d5a', '#7c3aed', '#10b981', '#38bdf8'],
        });
      }
    } catch (err: any) {
      console.error('Execution error:', err);
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, status: 'error' },
        }))
      );
    } finally {
      setIsRunning(false);
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          data: {
            ...e.data,
            isRunning: false,
            isSuccess: true,
          },
        }))
      );
    }
  }, [nodes, edges, apiKeys, isRunning, setNodes, setEdges]);

  // Keyboard shortcut Ctrl+Enter to run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunWorkflow();
      }
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setIsLogDrawerOpen(false);
        setIsExtractorOpen(false);
        setIsComposerOpen(false);
        setIsAiAssistantOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRunWorkflow]);

  // Load Template
  const handleSelectTemplate = (template: WorkflowTemplate) => {
    setWorkflowName(template.name);
    setNodes(template.nodes as Node[]);
    setEdges(template.edges as Edge[]);
    setSelectedNodeId(null);
    setExecutionResult(null);
  };

  const handleLoadTemplateById = (templateId: string) => {
    const t = SAMPLE_WORKFLOWS.find((tmpl) => tmpl.id === templateId);
    if (t) handleSelectTemplate(t);
  };

  // Export Workflow as JSON
  const handleExportWorkflow = () => {
    const data = {
      name: workflowName,
      version: '1.0',
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Workflow JSON
  const handleImportWorkflow = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.nodes && Array.isArray(json.nodes)) {
          setWorkflowName(json.name || 'Imported Workflow');
          setNodes(json.nodes);
          setEdges(json.edges || []);
          setSelectedNodeId(null);
          setExecutionResult(null);
        } else {
          alert('Invalid workflow file format: Missing nodes array');
        }
      } catch (err) {
        alert('Could not parse JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Clear workflow
  const handleClearWorkflow = () => {
    if (confirm('Are you sure you want to clear the canvas?')) {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
      setExecutionResult(null);
    }
  };

  // Extractor Actions: Bulk Send, Single Send, Inject into canvas
  const handleBulkSendFromExtractor = (selected: ExtractedEmail[]) => {
    setTargetComposerEmails(selected);
    setComposerMode('bulk');
    setIsExtractorOpen(false);
    setIsComposerOpen(true);
  };

  const handleSingleSendFromExtractor = (email: ExtractedEmail) => {
    setTargetComposerEmails([email]);
    setComposerMode('single');
    setIsExtractorOpen(false);
    setIsComposerOpen(true);
  };

  const handleInjectIntoCanvas = (emailsToInject: ExtractedEmail[]) => {
    const id = `node_email_list_${Math.random().toString(36).substring(2, 7)}`;
    const recipients = emailsToInject.map((e) => ({
      email: e.email,
      domain: e.domain,
      provider: e.provider,
      isValid: true,
    }));

    const newNode: Node = {
      id,
      type: 'email_list_file_upload',
      position: { x: 80, y: 160 },
      data: {
        id,
        label: `Extracted Emails (${emailsToInject.length})`,
        category: 'trigger',
        nodeType: 'email_list_file_upload',
        status: 'idle',
        config: {
          fileName: 'extracted_contacts.csv',
          recipients,
          totalCount: emailsToInject.length,
          validCount: emailsToInject.length,
          invalidCount: 0,
        },
      },
    };

    setNodes((nds) => [newNode, ...nds]);
    setSelectedNodeId(id);
    setIsExtractorOpen(false);
  };

  return (
    <>
      {activeView === 'hero' ? (
        <HeroPage
          onLaunchBuilder={() => setActiveView('builder')}
          onOpenExtractor={() => setIsExtractorOpen(true)}
          onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLoadTemplate={(template) => {
            handleSelectTemplate(template);
            setActiveView('builder');
          }}
        />
      ) : (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0b0f17] select-none">
          {/* Top Header */}
          <BuilderHeader
            workflowName={workflowName}
            onRenameWorkflow={setWorkflowName}
            isRunning={isRunning}
            onRunWorkflow={handleRunWorkflow}
            onOpenTemplates={() => setIsTemplatesOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleLogs={() => setIsLogDrawerOpen(!isLogDrawerOpen)}
            onOpenExtractor={() => setIsExtractorOpen(true)}
            onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
            onExportWorkflow={handleExportWorkflow}
            onImportWorkflow={handleImportWorkflow}
            onClearWorkflow={handleClearWorkflow}
            onOpenHero={() => setActiveView('hero')}
            hasLogs={executionResult !== null}
            nodeCount={nodes.length}
            extractedEmailCount={extractedEmails.length}
            selectedAiModel={selectedAiModel}
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
        </div>
      )}

      {/* Hidden File Input for Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Universal File Drag-and-Drop & Email Extractor Modal */}
      <UniversalExtractorModal
        isOpen={isExtractorOpen}
        onClose={() => setIsExtractorOpen(false)}
        extractedEmails={extractedEmails}
        setExtractedEmails={setExtractedEmails}
        onBulkSend={handleBulkSendFromExtractor}
        onSingleSend={handleSingleSendFromExtractor}
        onInjectIntoCanvas={(id) => {
          handleInjectIntoCanvas(id);
          setActiveView('builder');
        }}
      />

      {/* Single & Bulk Email Delivery Composer Modal */}
      <EmailComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        mode={composerMode}
        targetEmails={targetComposerEmails}
        apiKeys={apiKeys}
      />

      {/* AI Assistant Co-Pilot Side Panel with Multi-Model Selector */}
      <AiAssistantPanel
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        selectedModel={selectedAiModel}
        onSelectModel={setSelectedAiModel}
        apiKeys={apiKeys}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onAddNodeToCanvas={(type) => {
          handleAddNode(type);
          setActiveView('builder');
        }}
        onRunWorkflow={() => {
          setActiveView('builder');
          handleRunWorkflow();
        }}
        onClearWorkflow={handleClearWorkflow}
        onLoadTemplate={(id) => {
          handleLoadTemplateById(id);
          setActiveView('builder');
        }}
      />

      {/* Templates Modal */}
      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTemplate={(template) => {
          handleSelectTemplate(template);
          setActiveView('builder');
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeys={apiKeys}
        onSaveKeys={setApiKeys}
      />
    </>
  );
}
