'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  RefreshCw,
  Plus,
  Loader2,
  Check,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';

interface ConnectionItem {
  id: string;
  provider: string;
  accountEmail: string;
  scopes: string[];
  status: string; // 'active' | 'revoked' | 'needs_reconnect'
  createdAt: string;
  updatedAt: string;
}

function ConnectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const connectedParam = searchParams.get('connected');
  const connectedEmail = searchParams.get('email');
  const errorParam = searchParams.get('error');

  const { user, loading: authLoading } = useAuth();

  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(errorParam);
  const [successBanner, setSuccessBanner] = useState<string | null>(
    connectedParam === 'gmail'
      ? `Successfully connected Gmail account: ${connectedEmail || ''}`
      : null
  );

  // Testing connection state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; message: string; ok: boolean } | null>(
    null
  );

  // Disconnect modal state
  const [disconnectingItem, setDisconnectingItem] = useState<ConnectionItem | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<ConnectionItem[]>('/api/connections');
      setConnections(data || []);
      setActionError(null);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to load connections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadConnections();
    }
  }, [user]);

  const handleConnectGmail = async () => {
    setConnecting(true);
    setActionError(null);
    try {
      const data = await apiFetch<{ authUrl: string }>('/api/connections/gmail/auth-url');
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('Google OAuth consent URL not received from server.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to initiate Google OAuth.');
      setConnecting(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await apiFetch<{
        success: boolean;
        emailAddress: string;
        messagesTotal: number;
      }>(`/api/connections/${id}/test`, {
        method: 'POST',
      });

      setTestResult({
        id,
        ok: true,
        message: `Verified: ${res.messagesTotal.toLocaleString()} messages in mailbox`,
      });
    } catch (err: any) {
      setTestResult({
        id,
        ok: false,
        message: err?.message || 'Connection test failed. Authorization may be revoked.',
      });
      loadConnections();
    } finally {
      setTestingId(null);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectingItem) return;

    setDisconnecting(true);
    try {
      await apiFetch(`/api/connections/${disconnectingItem.id}`, {
        method: 'DELETE',
      });
      setDisconnectingItem(null);
      loadConnections();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to disconnect account.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div className="space-y-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-text transition-colors mb-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Studio
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-red-soft border border-red/30 rounded-lg text-red">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-text">Connected Accounts</h1>
                <p className="text-xs text-muted">
                  Authorize personal and workspace Gmail accounts for automated workflows.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings/security"
              className="py-2 px-3 bg-surface-2 hover:bg-border/60 text-muted hover:text-text text-xs font-medium rounded-btn transition-colors border border-border inline-flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-muted" /> Security Settings
            </Link>

            <button
              onClick={handleConnectGmail}
              disabled={connecting}
              className="py-2 px-3.5 bg-red hover:bg-red-hover active:bg-red-press text-text text-xs font-medium rounded-btn transition-colors inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Redirecting...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Connect Gmail
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successBanner && (
          <div className="p-3.5 bg-surface border border-border rounded-card text-xs text-text flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-red flex-shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-xs text-muted hover:text-text"
            >
              Dismiss
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 bg-red-soft border border-red/30 rounded-card text-xs text-red-text flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red flex-shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-xs text-red hover:text-red-hover"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Connections List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
              Active Integrations ({connections.length})
            </h2>
            <button
              onClick={loadConnections}
              className="text-xs text-muted hover:text-text inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="bg-surface border border-border rounded-card p-12 text-center text-xs text-muted">
              Loading integrations...
            </div>
          ) : connections.length === 0 ? (
            <div className="bg-surface border border-border rounded-card p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center mx-auto text-muted">
                <Mail className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-text">No connected accounts yet</h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  Connect your Google account to start sending automated emails and monitoring inbox triggers.
                </p>
              </div>
              <button
                onClick={handleConnectGmail}
                disabled={connecting}
                className="py-2 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text text-xs font-medium rounded-btn transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Connect your first Gmail account
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => {
                const isRevoked = conn.status === 'revoked';
                const isTested = testResult?.id === conn.id;

                return (
                  <div
                    key={conn.id}
                    className="bg-surface border border-border rounded-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-border/80"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-red flex-shrink-0 mt-0.5">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text">{conn.accountEmail}</span>
                          {isRevoked ? (
                            <span className="px-2 py-0.5 bg-red-soft text-red text-[11px] font-semibold rounded-full border border-red/30">
                              Revoked
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-surface-2 text-text text-[11px] font-medium rounded-full border border-border">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-muted flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>Connected on {new Date(conn.createdAt).toLocaleDateString()}</span>
                          <span className="font-mono text-[11px] text-muted/80">
                            Provider: Google OAuth
                          </span>
                        </div>

                        {/* Test status banner if tested */}
                        {isTested && (
                          <div
                            className={`p-2 rounded text-xs inline-flex items-center gap-1.5 ${
                              testResult.ok
                                ? 'bg-surface-2 text-text border border-border'
                                : 'bg-red-soft text-red-text border border-red/30'
                            }`}
                          >
                            {testResult.ok ? (
                              <Check className="w-3.5 h-3.5 text-red" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-red" />
                            )}
                            <span>{testResult.message}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => handleTestConnection(conn.id)}
                        disabled={testingId === conn.id}
                        className="py-1.5 px-3 bg-surface-2 hover:bg-border/60 text-xs text-text border border-border rounded-btn transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {testingId === conn.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-red" /> Testing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3 text-muted" /> Test
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setDisconnectingItem(conn)}
                        className="py-1.5 px-3 bg-surface-2 hover:bg-border/60 text-xs text-muted hover:text-red border border-border rounded-btn transition-colors inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" /> Disconnect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Disconnect Modal */}
        {disconnectingItem && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface border border-red/40 rounded-card p-6 space-y-4 shadow-2xl">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-text">Disconnect Gmail Account?</h3>
                <p className="text-xs text-muted">
                  Are you sure you want to disconnect{' '}
                  <span className="font-semibold text-text">{disconnectingItem.accountEmail}</span>?
                  Workflows relying on this account will not be able to send or read emails until reconnected.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDisconnectingItem(null)}
                  disabled={disconnecting}
                  className="py-2 px-3 bg-surface-2 hover:bg-border/60 text-xs text-muted hover:text-text rounded-btn border border-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="py-2 px-3 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-xs rounded-btn transition-colors disabled:opacity-50"
                >
                  {disconnecting ? 'Disconnecting...' : 'Confirm Disconnect'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConnectionsSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-bg">
          <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ConnectionsContent />
    </Suspense>
  );
}
