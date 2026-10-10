'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  Clock,
  Ban,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
  emailVerifiedAt: string | null;
  disabledAt: string | null;
  failedLogins: number;
  timezone: string;
  createdAt: string;
}

interface AdminQueueStats {
  executionsByStatus: Record<string, number>;
  agentRunsByStatus: Record<string, number>;
  recentFailedJobs: Array<{
    id: string;
    workflowId: string;
    status: string;
    error: string | null;
    createdAt: string;
  }>;
  uptimeSeconds: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [queueStats, setQueueStats] = useState<AdminQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, queuesData] = await Promise.all([
        apiFetch<{ users: AdminUser[] }>('/api/admin/users'),
        apiFetch<AdminQueueStats>('/api/admin/queues'),
      ]);
      setUsersList(usersData.users || []);
      setQueueStats(queuesData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load administrator data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role === 'admin') {
        loadAdminData();
      }
    }
  }, [authLoading, user, router, loadAdminData]);

  const handleToggleUser = async (targetUser: AdminUser) => {
    const isDisabling = !targetUser.disabledAt;
    const confirmPrompt = isDisabling
      ? `Are you sure you want to disable ${targetUser.email}? Their active sessions will be revoked immediately.`
      : `Re-enable account access for ${targetUser.email}?`;

    if (!window.confirm(confirmPrompt)) return;

    setActionUserId(targetUser.id);
    setError(null);
    setSuccessMsg(null);
    try {
      const endpoint = isDisabling
        ? `/api/admin/users/${targetUser.id}/disable`
        : `/api/admin/users/${targetUser.id}/enable`;

      await apiFetch(endpoint, { method: 'POST' });
      setSuccessMsg(
        isDisabling
          ? `User ${targetUser.email} has been disabled.`
          : `User ${targetUser.email} has been re-enabled.`
      );
      await loadAdminData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update user status.');
    } finally {
      setActionUserId(null);
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
  };

  if (authLoading || (loading && !queueStats)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="max-w-md w-full bg-surface border border-border rounded-card p-8 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-red mx-auto" />
          <h1 className="text-xl font-bold text-text">Access Restricted</h1>
          <p className="text-xs text-muted">
            Administrator privileges are required to view this operations dashboard.
          </p>
          <Link
            href="/"
            className="inline-block py-2 px-4 bg-red hover:bg-red-hover text-xs font-medium text-text rounded-btn transition-colors"
          >
            Return to Workflows
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <Link
              href="/"
              className="text-xs text-muted hover:text-text transition-colors inline-flex items-center gap-1 mb-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Workspace
            </Link>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red" />
              <h1 className="text-2xl font-bold tracking-tight text-text">Operations & Administration</h1>
              <span className="px-2 py-0.5 bg-red-soft text-red text-[11px] font-semibold rounded-full border border-red/30">
                Admin Console
              </span>
            </div>
            <p className="text-xs text-muted">
              Self-hosted user management, queue health, and background job telemetry (Section 12.9).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadAdminData}
              disabled={loading}
              className="py-2 px-3 bg-surface hover:bg-border/60 text-xs text-text border border-border rounded-btn transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red' : ''}`} />
              Refresh Telemetry
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-surface border border-border rounded-input text-xs text-text flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-red flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Telemetry Cards */}
        {queueStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">System Health</span>
                <Clock className="w-4 h-4 text-red" />
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-text">{formatUptime(queueStats.uptimeSeconds)}</div>
                <div className="text-xs text-muted">Node.js Process Uptime</div>
              </div>
              <div className="pt-2 border-t border-border/80 flex items-center justify-between text-xs text-muted">
                <span>Total Registered Users</span>
                <span className="font-semibold text-text">{usersList.length}</span>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Workflows Telemetry</span>
                <Activity className="w-4 h-4 text-red" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-surface-2 rounded border border-border/60">
                  <div className="text-lg font-bold text-text">
                    {queueStats.executionsByStatus.completed || 0}
                  </div>
                  <div className="text-[11px] text-muted">Done</div>
                </div>
                <div className="p-2 bg-surface-2 rounded border border-border/60">
                  <div className="text-lg font-bold text-red">
                    {queueStats.executionsByStatus.failed || 0}
                  </div>
                  <div className="text-[11px] text-muted">Failed</div>
                </div>
                <div className="p-2 bg-surface-2 rounded border border-border/60">
                  <div className="text-lg font-bold text-text">
                    {queueStats.executionsByStatus.running || 0}
                  </div>
                  <div className="text-[11px] text-muted">Active</div>
                </div>
              </div>
              <div className="pt-2 border-t border-border/80 text-xs text-muted">
                Execution status across background queues
              </div>
            </div>

            <div className="bg-surface border border-border rounded-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Agent Telemetry</span>
                <Users className="w-4 h-4 text-red" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-surface-2 rounded border border-border/60">
                  <div className="text-lg font-bold text-text">
                    {queueStats.agentRunsByStatus.completed || 0}
                  </div>
                  <div className="text-[11px] text-muted">Finished</div>
                </div>
                <div className="p-2 bg-surface-2 rounded border border-border/60">
                  <div className="text-lg font-bold text-red">
                    {queueStats.agentRunsByStatus.awaiting_approval || 0}
                  </div>
                  <div className="text-[11px] text-muted">Approval</div>
                </div>
                <div className="p-2 bg-surface-2 rounded border border-border/60">
                  <div className="text-lg font-bold text-text">
                    {queueStats.agentRunsByStatus.running || 0}
                  </div>
                  <div className="text-[11px] text-muted">Running</div>
                </div>
              </div>
              <div className="pt-2 border-t border-border/80 text-xs text-muted">
                Command center runs & pending approvals
              </div>
            </div>
          </div>
        )}

        {/* Failed Jobs Section */}
        {queueStats && queueStats.recentFailedJobs.length > 0 && (
          <div className="bg-surface border border-border rounded-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red" />
              <div>
                <h2 className="text-base font-semibold text-text">Recent Failed Executions</h2>
                <p className="text-xs text-muted">
                  Failure codes and execution timestamps (email bodies are strictly redacted for privacy).
                </p>
              </div>
            </div>

            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {queueStats.recentFailedJobs.map((job) => (
                <div key={job.id} className="p-3.5 bg-surface-2 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="font-mono text-text">ID: {job.id}</div>
                    <div className="text-red font-medium">{job.error || 'Execution encountered an unhandled error'}</div>
                  </div>
                  <div className="text-muted font-mono">
                    {new Date(job.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users Management Section */}
        <div className="bg-surface border border-border rounded-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-red" />
              <div>
                <h2 className="text-base font-semibold text-text">User Accounts ({usersList.length})</h2>
                <p className="text-xs text-muted">
                  Manage self-hosted tenant accounts, view email verification status, or revoke access.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted border-b border-border uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Email Status</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usersList.map((u) => {
                  const isSelf = Boolean(user && u.id === user.id);
                  const isDisabled = Boolean(u.disabledAt);

                  return (
                    <tr key={u.id} className="hover:bg-surface-2/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-text">{u.email}</div>
                        {u.name && <div className="text-[11px] text-muted">{u.name}</div>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                            u.role === 'admin'
                              ? 'bg-red-soft text-red border-red/30'
                              : 'bg-surface-2 text-muted border-border'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.emailVerifiedAt ? (
                          <span className="inline-flex items-center gap-1 text-text">
                            <CheckCircle2 className="w-3.5 h-3.5 text-red" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted">
                            <XCircle className="w-3.5 h-3.5 text-muted" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isDisabled ? (
                          <span className="px-2 py-0.5 bg-red-soft text-red text-[11px] font-semibold rounded-full border border-red/30">
                            Disabled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-surface text-text text-[11px] font-semibold rounded-full border border-border">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted font-mono">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isSelf ? (
                          <span className="text-[11px] text-muted italic">(Your account)</span>
                        ) : isDisabled ? (
                          <button
                            onClick={() => handleToggleUser(u)}
                            disabled={actionUserId === u.id}
                            className="py-1 px-2.5 bg-surface hover:bg-border text-text text-xs rounded border border-border transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <UserCheck className="w-3 h-3 text-red" /> Enable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleUser(u)}
                            disabled={actionUserId === u.id}
                            className="py-1 px-2.5 bg-surface-2 hover:bg-red/20 text-red text-xs rounded border border-border hover:border-red/40 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <Ban className="w-3 h-3 text-red" /> Disable
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
