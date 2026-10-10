'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Settings,
  ChevronLeft,
  Cpu,
  Shield,
  Key,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  BarChart3,
  Mail,
  Clock,
  Layers,
  Save,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';

interface UserSettingsData {
  llmProvider: string;
  hasPersonalKey: boolean;
  autoSendEnabled: boolean;
  signature: string;
  memoryEnabled: boolean;
  memoryLearnEnabled: boolean;
}

interface UserProfileData {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
}

interface UsageSummary {
  summary: {
    totalTokensIn: number;
    totalTokensOut: number;
    totalTokens: number;
    totalCalls: number;
  };
  byPurpose: Record<string, { tokensIn: number; tokensOut: number; calls: number }>;
  daily: Array<{ date: string; tokensIn: number; tokensOut: number; calls: number }>;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Settings State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile Form
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [signature, setSignature] = useState('');

  // LLM Config Form
  const [llmProvider, setLlmProvider] = useState<'openai' | 'anthropic' | 'google' | 'ollama'>('openai');
  const [personalApiKey, setPersonalApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasPersonalKey, setHasPersonalKey] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);

  // LLM Connectivity Test State
  const [testingLlm, setTestingLlm] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);

  // Usage State
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'usage'>('general');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const loadSettingsAndUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [settingsRes, usageRes] = await Promise.all([
        apiFetch<{ user: UserProfileData; settings: UserSettingsData }>('/api/settings'),
        apiFetch<UsageSummary>('/api/usage').catch(() => null),
      ]);

      if (settingsRes) {
        setName(settingsRes.user?.name || '');
        setTimezone(settingsRes.user?.timezone || 'UTC');
        setSignature(settingsRes.settings?.signature || '');
        setLlmProvider((settingsRes.settings?.llmProvider as any) || 'openai');
        setHasPersonalKey(settingsRes.settings?.hasPersonalKey || false);
        setAutoSendEnabled(settingsRes.settings?.autoSendEnabled || false);
      }

      if (usageRes) {
        setUsage(usageRes);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadSettingsAndUsage();
    }
  }, [user, loadSettingsAndUsage]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const payload: Record<string, any> = {
        name,
        timezone,
        signature,
        llmProvider,
        autoSendEnabled,
      };

      if (personalApiKey !== '') {
        payload.personalApiKey = personalApiKey;
      }

      const res = await apiFetch<{ success: boolean; settings: UserSettingsData }>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (res?.success) {
        setSaveSuccess(true);
        setHasPersonalKey(res.settings?.hasPersonalKey);
        setPersonalApiKey(''); // Clear in-memory secret after saving
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearApiKey = async () => {
    if (!confirm('Remove personal API key and revert to server default?')) return;
    setSaving(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ personalApiKey: '' }),
      });
      setHasPersonalKey(false);
      setPersonalApiKey('');
    } catch (err: any) {
      setError(err?.message || 'Failed to remove personal key.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestLlm = async () => {
    setTestingLlm(true);
    setTestResult(null);

    try {
      const payload: Record<string, any> = {
        provider: llmProvider,
      };
      if (personalApiKey.trim()) {
        payload.personalApiKey = personalApiKey.trim();
      }

      const res = await apiFetch<{ success: boolean; latencyMs?: number; message?: string }>(
        '/api/settings/test-llm',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      setTestResult({
        ok: true,
        message: `Connected successfully (${res.latencyMs || 0}ms)`,
        latencyMs: res.latencyMs,
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || 'Connection test failed',
      });
    } finally {
      setTestingLlm(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text py-8 px-4 font-sans select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Header */}
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
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-text">Workspace Settings</h1>
                <p className="text-xs text-muted">
                  Configure AI models, credentials, reply defaults, and token usage audit.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings/connections"
              className="px-3 py-1.5 bg-surface-2 hover:bg-[#202025] text-muted hover:text-text text-xs font-medium rounded-btn border border-border transition-colors flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5 text-red" />
              <span>Gmail Connection</span>
            </Link>
            <Link
              href="/settings/security"
              className="px-3 py-1.5 bg-surface-2 hover:bg-[#202025] text-muted hover:text-text text-xs font-medium rounded-btn border border-border transition-colors flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Security</span>
            </Link>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 border-b border-border pb-px">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-red text-text'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            General & Profile
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'border-red text-text'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI & LLM Provider</span>
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'usage'
                ? 'border-red text-text'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Token Usage Audit</span>
          </button>
        </div>

        {/* Alerts & Feedback */}
        {saveSuccess && (
          <div className="p-3 bg-red-soft border border-red/40 rounded-btn text-xs text-red-text font-mono flex items-center gap-2">
            <Check className="w-4 h-4 text-red" />
            <span>Settings saved successfully.</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-soft border border-red/40 rounded-btn text-xs text-red-text flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* TAB 1: General & Profile */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-card p-6 space-y-4">
                <h2 className="text-sm font-bold text-text">Profile Information</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted">Account Email</label>
                    <input
                      type="text"
                      disabled
                      value={user?.email || ''}
                      className="w-full bg-[#0D0D0F] text-muted text-xs px-3 py-2 rounded-btn border border-border/60 cursor-not-allowed font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted">Display Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sarah Connor"
                      className="w-full bg-surface-2 text-text text-xs px-3 py-2 rounded-btn border border-border focus:border-red focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full sm:w-80 bg-surface-2 text-text text-xs px-3 py-2 rounded-btn border border-border focus:border-red focus:outline-none"
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                    <option value="America/Denver">America/Denver (MST/MDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                  </select>
                  <p className="text-[11px] text-muted">
                    Workflow schedules and LLM system time will reflect this timezone.
                  </p>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-card p-6 space-y-4">
                <h2 className="text-sm font-bold text-text">Default Reply Signature</h2>
                <div className="space-y-1.5">
                  <textarea
                    rows={4}
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="--&#10;Best regards,&#10;FlowCart Automated Operations"
                    className="w-full bg-surface-2 text-text text-xs p-3 rounded-btn border border-border focus:border-red focus:outline-none font-mono"
                  />
                  <p className="text-[11px] text-muted">
                    Automatically appended by email actions and drafting nodes when specified.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI & LLM Provider */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-card p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h2 className="text-sm font-bold text-text">Model Provider</h2>
                    <p className="text-xs text-muted">
                      Select which AI provider powers triage classification, summary, and agent reasoning.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-muted bg-surface-2 border border-border uppercase">
                    Active: {llmProvider}
                  </span>
                </div>

                {/* Provider Options Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'openai', label: 'OpenAI', desc: 'GPT-4o & GPT-4o-mini' },
                    { id: 'anthropic', label: 'Anthropic', desc: 'Claude 3.5 Sonnet / Haiku' },
                    { id: 'google', label: 'Google GenAI', desc: 'Gemini 1.5 Pro / Flash' },
                    { id: 'ollama', label: 'Ollama (Local)', desc: 'Local models over HTTP' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLlmProvider(p.id as any)}
                      className={`p-3 rounded-card text-left border transition-all ${
                        llmProvider === p.id
                          ? 'bg-red-soft border-red text-text shadow-sm'
                          : 'bg-surface-2 border-border text-muted hover:border-border/80 hover:text-text'
                      }`}
                    >
                      <div className="font-semibold text-xs text-text">{p.label}</div>
                      <div className="text-[10px] text-muted truncate mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>

                {llmProvider === 'ollama' && (
                  <div className="p-3 bg-surface-2 border border-border rounded-btn text-xs text-muted space-y-1">
                    <div className="flex items-center gap-1.5 text-text font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 text-red" />
                      <span>Local Model Notice</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Small local models running through Ollama may exhibit lower reliability on complex multi-turn tool calling. Recommended: Llama 3.1 8B or larger.
                    </p>
                  </div>
                )}

                {/* Personal API Key (Write-Only) */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-text">Personal API Key</label>
                      <p className="text-[11px] text-muted">
                        Optional. If empty, the server environment key is used. Encrypted at rest via Vault.
                      </p>
                    </div>

                    {hasPersonalKey && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-muted bg-surface-2 border border-border">
                        <Check className="w-3 h-3 text-text" />
                        <span>Configured</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={personalApiKey}
                        onChange={(e) => setPersonalApiKey(e.target.value)}
                        placeholder={hasPersonalKey ? '••••••••••••••••••••••••••••••••' : 'Enter API Key (sk-...)'}
                        className="w-full bg-surface-2 text-text text-xs px-3 py-2 pr-9 rounded-btn border border-border focus:border-red focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {hasPersonalKey && (
                      <button
                        type="button"
                        onClick={handleClearApiKey}
                        className="px-3 py-2 bg-surface-2 hover:bg-[#202025] text-red-text text-xs rounded-btn border border-border transition-colors font-mono"
                        title="Remove custom personal key"
                      >
                        Remove
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleTestLlm}
                      disabled={testingLlm}
                      className="px-3.5 py-2 bg-surface-2 hover:bg-[#202025] text-text text-xs font-medium rounded-btn border border-border transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${testingLlm ? 'animate-spin text-red' : ''}`} />
                      <span>{testingLlm ? 'Testing...' : 'Test'}</span>
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-2.5 rounded-btn text-xs font-mono flex items-center gap-2 ${
                        testResult.ok
                          ? 'bg-surface-2 text-text border border-border'
                          : 'bg-red-soft text-red-text border border-red/40'
                      }`}
                    >
                      {testResult.ok ? (
                        <Check className="w-3.5 h-3.5 text-text flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red flex-shrink-0" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>

                {/* Auto-Send Switch with Explicit Red Warning */}
                <div className="pt-4 border-t border-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-text">Workflow Auto-Send Dispatches</div>
                      <p className="text-[11px] text-muted">
                        Allow live workflow executions to send email dispatches without manual approval.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSendEnabled}
                        onChange={(e) => setAutoSendEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all border border-border peer-checked:bg-red" />
                    </label>
                  </div>

                  {autoSendEnabled && (
                    <div className="p-3 bg-red-soft border border-red/50 rounded-btn text-xs text-red-text font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red flex-shrink-0" />
                      <span>
                        Caution: Outgoing emails will be sent directly to recipients without pausing for human approval in workflows configured with send mode.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Token Usage Audit */}
          {activeTab === 'usage' && (
            <div className="space-y-6">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface border border-border rounded-card p-4 space-y-1">
                  <div className="text-[10px] font-mono text-muted uppercase">Total Tokens</div>
                  <div className="text-lg font-bold font-mono text-text">
                    {(usage?.summary.totalTokens || 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-card p-4 space-y-1">
                  <div className="text-[10px] font-mono text-muted uppercase">Prompt Tokens (In)</div>
                  <div className="text-lg font-bold font-mono text-muted">
                    {(usage?.summary.totalTokensIn || 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-card p-4 space-y-1">
                  <div className="text-[10px] font-mono text-muted uppercase">Completion Tokens (Out)</div>
                  <div className="text-lg font-bold font-mono text-text">
                    {(usage?.summary.totalTokensOut || 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-card p-4 space-y-1">
                  <div className="text-[10px] font-mono text-muted uppercase">API Invocations</div>
                  <div className="text-lg font-bold font-mono text-red-text">
                    {(usage?.summary.totalCalls || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Breakdown By Purpose */}
              {usage?.byPurpose && Object.keys(usage.byPurpose).length > 0 && (
                <div className="bg-surface border border-border rounded-card p-5 space-y-3">
                  <h3 className="text-xs font-bold text-text uppercase tracking-wider font-mono">
                    Token Consumption By Purpose
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(usage.byPurpose).map(([purpose, stat]) => (
                      <div
                        key={purpose}
                        className="p-3 bg-surface-2/60 border border-border/80 rounded-btn space-y-1"
                      >
                        <div className="text-xs font-mono font-semibold text-text capitalize">
                          {purpose}
                        </div>
                        <div className="text-xs font-mono text-muted">
                          {(stat.tokensIn + stat.tokensOut).toLocaleString()} tokens
                        </div>
                        <div className="text-[10px] font-mono text-muted/70">
                          {stat.calls} {stat.calls === 1 ? 'call' : 'calls'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Log Table */}
              <div className="bg-surface border border-border rounded-card overflow-hidden">
                <div className="p-4 border-b border-border/60">
                  <h3 className="text-xs font-bold text-text uppercase tracking-wider font-mono">
                    Daily Usage Activity
                  </h3>
                </div>

                {!usage || usage.daily.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted font-mono">
                    No token activity recorded in the last 30 days.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-surface-2 text-muted border-b border-border text-[10px] uppercase">
                        <tr>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Tokens In</th>
                          <th className="py-2.5 px-4">Tokens Out</th>
                          <th className="py-2.5 px-4">Total Tokens</th>
                          <th className="py-2.5 px-4 text-right">Invocations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {usage.daily.map((d) => (
                          <tr key={d.date} className="hover:bg-surface-2/40 transition-colors">
                            <td className="py-2.5 px-4 text-text font-semibold">{d.date}</td>
                            <td className="py-2.5 px-4 text-muted">{d.tokensIn.toLocaleString()}</td>
                            <td className="py-2.5 px-4 text-muted">{d.tokensOut.toLocaleString()}</td>
                            <td className="py-2.5 px-4 text-text">
                              {(d.tokensIn + d.tokensOut).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right text-muted">{d.calls}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Bar */}
          {activeTab !== 'usage' && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-red hover:bg-red-hover active:bg-red-press text-white text-xs font-semibold rounded-btn transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
