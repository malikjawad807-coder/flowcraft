'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock,
  ChevronLeft,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  ShieldAlert,
  Send,
  ExternalLink,
  Layers,
  Inbox,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';

interface ApprovalItem {
  id: string;
  userId: string;
  runId: string | null;
  executionId: string | null;
  nodeId: string | null;
  toolName: string;
  preview: {
    recipient?: string;
    subject?: string;
    body?: string;
    warning?: string;
    domainMismatch?: boolean;
    alreadyReplied?: boolean;
  };
  args?: any;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  editedArgs?: any;
  decidedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);

  // Require auth
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  // Load approvals
  const loadApprovals = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      try {
        setError(null);
        const url =
          statusFilter === 'all'
            ? '/api/approvals'
            : `/api/approvals?status=${statusFilter}`;
        const res = await apiFetch<{ approvals: ApprovalItem[] }>(url);
        if (res?.approvals) {
          setApprovals(res.approvals);
          // Initialize editable bodies
          const bodies: Record<string, string> = {};
          res.approvals.forEach((a) => {
            bodies[a.id] = a.editedArgs?.bodyText || a.preview?.body || '';
          });
          setEditedBodies(bodies);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load approvals.');
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    },
    [statusFilter]
  );

  useEffect(() => {
    if (user) {
      loadApprovals();
    }
  }, [user, loadApprovals]);

  // 15-second polling interval
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadApprovals();
    }, 15000);
    return () => clearInterval(interval);
  }, [user, loadApprovals]);

  // Handle Approve / Reject
  const handleDecide = async (id: string, decision: 'approve' | 'reject') => {
    setDecidingId(id);
    try {
      setError(null);
      const editedBody = editedBodies[id];
      const payload = decision === 'approve' && editedBody ? { editedArgs: { bodyText: editedBody } } : {};

      await apiFetch(`/api/approvals/${id}/${decision}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Update state
      setApprovals((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: decision === 'approve' ? 'approved' : 'rejected' } : a))
      );
    } catch (err: any) {
      setError(err?.message || `Failed to ${decision} approval.`);
    } finally {
      setDecidingId(null);
    }
  };

  const formatExpiry = (expiresAt: string): string => {
    try {
      const exp = new Date(expiresAt).getTime();
      const now = Date.now();
      const diffMs = exp - now;
      if (diffMs <= 0) return 'Expired';
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 0) return `Expires in ${hours}h ${mins}m`;
      return `Expires in ${mins}m`;
    } catch {
      return expiresAt;
    }
  };

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text py-8 px-4 font-sans select-none">
      <div className="max-w-4xl mx-auto space-y-6">
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
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-text tracking-tight">Approvals Queue</h1>
                  {pendingCount > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red text-white font-semibold shadow-sm">
                      {pendingCount} pending
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  Human-in-the-loop review for outgoing emails, draft actions, and sensitive agent tools.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadApprovals(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/agent"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-semibold text-white bg-red hover:bg-red-hover active:bg-red-press transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Command Center</span>
            </Link>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-card bg-red-soft border border-red/40 flex items-center justify-between text-xs text-red-text">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => loadApprovals(true)}
              className="font-mono underline hover:text-text"
            >
              Retry
            </button>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-btn text-xs font-medium capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-surface-2 text-text border border-red/40 shadow-sm'
                  : 'text-muted hover:text-text hover:bg-surface-2/60 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Approvals List */}
        {loading ? (
          <div className="space-y-4">
            <div className="h-32 bg-surface rounded-card border border-border animate-pulse" />
            <div className="h-32 bg-surface rounded-card border border-border animate-pulse" />
          </div>
        ) : approvals.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-surface rounded-card border border-border">
            <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border mx-auto flex items-center justify-center text-muted">
              <Check className="w-5 h-5 text-text" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text">No Approvals Found</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                {statusFilter === 'pending'
                  ? 'You are all caught up! When the AI agent or workflows queue email sends, they will appear here.'
                  : `No approvals with status "${statusFilter}".`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((item) => {
              const isPending = item.status === 'pending';
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-card bg-surface border border-border space-y-4 shadow-sm"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-surface-2 border border-border text-red">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text font-mono uppercase">
                            {item.toolName}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
                              item.status === 'pending'
                                ? 'bg-red-soft text-red-text border-red/40'
                                : item.status === 'approved'
                                ? 'bg-surface-2 text-text border-border'
                                : 'bg-red text-white border-transparent'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted font-mono">
                          ID: {item.id.slice(0, 8)} • Created {new Date(item.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
                      {isPending && (
                        <span className="text-red-text bg-red-soft px-2 py-0.5 rounded border border-red/30">
                          {formatExpiry(item.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Warning Notice if present */}
                  {item.preview?.warning && (
                    <div className="p-3 rounded-lg bg-red-soft border border-red/30 flex items-start gap-2.5 text-xs text-red-text">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red" />
                      <div className="leading-snug">
                        <strong className="font-semibold block">Security Notice:</strong>
                        <span>{item.preview.warning}</span>
                      </div>
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-surface-2 border border-border text-xs font-mono">
                    <div>
                      <span className="text-muted block text-[10px] uppercase">Recipient</span>
                      <span className="text-text font-medium select-all">
                        {item.preview?.recipient || item.args?.to || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px] uppercase">Subject</span>
                      <span className="text-text truncate block">
                        {item.preview?.subject || item.args?.subject || '-'}
                      </span>
                    </div>
                  </div>

                  {/* Editable Body */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-muted uppercase">
                      Email Body {isPending && '(Review and edit before approving)'}
                    </label>
                    <textarea
                      disabled={!isPending}
                      value={editedBodies[item.id] ?? ''}
                      onChange={(e) =>
                        setEditedBodies((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      rows={5}
                      className="w-full bg-[#0E0E10] text-text text-xs p-3 rounded border border-border focus:border-red focus:outline-none font-sans leading-relaxed resize-none disabled:opacity-80"
                    />
                  </div>

                  {/* Actions Bar */}
                  {isPending && (
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        disabled={decidingId === item.id}
                        onClick={() => handleDecide(item.id, 'reject')}
                        className="px-4 py-2 rounded-btn text-xs font-medium text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors disabled:opacity-50"
                      >
                        Reject Action
                      </button>
                      <button
                        type="button"
                        disabled={decidingId === item.id}
                        onClick={() => handleDecide(item.id, 'approve')}
                        className="px-5 py-2 rounded-btn text-xs font-semibold text-white bg-red hover:bg-red-hover active:bg-red-press transition-colors disabled:opacity-50 shadow-sm"
                      >
                        Approve & Send
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
