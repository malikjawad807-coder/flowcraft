'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';

import { TriggerNode } from '@/components/nodes/TriggerNode';
import { AiNode } from '@/components/nodes/AiNode';
import { GmailNode } from '@/components/nodes/GmailNode';
import { TransformNode } from '@/components/nodes/TransformNode';
import { ConditionNode } from '@/components/nodes/ConditionNode';
import { WorkflowEdge } from '@/components/canvas/CustomEdges';
import { NodeType, WorkflowNodeData } from '@/types/workflow';

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onDropNode: (type: NodeType, position: { x: number; y: number }) => void;
}

function InnerWorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onDropNode,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const nodeTypes = useMemo(
    () => ({
      trigger: TriggerNode,
      input_form_trigger: TriggerNode,
      file_upload_trigger: TriggerNode,
      webhook_trigger: TriggerNode,
      openai_llm: AiNode,
      openai_classifier: AiNode,
      gmail_send: GmailNode,
      code_transform: TransformNode,
      condition_filter: ConditionNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      workflowEdge: WorkflowEdge,
    }),
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      onDropNode(type, position);
    },
    [screenToFlowPosition, onDropNode]
  );

  return (
    <div className="w-full h-full relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'workflowEdge',
          animated: true,
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="#21262d"
          gap={20}
          size={1.5}
          variant={BackgroundVariant.Dots}
        />
        <Controls
          showInteractive={false}
          className="m-4"
        />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="m-4"
          nodeColor={(n: any) => {
            const cat = n.data?.category;
            if (cat === 'trigger') return '#059669';
            if (cat === 'ai') return '#7c3aed';
            if (cat === 'action') return '#dc2626';
            if (cat === 'logic') return '#0284c7';
            return '#475569';
          }}
        />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerWorkflowCanvas {...props} />
    </ReactFlowProvider>
  );
}
