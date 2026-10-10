'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ChevronLeft,
  RefreshCw,
  Play,
  RotateCcw,
  Check,
  X,
  Clock,
  ExternalLink,
  Filter,
  AlertCircle,
  Layers,
  Terminal,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';

interface ExecutionSummary {
  id: string;
  workflowId: string;
  workflowName?: string;
  userId: string;
  mode: 'live' | 'test';
  status: 'running' | 'success' | 'failed' | 'waiting' | 'cancelled';
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

interface WorkflowItem {
  id: string;
  name: string;
}

export default function ExecutionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  // Load user workflows for filter dropdown
  const loadWorkflows = useCallback(async () => {
    try {
      const res = await apiFetch<{ workflows: WorkflowItem[] }>('/api/workflows');
      if (res?.workflows) {
        setWorkflows(res.workflows);
      }
    } catch {
      // Non-fatal if workflow list cannot load
    }
  }, []);

  // Load executions list
  const loadExecutions = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        if (workflowFilter !== 'all') {
          queryParams.set('workflowId', workflowFilter);
        }
        if (statusFilter !== 'all') {
          queryParams.set('status', statusFilter);
        }
        queryParams.set('limit', '50');

        const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
        const res = await apiFetch<{ executions: ExecutionSummary[] }>(
          `/api/executions${queryStr}`
        );

        setExecutions(res?.executions || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch executions list.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workflowFilter, statusFilter]
  );

  useEffect(() => {
    if (user) {
      loadWorkflows();
    }
  }, [user, loadWorkflows]);

  useEffect(() => {
    if (user) {
      loadExecutions();
    }
  }, [user, loadExecutions]);

  // Handle retry
  const handleRetry = async (e: React.MouseEvent, execId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setRetryingId(execId);
    setRetryMessage(null);

    try {
      const res = await apiFetch<{ execution?: { id: string }; executionId?: string }>(
        `/api/executions/${execId}/retry`,
        {
          method: 'POST',
        }
      );
      const newId = res?.execution?.id || res?.executionId || 'queued';
      setRetryMessage(`Retry queued: ID ${newId.slice(0, 8)}...`);
      setTimeout(() => setRetryMessage(null), 4000);
      loadExecutions(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to retry execution.');
    } finally {
      setRetryingId(null);
    }
  };

  const formatDuration = (start: string | null, finish: string | null): string => {
    if (!start) return '-';
    const s = new Date(start).getTime();
    const f = finish ? new Date(finish).getTime() : Date.now();
    const ms = Math.max(0, f - s);
    if (ms < 1000) return `${ms}ms`;
    const sec = (ms / 1000).toFixed(1);
    return `${sec}s`;
  };

  const formatTimeAgo = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSec < 60) return 'just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const getWorkflowName = (wId: string): string => {
    const found = workflows.find((w) => w.id === wId);
    return found ? found.name : `Workflow ${wId.slice(0, 8)}`;
  };

  const renderStatusBadge = (status: ExecutionSummary['status']) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium text-text bg-surface-2 border border-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red" />
            </span>
            <span>Running</span>
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-muted bg-surface-2 border border-border">
            <Check className="w-3.5 h-3.5 text-text" />
            <span>Success</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium text-white bg-red shadow-sm">
            <X className="w-3 h-3 stroke-[3]" />
            <span>Failed</span>
          </span>
        );
      case 'waiting':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-red-text border border-red/40 bg-red-soft">
            <Clock className="w-3 h-3 text-red" />
            <span>Waiting</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-muted bg-surface-2 border border-border">
            <span>{status}</span>
          </span>
        );
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text py-8 px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-border gap-4">
          <div className="space-y-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-text transition-colors mb-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Studio
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-red-soft border border-red/30 rounded-lg text-red">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-text">Workflow Executions</h1>
                <p className="text-xs text-muted">
                  Audit logs, step timings, and debug traces for live triggers and test runs.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadExecutions(true)}
              disabled={refreshing || loading}
              className="px-3 py-1.5 bg-surface-2 hover:bg-[#202025] text-text text-xs font-medium rounded-btn border border-border transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh executions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/"
              className="px-3.5 py-1.5 bg-red hover:bg-red-hover active:bg-red-press text-white text-xs font-semibold rounded-btn transition-colors shadow-sm flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>New Run</span>
            </Link>
          </div>
        </div>

        {/* Retry Banner / Feedback */}
        {retryMessage && (
          <div className="p-3 bg-red-soft border border-red/30 rounded-btn text-xs text-red-text font-mono flex items-center gap-2">
            <Check className="w-4 h-4 text-red" />
            <span>{retryMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-soft border border-red/40 rounded-btn text-xs text-red-text font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadExecutions(true)}
              className="text-xs underline hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="p-3 bg-surface border border-border rounded-card flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Filter className="w-3.5 h-3.5 text-muted" />
              <span>Filter:</span>
            </div>

            {/* Workflow Filter Dropdown */}
            <select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value)}
              className="bg-surface-2 text-text text-xs px-2.5 py-1.5 rounded-btn border border-border focus:border-red focus:outline-none"
            >
              <option value="all">All Workflows</option>
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded-btn border border-border">
              {['all', 'running', 'success', 'failed', 'waiting'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded text-xs font-mono capitalize transition-colors ${
                    statusFilter === st
                      ? 'bg-red text-white font-semibold'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted font-mono">
            {executions.length} {executions.length === 1 ? 'execution' : 'executions'}
          </div>
        </div>

        {/* Executions Table */}
        {loading ? (
          <div className="bg-surface border border-border rounded-card p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-12 bg-surface-2/60 rounded animate-pulse border border-border/40"
              />
            ))}
          </div>
        ) : executions.length === 0 ? (
          <div className="bg-surface border border-border rounded-card p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-surface-2 rounded-full mx-auto flex items-center justify-center text-muted border border-border">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-text">No executions found</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                {workflowFilter !== 'all' || statusFilter !== 'all'
                  ? 'No execution records match the current filter selection.'
                  : 'Run a test in the canvas or activate your workflow to begin processing live triggers.'}
              </p>
            </div>
            {workflowFilter !== 'all' || statusFilter !== 'all' ? (
              <button
                onClick={() => {
                  setWorkflowFilter('all');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 bg-surface-2 hover:bg-[#202025] text-text text-xs font-medium rounded-btn border border-border transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red hover:bg-red-hover text-white text-xs font-semibold rounded-btn transition-colors shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Open Canvas Studio</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 text-muted border-b border-border uppercase tracking-wider text-[10px] font-mono">
                  <tr>
                    <th className="py-3 px-4">Workflow</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Executed</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {executions.map((exec) => (
                    <tr
                      key={exec.id}
                      onClick={() => router.push(`/executions/${exec.id}`)}
                      className="hover:bg-surface-2/60 cursor-pointer transition-colors group"
                    >
                      {/* Workflow Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-text group-hover:text-red-text transition-colors">
                          {getWorkflowName(exec.workflowId)}
                        </div>
                        <div className="text-[10px] text-muted font-mono truncate max-w-[180px]">
                          id: {exec.id.slice(0, 8)}...
                        </div>
                      </td>

                      {/* Mode Badge */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono border border-border text-muted bg-surface-2 uppercase">
                          {exec.mode}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4">{renderStatusBadge(exec.status)}</td>

                      {/* Duration */}
                      <td className="py-3 px-4 font-mono text-muted">
                        {formatDuration(exec.startedAt, exec.finishedAt)}
                      </td>

                      {/* Executed At */}
                      <td className="py-3 px-4 text-muted font-mono">
                        {formatTimeAgo(exec.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right space-x-2">
                        {exec.status === 'failed' && (
                          <button
                            onClick={(e) => handleRetry(e, exec.id)}
                            disabled={retryingId === exec.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-2 hover:bg-[#202025] text-red-text hover:text-white rounded text-[11px] font-mono border border-border transition-colors disabled:opacity-50"
                            title="Retry execution"
                          >
                            <RotateCcw
                              className={`w-3 h-3 ${retryingId === exec.id ? 'animate-spin' : ''}`}
                            />
                            <span>Retry</span>
                          </button>
                        )}

                        <Link
                          href={`/executions/${exec.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-2 hover:bg-[#202025] text-muted hover:text-text rounded text-[11px] font-mono border border-border transition-colors"
                        >
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
