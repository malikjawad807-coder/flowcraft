import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { WorkflowNodeData } from '@/types/workflow';

export const ConditionNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const { label, status, executionDuration, lastRunOutput, config } = nodeData;

  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <div
      className={`relative min-w-[280px] max-w-[340px] rounded-xl bg-slate-900/95 border transition-all duration-200 backdrop-blur-md shadow-xl ${
        selected
          ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-amber-500/10'
          : isError
          ? 'border-rose-500 shadow-rose-500/20'
          : isSuccess
          ? 'border-emerald-600/60 shadow-emerald-950/40'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={`${id}-in`}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />

      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-amber-950/70 via-slate-900/80 to-slate-900 border-b border-slate-800/80 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-amber-400 font-mono">
                Condition
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-[10px] text-amber-300 font-mono">Router</span>
            </div>
            <h3 className="text-xs font-semibold text-slate-100 truncate max-w-[170px]" title={label}>
              {label || 'If / Else'}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-amber-300 font-mono bg-amber-950/80 border border-amber-700/60 px-2 py-0.5 rounded-full animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              Checking
            </span>
          )}
          {isSuccess && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-mono bg-emerald-950/50 border border-emerald-800/60 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {executionDuration ? `${executionDuration}ms` : 'Ready'}
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-1 text-[10px] text-rose-400 font-mono bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" />
              Error
            </span>
          )}
        </div>
      </div>

      <div className="p-3 text-xs space-y-2">
        <div className="bg-slate-950/70 rounded-lg p-2 border border-slate-800/70 font-mono text-[10px] text-amber-300">
          <span>if ({config?.field || 'input.status'} {config?.operator || '=='} &quot;{config?.value || 'active'}&quot;)</span>
        </div>
        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 border-t border-slate-800/50">
          <span className="flex items-center gap-0.5 text-slate-500 font-mono">
            <ArrowLeft className="w-2.5 h-2.5" /> Condition
          </span>
          <span className="text-emerald-400 font-mono">True ↘</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id={`${id}-true`}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
    </div>
  );
});

ConditionNode.displayName = 'ConditionNode';
