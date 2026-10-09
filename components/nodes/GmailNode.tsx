import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Mail,
  Send,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Key,
  Users,
} from 'lucide-react';
import { WorkflowNodeData } from '@/types/workflow';

export const GmailNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const { label, status, executionDuration, lastRunOutput, config } = nodeData;

  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const isBulk = config?.sendMode === 'bulk';
  const hasAppPassword = Boolean(config?.customAppPassword);
  const authMethod = config?.authMethod || (hasAppPassword ? 'app_password' : 'global');
  const recipient = config?.to || 'recipient@example.com';
  const subject = config?.subject || 'Workflow automated message';
  const isDraft = config?.sendAsDraft;

  return (
    <div
      className={`relative min-w-[300px] max-w-[360px] rounded-xl bg-slate-900/95 border transition-all duration-200 backdrop-blur-md shadow-xl ${
        selected
          ? 'border-red-400 ring-2 ring-red-400/30 shadow-red-500/10'
          : isError
          ? 'border-rose-500 shadow-rose-500/20'
          : isSuccess
          ? 'border-emerald-600/60 shadow-emerald-950/40'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Input Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${id}-in`}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />

      {/* Node Header Banner */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-red-950/70 via-slate-900/80 to-slate-900 border-b border-slate-800/80 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-inner">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-red-400 font-mono">
                Gmail API
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-[10px] text-red-300 font-mono bg-red-950/80 px-1 rounded border border-red-800/40">
                {isDraft ? 'Draft' : 'Send'}
              </span>
            </div>
            <h3 className="text-xs font-semibold text-slate-100 truncate max-w-[170px]" title={label}>
              {label || 'Send Email'}
            </h3>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1">
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-red-300 font-mono bg-red-950/80 border border-red-700/60 px-2 py-0.5 rounded-full animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-red-400" />
              Sending
            </span>
          )}
          {isSuccess && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-mono bg-emerald-950/50 border border-emerald-800/60 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {executionDuration ? `${executionDuration}ms` : 'Dispatched'}
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
        {/* Mode & Auth Badges */}
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${
              isBulk
                ? 'text-amber-400 bg-amber-950/60 border-amber-800/50'
                : 'text-red-400 bg-red-950/60 border-red-800/50'
            }`}
          >
            {isBulk ? <Users className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
            {isBulk ? 'Bulk List Send' : 'Single Email'}
          </span>

          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-slate-300 bg-slate-900 border-slate-800"
            title={authMethod === 'app_password' ? 'Authenticating via personal Gmail App Password' : 'Using OAuth or Global Credentials'}
          >
            <Key className="w-3 h-3 text-[#ff6d5a]" />
            {authMethod === 'app_password' ? 'App Password' : authMethod === 'oauth_token' ? 'OAuth Token' : 'Default Auth'}
          </span>
        </div>

        <div className="bg-slate-950/70 rounded-lg p-2.5 border border-slate-800/70 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 truncate">
            <span className="text-red-400 font-mono text-[10px] uppercase font-semibold">
              {isBulk ? 'Recipients:' : 'To:'}
            </span>
            <span className="font-mono text-slate-300 truncate">
              {isBulk ? '{{upstream.recipients}}' : recipient}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            <span className="text-slate-500">Subject: </span>
            <span className="text-slate-200 font-medium">{subject}</span>
          </div>
        </div>

        {/* Output snippet or Delivery Status */}
        {lastRunOutput ? (
          <div className="bg-emerald-950/30 rounded-lg p-2 border border-emerald-900/40 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-[10px] text-emerald-300 font-mono">
              <span className="flex items-center gap-1">
                <FileCheck className="w-3 h-3 text-emerald-400" />
                {isBulk ? `${lastRunOutput.totalSent || 0} Emails Sent` : 'Delivered'}
              </span>
              <span className="text-slate-400 truncate max-w-[120px]">
                {lastRunOutput.messageId || (lastRunOutput.totalSent ? 'Batch Complete' : 'Sent')}
              </span>
            </div>
            <div className="text-slate-300 font-sans line-clamp-1 text-[11px]">
              {isBulk
                ? `Bulk delivery finished: ${lastRunOutput.totalSent} succeeded, ${lastRunOutput.totalFailed || 0} failed.`
                : `Sent to: ${lastRunOutput.to}`}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1 font-mono">
              <Send className="w-3 h-3 text-slate-600" /> {isBulk ? 'Sequential Rate Pacing' : 'Gmail SMTP / OAuth'}
            </span>
            <span className="text-slate-500 font-mono">HTML & Plain Text</span>
          </div>
        )}

        {/* Footer info & handles */}
        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 border-t border-slate-800/50">
          <span className="flex items-center gap-0.5 text-slate-500 font-mono">
            <ArrowLeft className="w-2.5 h-2.5" /> Upstream Data
          </span>
          <span className="text-red-400/90 font-mono flex items-center gap-0.5">
            Receipts <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>

      {/* Output Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${id}-out`}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-slate-900 hover:!scale-125 transition-transform"
      />
    </div>
  );
});

GmailNode.displayName = 'GmailNode';
