'use client';

import React, { useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  Copy,
  Check,
  Code2,
  Maximize2,
  Minimize2,
  Terminal,
} from 'lucide-react';
import { WorkflowExecutionResult, WorkflowExecutionLog } from '@/types/workflow';

interface ExecutionDrawerProps {
  result: WorkflowExecutionResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExecutionDrawer({ result, isOpen, onClose }: ExecutionDrawerProps) {
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !result) return null;

  const currentLog: WorkflowExecutionLog | undefined = result.logs[selectedLogIndex];

  const handleCopy = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalTokens = result.logs.reduce((acc, log) => acc + (log.tokensUsed || 0), 0);

  return (
    <div
      className={`fixed bottom-0 inset-x-0 bg-[#0e121a] border-t border-slate-800 shadow-2xl z-40 flex flex-col font-sans transition-all duration-300 ${
        isExpanded ? 'h-[520px]' : 'h-[320px]'
      }`}
    >
      {/* Header bar */}
      <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {result.success ? (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Workflow Executed Successfully
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded-full font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                Execution Failed
              </span>
            )}
          </div>

          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1 text-xs text-slate-400 font-mono">
            <Clock className="w-3 h-3 text-slate-500" />
            {result.totalDurationMs}ms
          </span>

          {totalTokens > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-xs text-purple-400 font-mono">
                <Coins className="w-3 h-3 text-purple-400" />
                {totalTokens} tokens
              </span>
            </>
          )}

          <span className="text-slate-600">•</span>
          <span className="text-[11px] text-slate-500 font-mono">ID: {result.runId}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            title="Close log viewer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Step list column */}
        <div className="w-72 border-r border-slate-800/80 overflow-y-auto p-2 space-y-1 bg-slate-950/40">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
            Execution Steps ({result.logs.length})
          </div>
          {result.logs.map((log, idx) => (
            <button
              key={log.nodeId + idx}
              onClick={() => setSelectedLogIndex(idx)}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                selectedLogIndex === idx
                  ? 'bg-slate-800/90 text-white border border-slate-700/80 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {log.status === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span className="truncate font-medium">{log.nodeName}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                {log.durationMs}ms
              </span>
            </button>
          ))}
        </div>

        {/* Selected step details */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/20">
          {currentLog ? (
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div>
                  <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                    <span>{currentLog.nodeName}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {currentLog.nodeType}
                    </span>
                  </h4>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Node ID: {currentLog.nodeId}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {currentLog.tokensUsed && (
                    <span className="text-[11px] text-purple-400 font-mono flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      {currentLog.tokensUsed} tokens
                    </span>
                  )}
                  <button
                    onClick={() => handleCopy(currentLog.outputPayload)}
                    className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy Payload'}
                  </button>
                </div>
              </div>

              {/* JSON Payload viewer */}
              <div className="flex-1 overflow-auto mt-3 rounded-lg bg-slate-950 p-3 border border-slate-800/80 text-[11px] font-mono text-emerald-400 leading-relaxed">
                <pre>{JSON.stringify(currentLog.outputPayload, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
              Select an execution step to view payload details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
