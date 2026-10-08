'use client';

import React, { useState } from 'react';
import { X, Key, Mail, ShieldCheck, Check, Sparkles } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: { openaiApiKey?: string; gmailToken?: string };
  onSaveKeys: (keys: { openaiApiKey?: string; gmailToken?: string }) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  apiKeys,
  onSaveKeys,
}: SettingsModalProps) {
  const [openaiKey, setOpenaiKey] = useState(apiKeys.openaiApiKey || '');
  const [gmailToken, setGmailToken] = useState(apiKeys.gmailToken || '');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKeys({ openaiApiKey: openaiKey, gmailToken });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#12161f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <Key className="w-4 h-4 text-[#ff6d5a]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Credentials &amp; Settings</h2>
              <p className="text-xs text-slate-400">Configure API keys for live execution</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>OpenAI API Key</span>
            </label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none font-mono text-purple-200"
            />
            <p className="text-[11px] text-slate-500">
              Optional. If omitted, the engine uses high-fidelity simulation so workflows run immediately out of the box.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Mail className="w-3.5 h-3.5 text-red-400" />
              <span>Gmail API OAuth Token / Service Key</span>
            </label>
            <input
              type="password"
              value={gmailToken}
              onChange={(e) => setGmailToken(e.target.value)}
              placeholder="ya29.a0AfH6S..."
              className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-red-500 focus:outline-none font-mono text-red-200"
            />
            <p className="text-[11px] text-slate-500">
              Optional. If omitted, the engine executes in sandbox mode with live email receipt generation.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Keys are kept locally in your session memory for security and never logged.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff6d5a] hover:bg-[#ea580c] text-white text-xs font-semibold shadow-md transition-colors"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{saved ? 'Saved!' : 'Save Credentials'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
