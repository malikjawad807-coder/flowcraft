'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Activity,
  Check,
  X,
  Clock,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  Layers,
  Terminal,
  Calendar,
  Timer,
  Hash,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';
import { JsonViewer } from '@/components/JsonViewer';

interface ExecutionStep {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  itemIndex: number;
  status: 'running' | 'success' | 'failed' | 'skipped' | 'waiting';
  input: any;
  output: any;
  error: string | null;
  attempts: number;
  startedAt: string;
  finishedAt: string;
}

interface ExecutionDetail {
  id: string;
  workflowId: string;
  userId: string;
  mode: 'live' | 'test';
  status: 'running' | 'success' | 'failed' | 'waiting' | 'cancelled';
  triggerData: any;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export default function ExecutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const execId = (params?.id as string) || '';

  const { user, loading: authLoading } = useAuth();

  const [execution, setExecution] = useState<ExecutionDetail | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [workflowName, setWorkflowName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Retrying state
  const [retrying, setRetrying] = useState(false);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const fetchExecution = useCallback(async () => {
    if (!execId) return;
    try {
      const res = await apiFetch<{ execution: ExecutionDetail; steps: ExecutionStep[] }>(
        `/api/executions/${execId}`
      );
      if (res?.execution) {
        setExecution(res.execution);
        setSteps(res.steps || []);

        // Also fetch workflow name
        try {
          const wfRes = await apiFetch<{ workflow: { name: string } }>(
            `/api/workflows/${res.execution.workflowId}`
          );
          if (wfRes?.workflow?.name) {
            setWorkflowName(wfRes.workflow.name);
          }
        } catch {
          setWorkflowName(`Workflow ${res.execution.workflowId.slice(0, 8)}`);
        }
      } else {
        setError('Execution not found.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load execution details.');
    } finally {
      setLoading(false);
    }
  }, [execId]);

  useEffect(() => {
    if (user && execId) {
      fetchExecution();
    }
  }, [user, execId, fetchExecution]);

  // Auto-poll if execution is currently running
  useEffect(() => {
    if (execution?.status === 'running') {
      const timer = setInterval(() => {
        fetchExecution();
      }, 2500);
      return () => clearInterval(timer);
    }
  }, [execution?.status, fetchExecution]);

  const handleRetry = async () => {
    if (!execution) return;
    setRetrying(true);
    setRetryNotice(null);

    try {
      const res = await apiFetch<{ execution?: { id: string }; executionId?: string }>(
        `/api/executions/${execution.id}/retry`,
        {
          method: 'POST',
        }
      );
      const newId = res?.execution?.id || res?.executionId;
      setRetryNotice(`Retry spawned with ID: ${newId || 'new'}`);
      if (newId) {
        setTimeout(() => {
          router.push(`/executions/${newId}`);
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to trigger retry execution.');
    } finally {
      setRetrying(false);
    }
  };

  const formatDuration = (start: string | null, finish: string | null): string => {
    if (!start) return '-';
    const s = new Date(start).getTime();
    const f = finish ? new Date(finish).getTime() : Date.now();
    const ms = Math.max(0, f - s);
    if (ms < 1000) return `${ms}ms`;
    const sec = (ms / 1000).toFixed(2);
    return `${sec}s`;
  };

  const renderStatusBadge = (st: string) => {
    switch (st) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium text-text bg-surface-2 border border-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red" />
            </span>
            <span>Running</span>
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-muted bg-surface-2 border border-border">
            <Check className="w-3.5 h-3.5 text-text" />
            <span>Success</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold text-white bg-red shadow-sm">
            <X className="w-3.5 h-3.5 stroke-[3]" />
            <span>Failed</span>
          </span>
        );
      case 'waiting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-red-text border border-red/40 bg-red-soft">
            <Clock className="w-3.5 h-3.5 text-red" />
            <span>Waiting</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-muted bg-surface-2 border border-border">
            <span>{st}</span>
          </span>
        );
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="min-h-screen bg-bg text-text py-12 px-4">
        <div className="max-w-2xl mx-auto bg-surface border border-border rounded-card p-8 text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-red mx-auto" />
          <h2 className="text-base font-semibold text-text">Error Loading Execution</h2>
          <p className="text-xs text-muted font-mono">{error || 'Execution not found.'}</p>
          <Link
            href="/executions"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-2 text-text text-xs rounded-btn border border-border hover:bg-[#202025] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Executions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text py-8 px-4 font-sans select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <Link
            href="/executions"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Executions List
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="px-3 py-1.5 bg-surface-2 hover:bg-[#202025] text-red-text hover:text-white text-xs font-medium rounded-btn border border-border transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Re-run this execution"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
              <span>Retry Execution</span>
            </button>
            <Link
              href="/"
              className="px-3 py-1.5 bg-surface-2 hover:bg-[#202025] text-muted hover:text-text text-xs font-medium rounded-btn border border-border transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Open Studio</span>
            </Link>
          </div>
        </div>

        {/* Retry Banner Notice */}
        {retryNotice && (
          <div className="p-3 bg-red-soft border border-red/40 rounded-btn text-xs text-red-text font-mono flex items-center gap-2">
            <Check className="w-4 h-4 text-red" />
            <span>{retryNotice}</span>
          </div>
        )}

        {/* Execution Header Card */}
        <div className="bg-surface border border-border rounded-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-text">
                  {workflowName || 'Workflow Execution'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-border text-muted bg-surface-2 uppercase">
                  {execution.mode}
                </span>
              </div>
              <div className="text-xs font-mono text-muted flex items-center gap-1.5">
                <Hash className="w-3 h-3 text-red" />
                <span>{execution.id}</span>
              </div>
            </div>

            <div>{renderStatusBadge(execution.status)}</div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border/60">
            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase text-muted flex items-center gap-1">
                <Timer className="w-3 h-3" /> Duration
              </div>
              <div className="text-xs font-mono font-semibold text-text">
                {formatDuration(execution.startedAt, execution.finishedAt)}
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase text-muted flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Started
              </div>
              <div className="text-xs font-mono text-muted">
                {execution.startedAt ? new Date(execution.startedAt).toLocaleTimeString() : '-'}
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase text-muted flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Finished
              </div>
              <div className="text-xs font-mono text-muted">
                {execution.finishedAt ? new Date(execution.finishedAt).toLocaleTimeString() : '-'}
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase text-muted flex items-center gap-1">
                <Terminal className="w-3 h-3" /> Steps Run
              </div>
              <div className="text-xs font-mono font-semibold text-text">{steps.length}</div>
            </div>
          </div>

          {/* Error Banner if Execution Failed */}
          {execution.error && (
            <div className="p-3 bg-red-soft border border-red/40 rounded-btn space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-text">
                <AlertCircle className="w-3.5 h-3.5 text-red" />
                <span>Execution Error</span>
              </div>
              <div className="text-xs font-mono text-red-text/90 break-words">
                {execution.error}
              </div>
            </div>
          )}
        </div>

        {/* Trigger Data Section */}
        {execution.triggerData && (
          <div className="bg-surface border border-border rounded-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
                Initial Trigger Items
              </h3>
            </div>
            <JsonViewer
              data={execution.triggerData}
              title="Trigger Payload"
              defaultExpanded={false}
            />
          </div>
        )}

        {/* Step-by-Step Vertical Timeline */}
        <div className="bg-surface border border-border rounded-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="text-sm font-bold text-text">Execution Step Timeline</h3>
            <span className="text-xs font-mono text-muted">
              {steps.length} {steps.length === 1 ? 'step' : 'steps'} recorded
            </span>
          </div>

          {steps.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted font-mono">
              No individual step records found for this execution run.
            </div>
          ) : (
            <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
              {steps.map((step, idx) => {
                const isStepSuccess = step.status === 'success';
                const isStepFailed = step.status === 'failed';
                const isStepRunning = step.status === 'running';

                return (
                  <div key={step.id || idx} className="relative space-y-3">
                    {/* Timeline Node Bullet */}
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center border ${
                        isStepFailed
                          ? 'bg-red border-red text-white'
                          : isStepSuccess
                          ? 'bg-surface-2 border-border text-text'
                          : isStepRunning
                          ? 'bg-red border-red animate-pulse'
                          : 'bg-surface-2 border-border text-muted'
                      }`}
                    >
                      {isStepFailed ? (
                        <X className="w-3 h-3 stroke-[3]" />
                      ) : isStepSuccess ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                      )}
                    </div>

                    {/* Step Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-2/60 p-3 rounded-btn border border-border">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-text font-mono">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface border border-border text-red-text">
                          {step.nodeType}
                        </span>
                        <span className="text-xs text-muted font-mono truncate max-w-xs">
                          node: {step.nodeId}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono text-muted">
                        {step.attempts > 1 && (
                          <span className="text-[11px] text-red-text">
                            attempts: {step.attempts}
                          </span>
                        )}
                        <span>{formatDuration(step.startedAt, step.finishedAt)}</span>
                        {renderStatusBadge(step.status)}
                      </div>
                    </div>

                    {/* Step Error Box if failed */}
                    {step.error && (
                      <div className="p-3 bg-red-soft border border-red/40 rounded text-xs font-mono text-red-text space-y-1">
                        <div className="font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red" />
                          <span>Step Error</span>
                        </div>
                        <div>{step.error}</div>
                      </div>
                    )}

                    {/* Input and Output JSON Viewers */}
                    <div className="space-y-2 pt-1">
                      {step.input !== undefined && (
                        <JsonViewer
                          data={step.input}
                          title="Input Data"
                          defaultExpanded={false}
                        />
                      )}
                      {step.output !== undefined && (
                        <JsonViewer
                          data={step.output}
                          title="Output Data"
                          defaultExpanded={false}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
