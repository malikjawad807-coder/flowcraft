'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Play,
  Download,
  Upload,
  Settings,
  Sparkles,
  Trash2,
  Loader2,
  Layers,
  Terminal,
  Shield,
  Save,
  Check,
  AlertCircle,
  Activity,
  Bell,
  Bot,
  Brain,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';

interface BuilderHeaderProps {
  workflowName: string;
  onRenameWorkflow: (name: string) => void;
  isRunning: boolean;
  onRunWorkflow: () => void;
  onSaveWorkflow?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
  sampleEmailId?: string;
  onSelectSampleEmail?: (id: string) => void;
  sampleEmails?: Array<{ id: string; name: string }>;
  validationErrors?: Array<{ nodeId?: string; message: string }>;
  onOpenTemplates: () => void;
  onOpenSettings: () => void;
  onToggleLogs: () => void;
  onOpenAiAssistant: () => void;
  onExportWorkflow: () => void;
  onImportWorkflow: () => void;
  onClearWorkflow: () => void;
  hasLogs: boolean;
  nodeCount: number;
}

export function BuilderHeader({
  workflowName,
  onRenameWorkflow,
  isRunning,
  onRunWorkflow,
  onSaveWorkflow,
  isSaving = false,
  isSaved = false,
  sampleEmailId,
  onSelectSampleEmail,
  sampleEmails = [],
  validationErrors = [],
  onOpenTemplates,
  onOpenSettings,
  onToggleLogs,
  onOpenAiAssistant,
  onExportWorkflow,
  onImportWorkflow,
  onClearWorkflow,
  hasLogs,
  nodeCount,
}: BuilderHeaderProps) {
  const { user } = useAuth();
  const hasErrors = validationErrors.length > 0;
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      try {
        const res = await apiFetch<{ pendingApprovalsCount: number }>('/api/notifications');
        if (res && typeof res.pendingApprovalsCount === 'number') {
          setPendingApprovalsCount(res.pendingApprovalsCount);
        }
      } catch {
        // Non-fatal
      }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <header className="h-14 bg-surface border-b border-border px-4 flex items-center justify-between select-none z-20 font-sans">
      {/* Left: Branding & Workflow Title */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2 pr-3 border-r border-border text-left">
          <div className="w-8 h-8 rounded-lg bg-red flex items-center justify-center text-white shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-tight text-text">FlowCart</span>
              <span className="text-[9px] font-mono font-semibold bg-red-soft text-red-text border border-red/20 px-1 rounded">
                v2
              </span>
            </div>
            <p className="text-[9px] text-muted font-mono leading-none">Email Automation</p>
          </div>
        </div>

        {/* Workflow Title & Node Count */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => onRenameWorkflow(e.target.value)}
            className="text-xs font-semibold text-text bg-transparent hover:bg-surface-2 focus:bg-surface-2 border border-transparent hover:border-border focus:border-red rounded px-2 py-1 w-52 focus:outline-none transition-all truncate"
            title="Click to rename workflow"
          />
          <span className="text-[10px] font-mono text-muted bg-surface-2 px-2 py-0.5 rounded border border-border">
            {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
          </span>

          {/* Validation Warning Indicator */}
          {hasErrors && (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-red-soft text-red-text border border-red/30"
              title={validationErrors.map((e) => e.message).join('\n')}
            >
              <AlertCircle className="w-3 h-3 text-red" />
              <span>{validationErrors.length} {validationErrors.length === 1 ? 'issue' : 'issues'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Execution Logs Button */}
        {hasLogs && (
          <button
            onClick={onToggleLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-red-text" />
            <span>Logs</span>
          </button>
        )}

        {/* AI Co-Pilot Toggle */}
        <button
          onClick={onOpenAiAssistant}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
          title="Open AI Command Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-red-text" />
          <span>AI Assistant</span>
        </button>

        {/* Templates */}
        <button
          onClick={onOpenTemplates}
          className="px-3 py-1.5 rounded text-xs font-medium text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
        >
          Templates
        </button>

        {/* Export JSON */}
        <button
          onClick={onExportWorkflow}
          className="p-1.5 rounded text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
          title="Export Workflow JSON"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Import JSON */}
        <button
          onClick={onImportWorkflow}
          className="p-1.5 rounded text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
          title="Import Workflow JSON"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>

        {/* Clear Canvas */}
        <button
          onClick={onClearWorkflow}
          className="p-1.5 rounded text-muted hover:text-red-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
          title="Clear Canvas"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* Executions */}
        <Link
          href="/executions"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
          title="Workflow Executions & Audit Logs"
        >
          <Activity className="w-3.5 h-3.5 text-red-text" />
          <span>Executions</span>
        </Link>

        {/* Command Center Agent */}
        <Link
          href="/agent"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
          title="Command Center Agent"
        >
          <Bot className="w-3.5 h-3.5 text-red-text" />
          <span>Agent</span>
        </Link>

        {/* Long-Term Memory */}
        <Link
          href="/memory"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
          title="Long-Term Memory Management"
        >
          <Brain className="w-3.5 h-3.5 text-red-text" />
          <span>Memory</span>
        </Link>

        {/* Approvals Queue */}
        <Link
          href="/approvals"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors relative"
          title="Approvals Queue"
        >
          <Bell className="w-3.5 h-3.5 text-red-text" />
          <span>Approvals</span>
          {pendingApprovalsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red text-white text-[9px] font-mono font-bold leading-tight shadow-sm">
              {pendingApprovalsCount}
            </span>
          )}
        </Link>

        {/* Settings */}
        <Link
          href="/settings"
          className="p-1.5 rounded text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
          title="Workspace Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </Link>

        {/* Admin Console (Admin Only) */}
        {user?.role === 'admin' && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-red hover:text-red-hover bg-red-soft hover:bg-red-soft/80 border border-red/30 transition-colors"
            title="Administrator Operations Console"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </Link>
        )}

        {/* User / Security Settings */}
        {user ? (
          <Link
            href="/settings/security"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
            title={`Signed in as ${user.email} - Security Settings`}
          >
            <Shield className="w-3.5 h-3.5 text-red" />
            <span className="max-w-[80px] truncate">{user.name || user.email.split('@')[0]}</span>
          </Link>

        ) : (
          <Link
            href="/login"
            className="px-2.5 py-1.5 rounded text-xs font-medium text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
          >
            Sign in
          </Link>
        )}

        {/* Save Workflow Button */}
        {onSaveWorkflow && (
          <button
            onClick={onSaveWorkflow}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              isSaved
                ? 'bg-surface-2 text-[#F4F4F5] border-border'
                : 'bg-surface-2 text-text hover:bg-[#222227] border-border'
            }`}
            title="Save workflow graph to database"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-red" />
            ) : isSaved ? (
              <Check className="w-3.5 h-3.5 text-[#F4F4F5]" />
            ) : (
              <Save className="w-3.5 h-3.5 text-muted" />
            )}
            <span>{isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        )}

        {/* Sample Email Selector for Test Runs */}
        {sampleEmails.length > 0 && onSelectSampleEmail && (
          <select
            value={sampleEmailId || ''}
            onChange={(e) => onSelectSampleEmail(e.target.value)}
            className="bg-surface-2 text-text text-xs px-2.5 py-1.5 rounded border border-border focus:border-red focus:outline-none font-mono max-w-[140px] truncate"
            title="Choose sample email for test run"
          >
            {sampleEmails.map((se) => (
              <option key={se.id} value={se.id}>
                {se.name}
              </option>
            ))}
          </select>
        )}

        {/* Primary Test Run Button */}
        <button
          onClick={onRunWorkflow}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white bg-red hover:bg-red-hover active:bg-red-press transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Test Run</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
