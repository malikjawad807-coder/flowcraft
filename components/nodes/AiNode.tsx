import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Sparkles,
  Bot,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Coins,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { WorkflowNodeData } from '@/types/workflow';

export const AiNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const { nodeType, label, status, executionDuration, lastRunOutput, config } = nodeData;

  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const model = config?.model || 'gpt-4o-mini';
  const promptPreview = config?.userPrompt || 'Enter prompt template...';

  return (
    <div
      className={`relative min-w-[300px] max-w-[360px] rounded-xl bg-slate-900/95 border transition-all duration-200 backdrop-blur-md shadow-xl ${
        selected
          ? 'border-purple-400 ring-2 ring-purple-400/30 shadow-purple-500/10'
          : isError
          ? 'border-rose-500 shadow-rose-500/20'
          : isSuccess
          ? 'border-purple-600/60 shadow-purple-950/40'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Input Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${id}-in`}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />

      {/* Node Header Banner */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-purple-950/70 via-slate-900/80 to-slate-900 border-b border-slate-800/80 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-purple-400 font-mono">
                OpenAI
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-[10px] text-purple-300 font-mono bg-purple-950/80 px-1 rounded border border-purple-800/40">
                {model}
              </span>
            </div>
            <h3 className="text-xs font-semibold text-slate-100 truncate max-w-[170px]" title={label}>
              {label || 'AI Completion'}
            </h3>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1">
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-purple-300 font-mono bg-purple-950/80 border border-purple-700/60 px-2 py-0.5 rounded-full animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
              Thinking
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
              Failed
            </span>
          )}
          {!isRunning && !isSuccess && !isError && (
            <span className="text-[10px] text-slate-500 font-mono bg-slate-800/60 px-2 py-0.5 rounded-full">
              Standby
            </span>
          )}
        </div>
      </div>

      {/* Node Body Details */}
      <div className="p-3 text-xs space-y-2.5">
        <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/70 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span className="text-purple-400 flex items-center gap-1">
              <Bot className="w-3 h-3" /> Prompt Template
            </span>
            <span>temp: {config?.temperature ?? 0.7}</span>
          </div>
          <p className="text-[11px] text-slate-300 font-mono line-clamp-2 leading-relaxed bg-slate-900/60 p-1.5 rounded border border-slate-800/50">
            {promptPreview}
          </p>
        </div>

        {/* Output snippet or Token summary */}
        {lastRunOutput ? (
          <div className="bg-purple-950/30 rounded-lg p-2 border border-purple-900/40 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-[10px] text-purple-300 font-mono">
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3 text-amber-400" />
                {lastRunOutput.totalTokens || 180} tokens
              </span>
              <span className="text-emerald-400 font-mono text-[9px] uppercase tracking-wide">
                Completed
              </span>
            </div>
            <div className="text-slate-300 font-sans line-clamp-2 italic text-[11px]">
              &ldquo;
              {typeof lastRunOutput.output === 'string'
                ? lastRunOutput.output.slice(0, 100)
                : JSON.stringify(lastRunOutput.output).slice(0, 100)}
              ...&rdquo;
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1 font-mono">
              <Cpu className="w-3 h-3 text-slate-600" /> Max Tokens: {config?.maxTokens || 500}
            </span>
            <span className="text-slate-500 font-mono">JSON/Text Output</span>
          </div>
        )}

        {/* Footer info & handles */}
        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 border-t border-slate-800/50">
          <span className="flex items-center gap-0.5 text-slate-500 font-mono">
            <ArrowLeft className="w-2.5 h-2.5" /> Inputs
          </span>
          <span className="text-purple-400/90 font-mono flex items-center gap-0.5">
            AI Result <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>

      {/* Output Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${id}-out`}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
    </div>
  );
});

AiNode.displayName = 'AiNode';
