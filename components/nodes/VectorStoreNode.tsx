'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Database,
  Search,
  BrainCircuit,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  ArrowRight,
  HardDrive,
} from 'lucide-react';
import { WorkflowNodeData } from '@/types/workflow';

export const VectorStoreNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const { label, status, executionDuration, lastRunOutput, config } = nodeData;

  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const provider = config?.provider || 'pinecone';
  const indexName = config?.indexName || 'executive-longterm-memory';
  const topK = config?.topK ?? 3;
  const searchQuery = config?.searchQuery || '{{input_form_trigger.query}}';

  return (
    <div
      className={`relative min-w-[300px] max-w-[360px] rounded-xl bg-slate-900/95 border transition-all duration-200 backdrop-blur-md shadow-xl ${
        selected
          ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-cyan-500/10'
          : isError
          ? 'border-rose-500 shadow-rose-500/20'
          : isSuccess
          ? 'border-cyan-600/60 shadow-cyan-950/40'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Input Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${id}-in`}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />

      {/* Node Header Banner */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-cyan-950/70 via-slate-900/80 to-slate-900 border-b border-slate-800/80 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-cyan-400 font-mono">
                {provider === 'pinecone' ? 'Pinecone' : provider === 'chroma' ? 'ChromaDB' : 'Vector Store'}
              </span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Memory Tool
              </span>
            </div>
            <h4 className="text-xs font-bold text-white tracking-tight leading-tight truncate max-w-[170px]">
              {label || 'Vector Database Memory'}
            </h4>
          </div>
        </div>

        {/* Execution Status Badge */}
        <div>
          {isRunning && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-[10px] text-cyan-300 font-mono animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Querying</span>
            </div>
          )}
          {isSuccess && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-[10px] text-emerald-300 font-mono">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Grounded</span>
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-[10px] text-rose-300 font-mono">
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>Failed</span>
            </div>
          )}
          {!isRunning && !isSuccess && !isError && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              Top-{topK}
            </span>
          )}
        </div>
      </div>

      {/* Node Body Details */}
      <div className="p-3.5 space-y-2.5 text-xs">
        {/* Index / Collection Info */}
        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Target Index:</span>
            <span className="font-mono text-cyan-300 font-semibold truncate max-w-[160px]">
              {indexName}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Semantic Search</span>
            <span className="font-mono text-slate-400">Similarity: Cosine</span>
          </div>
        </div>

        {/* Query Preview */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Search className="w-3 h-3 text-cyan-400" />
              <span>Search Query:</span>
            </span>
            <span className="font-mono text-[9px] text-cyan-400">Top-K: {topK}</span>
          </div>
          <p className="font-mono text-[11px] text-slate-300 bg-slate-950/90 p-2 rounded-lg border border-slate-800 line-clamp-2 leading-relaxed">
            {searchQuery}
          </p>
        </div>

        {/* Execution Output Preview */}
        {lastRunOutput && (
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Retrieved Context:</span>
              <span className="font-mono text-emerald-400 font-bold">
                {lastRunOutput.memoryFound ? '● Memory Grounded' : '○ New Lead / Entity'}
              </span>
            </div>
            {lastRunOutput.matches && (
              <div className="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800 line-clamp-2">
                {Array.isArray(lastRunOutput.matches)
                  ? `${lastRunOutput.matches.length} memory records retrieved`
                  : String(lastRunOutput.matches)}
              </div>
            )}
            {executionDuration !== undefined && (
              <div className="text-[9px] text-slate-500 text-right font-mono">
                Duration: {executionDuration}ms
              </div>
            )}
          </div>
        )}
      </div>

      {/* Output Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${id}-out`}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
    </div>
  );
});

VectorStoreNode.displayName = 'VectorStoreNode';
