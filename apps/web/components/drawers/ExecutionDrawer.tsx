'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Terminal,
} from 'lucide-react';

export interface ExecutionStepLog {
  nodeId: string;
  nodeName?: string;
  nodeType: string;
  status: 'running' | 'success' | 'failed' | 'skipped' | 'waiting' | 'idle' | 'error';
  durationMs?: number;
  input?: any;
  output?: any;
  error?: string | null;
  startedAt?: string;
  finishedAt?: string;
}

export interface ExecutionDrawerData {
  executionId?: string;
  runId?: string;
  workflowId?: string;
  status?: string;
  success?: boolean;
  error?: string | null;
  durationMs?: number;
  totalDurationMs?: number;
  steps?: ExecutionStepLog[];
  logs?: ExecutionStepLog[];
}

interface ExecutionDrawerProps {
  result: ExecutionDrawerData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExecutionDrawer({ result, isOpen, onClose }: ExecutionDrawerProps) {
  const [selectedLogIndex, setSelectedLogIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'output' | 'input'>('output');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !result) return null;

  const rawSteps = result.steps || result.logs || [];
  const currentStep: ExecutionStepLog | undefined = rawSteps[selectedLogIndex];

  const isSuccess =
    result.status === 'success' ||
    result.success === true ||
    (result.status !== 'failed' && !result.error);

  const duration = result.durationMs ?? result.totalDurationMs ?? 0;
  const executionId = result.executionId || result.runId || 'exec_local';

  const handleCopy = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayedPayload =
    activeTab === 'output'
      ? (currentStep?.output ?? (currentStep as any)?.outputPayload)
      : (currentStep?.input ?? (currentStep as any)?.inputPayload);

  return (
    <div
      className={`fixed bottom-0 inset-x-0 bg-[#0A0A0B] border-t border-[#2A2A2F] shadow-2xl z-40 flex flex-col font-sans transition-all duration-300 ${
        isExpanded ? 'h-[520px]' : 'h-[340px]'
      }`}
    >
      {/* Header bar */}
      <div className="px-5 py-2.5 bg-[#121214] border-b border-[#2A2A2F] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {isSuccess ? (
              <span className="flex items-center gap-1 text-[#F4F4F5] bg-[#1A1A1D] border border-[#2A2A2F] px-2.5 py-0.5 rounded-full font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#F4F4F5]" />
                Workflow Executed Successfully
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#FF4D5A] bg-[rgba(225,29,46,0.12)] border border-[#E11D2E] px-2.5 py-0.5 rounded-full font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-[#E11D2E]" />
                Execution Failed
              </span>
            )}
          </div>

          <span className="text-[#2A2A2F]">•</span>
          <span className="flex items-center gap-1 text-xs text-[#A1A1AA] font-mono">
            <Clock className="w-3 h-3 text-[#A1A1AA]" />
            {duration}ms
          </span>

          <span className="text-[#2A2A2F]">•</span>
          <span className="text-[11px] text-[#A1A1AA] font-mono">ID: {executionId}</span>

          {result.error && (
            <>
              <span className="text-[#2A2A2F]">•</span>
              <span className="text-[11px] text-[#FF4D5A] font-mono truncate max-w-xs">
                {result.error}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-[#A1A1AA] hover:text-[#F4F4F5] rounded hover:bg-[#1A1A1D] transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A1A1AA] hover:text-[#F4F4F5] rounded hover:bg-[#1A1A1D] transition-colors"
            title="Close execution viewer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Step list column */}
        <div className="w-72 border-r border-[#2A2A2F] overflow-y-auto p-2 space-y-1 bg-[#0A0A0B]">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#A1A1AA] font-mono flex items-center justify-between">
            <span>Execution Steps</span>
            <span className="bg-[#1A1A1D] px-1.5 py-0.5 rounded text-[9px] text-[#F4F4F5]">
              {rawSteps.length}
            </span>
          </div>

          {rawSteps.length === 0 ? (
            <div className="p-3 text-center text-xs text-[#A1A1AA]">No steps recorded</div>
          ) : (
            rawSteps.map((step, idx) => {
              const isStepSuccess = step.status === 'success';
              const name = step.nodeName || step.nodeId;
              return (
                <button
                  key={step.nodeId + idx}
                  onClick={() => setSelectedLogIndex(idx)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                    selectedLogIndex === idx
                      ? 'bg-[#1A1A1D] text-[#F4F4F5] border border-[#2A2A2F]'
                      : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#121214]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isStepSuccess ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#F4F4F5] shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-[#E11D2E] shrink-0" />
                    )}
                    <span className="truncate font-medium">{name}</span>
                  </div>
                  {step.durationMs !== undefined && (
                    <span className="text-[10px] font-mono text-[#A1A1AA] shrink-0 ml-2">
                      {step.durationMs}ms
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Selected step details */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#121214]">
          {currentStep ? (
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[#2A2A2F]">
                <div>
                  <h4 className="text-xs font-semibold text-[#F4F4F5] flex items-center gap-2">
                    <span>{currentStep.nodeName || currentStep.nodeId}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A1D] text-[#A1A1AA] border border-[#2A2A2F]">
                      {currentStep.nodeType}
                    </span>
                  </h4>
                  <div className="text-[10px] text-[#A1A1AA] font-mono mt-0.5">
                    Node ID: {currentStep.nodeId}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg bg-[#0A0A0B] p-0.5 border border-[#2A2A2F] text-[10px] font-mono">
                    <button
                      onClick={() => setActiveTab('output')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        activeTab === 'output'
                          ? 'bg-[#E11D2E] text-white font-medium'
                          : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                      }`}
                    >
                      Output
                    </button>
                    <button
                      onClick={() => setActiveTab('input')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        activeTab === 'input'
                          ? 'bg-[#E11D2E] text-white font-medium'
                          : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                      }`}
                    >
                      Input
                    </button>
                  </div>

                  <button
                    onClick={() => handleCopy(displayedPayload)}
                    className="flex items-center gap-1 text-[11px] font-mono text-[#A1A1AA] hover:text-[#F4F4F5] px-2.5 py-1 rounded bg-[#1A1A1D] border border-[#2A2A2F] transition-colors"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-[#F4F4F5]" />
                    ) : (
                      <Copy className="w-3 h-3 text-[#A1A1AA]" />
                    )}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {currentStep.error && (
                <div className="mt-2.5 p-2 rounded-lg bg-[rgba(225,29,46,0.12)] border border-[#E11D2E] text-xs font-mono text-[#FF4D5A]">
                  Error: {currentStep.error}
                </div>
              )}

              {/* JSON Payload viewer */}
              <div className="flex-1 overflow-auto mt-3 rounded-lg bg-[#0A0A0B] p-3 border border-[#2A2A2F] text-[11px] font-mono text-[#F4F4F5] leading-relaxed">
                <pre>{JSON.stringify(displayedPayload, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#A1A1AA] text-xs gap-2">
              <Terminal className="w-6 h-6 text-[#2A2A2F]" />
              <span>Select an execution step on the left to inspect its input and output.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
