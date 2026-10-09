'use client';

import React from 'react';
import {
  Play,
  Download,
  Upload,
  Settings,
  Sparkles,
  Terminal,
  Trash2,
  Loader2,
  Layers,
  Mail,
  Bot,
  Users,
} from 'lucide-react';
import { AI_MODELS } from '@/components/ai-assistant/AiAssistantPanel';

interface BuilderHeaderProps {
  workflowName: string;
  onRenameWorkflow: (name: string) => void;
  isRunning: boolean;
  onRunWorkflow: () => void;
  onOpenTemplates: () => void;
  onOpenSettings: () => void;
  onToggleLogs: () => void;
  onOpenExtractor: () => void;
  onOpenAiAssistant: () => void;
  onExportWorkflow: () => void;
  onImportWorkflow: () => void;
  onClearWorkflow: () => void;
  hasLogs: boolean;
  nodeCount: number;
  extractedEmailCount: number;
  selectedAiModel: string;
}

export function BuilderHeader({
  workflowName,
  onRenameWorkflow,
  isRunning,
  onRunWorkflow,
  onOpenTemplates,
  onOpenSettings,
  onToggleLogs,
  onOpenExtractor,
  onOpenAiAssistant,
  onExportWorkflow,
  onImportWorkflow,
  onClearWorkflow,
  hasLogs,
  nodeCount,
  extractedEmailCount,
  selectedAiModel,
}: BuilderHeaderProps) {
  const currentModel = AI_MODELS.find((m) => m.id === selectedAiModel) || AI_MODELS[0];

  return (
    <header className="h-14 bg-[#12161f] border-b border-slate-800/80 px-4 flex items-center justify-between select-none z-20 font-sans">
      {/* Left: Branding & Workflow Title */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-800/80">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#ff6d5a] to-rose-400 flex items-center justify-center text-white shadow-md shadow-[#ff6d5a]/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-tight text-white">FlowCraft</span>
              <span className="text-[9px] font-mono font-semibold bg-[#ff6d5a]/20 text-[#ff6d5a] border border-[#ff6d5a]/30 px-1 rounded">
                n8n
              </span>
            </div>
            <p className="text-[9px] text-slate-500 font-mono leading-none">Visual Workflow Studio</p>
          </div>
        </div>

        {/* Workflow Title */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => onRenameWorkflow(e.target.value)}
            className="text-xs font-medium text-slate-200 bg-transparent hover:bg-slate-800/60 focus:bg-slate-800/90 border border-transparent hover:border-slate-700/60 focus:border-slate-600 rounded px-2 py-1 w-52 focus:outline-none transition-all truncate"
            title="Click to rename workflow"
          />
          <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
            {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Universal Email Extractor Button */}
        <button
          onClick={onOpenExtractor}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/70 transition-all shadow-sm"
          title="Universal File Drag & Drop & Email Extraction"
        >
          <Mail className="w-3.5 h-3.5 text-emerald-400" />
          <span>Email Extractor</span>
          {extractedEmailCount > 0 && (
            <span className="text-[10px] font-mono bg-emerald-800/80 px-1.5 py-0.2 rounded-full font-bold text-white">
              {extractedEmailCount}
            </span>
          )}
        </button>

        {/* AI Assistant Co-Pilot Button with Active Model Badge */}
        <button
          onClick={onOpenAiAssistant}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/70 transition-all shadow-sm"
          title="Open AI Assistant Co-Pilot"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>AI Assistant</span>
          <span className="text-[9px] font-mono bg-purple-900/80 px-1.5 py-0.5 rounded border border-purple-700/60 text-purple-200 hidden md:inline">
            {currentModel.name.split(' ')[0]}
          </span>
        </button>

        {/* Templates Picker */}
        <button
          onClick={onOpenTemplates}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all shadow-sm"
        >
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Templates</span>
        </button>

        {/* Export JSON */}
        <button
          onClick={onExportWorkflow}
          title="Export Workflow JSON"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Export</span>
        </button>

        {/* Import JSON */}
        <button
          onClick={onImportWorkflow}
          title="Import Workflow JSON"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Import</span>
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="API Keys & Settings"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Clear Workflow */}
        <button
          onClick={onClearWorkflow}
          title="Clear Canvas"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/40 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Logs Drawer Toggle */}
        {hasLogs && (
          <button
            onClick={onToggleLogs}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 hover:bg-emerald-900/40 transition-colors font-mono"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Logs</span>
          </button>
        )}

        {/* Run Workflow CTA */}
        <button
          onClick={onRunWorkflow}
          disabled={isRunning || nodeCount === 0}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#ff6d5a] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white text-xs font-semibold shadow-lg shadow-[#ff6d5a]/25 hover:shadow-[#ff6d5a]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isRunning ? 'Running...' : 'Run Workflow'}</span>
          <span className="hidden md:inline-block text-[10px] bg-black/25 px-1 py-0.5 rounded font-mono font-normal">
            Ctrl+↵
          </span>
        </button>
      </div>
    </header>
  );
}
