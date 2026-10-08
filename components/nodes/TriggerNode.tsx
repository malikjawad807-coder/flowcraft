import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  FileUp,
  FileText,
  FormInput,
  Webhook,
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings2,
  ArrowRight,
} from 'lucide-react';
import { WorkflowNodeData } from '@/types/workflow';

export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const { nodeType, label, status, executionDuration, lastRunError, config } = nodeData;

  const isForm = nodeType === 'input_form_trigger';
  const isFile = nodeType === 'file_upload_trigger';
  const isWebhook = nodeType === 'webhook_trigger';

  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  return (
    <div
      className={`relative min-w-[280px] max-w-[340px] rounded-xl bg-slate-900/95 border transition-all duration-200 backdrop-blur-md shadow-xl ${
        selected
          ? 'border-emerald-400 ring-2 ring-emerald-400/30 shadow-emerald-500/10'
          : isError
          ? 'border-rose-500 shadow-rose-500/20'
          : isSuccess
          ? 'border-emerald-600/60 shadow-emerald-950/40'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Node Header Banner */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-emerald-950/60 via-slate-900/80 to-slate-900 border-b border-slate-800/80 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            {isFile && <FileUp className="w-4 h-4" />}
            {isForm && <FormInput className="w-4 h-4" />}
            {isWebhook && <Webhook className="w-4 h-4" />}
            {!isFile && !isForm && !isWebhook && <Zap className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-400 font-mono">
                Trigger
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {isFile ? 'File Event' : isForm ? 'Form Event' : 'Webhook'}
              </span>
            </div>
            <h3 className="text-xs font-semibold text-slate-100 truncate max-w-[170px]" title={label}>
              {label || 'Trigger Event'}
            </h3>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1">
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded-full animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running
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
        {isFile && (
          <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/70 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-medium text-slate-200 truncate max-w-[140px]">
                  {config?.sampleFileName || 'document.json'}
                </span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
                JSON/PDF
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {config?.parsedData
                ? `Keys: ${Object.keys(config.parsedData).slice(0, 3).join(', ')}...`
                : 'Ready for file payload'}
            </div>
          </div>
        )}

        {isForm && (
          <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/70 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium truncate max-w-[150px]">
                {config?.formTitle || 'Lead & Inquiries Form'}
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                {config?.fields?.length || 4} fields
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
              <span className="text-emerald-400 font-mono">Input:</span>
              <span className="truncate">
                {config?.submittedValues?.customerName ||
                  config?.submittedValues?.name ||
                  'Configured form input values'}
              </span>
            </div>
          </div>
        )}

        {isWebhook && (
          <div className="bg-slate-950/70 rounded-lg p-2 border border-slate-800/70 flex items-center justify-between text-[11px]">
            <span className="font-mono text-emerald-400 font-semibold text-[10px] bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/50">
              POST
            </span>
            <span className="font-mono text-slate-400 text-[10px] truncate max-w-[180px]">
              /api/v1/webhook/{id.slice(0, 6)}
            </span>
          </div>
        )}

        {/* Footer info & hint */}
        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 border-t border-slate-800/50">
          <span className="flex items-center gap-1 text-slate-400">
            <Settings2 className="w-3 h-3 text-slate-500" /> Click to configure
          </span>
          <span className="text-emerald-400/80 font-mono flex items-center gap-0.5">
            Output <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>

      {/* React Flow Output Handle (Only Right for Triggers) */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${id}-out`}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
    </div>
  );
});

TriggerNode.displayName = 'TriggerNode';
