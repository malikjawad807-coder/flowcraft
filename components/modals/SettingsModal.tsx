'use client';

import React, { useState } from 'react';
import { X, Key, Mail, ShieldCheck, Check, Sparkles, Eye, EyeOff, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: {
    openaiApiKey?: string;
    userEmail?: string;
    appPassword?: string;
    gmailToken?: string;
  };
  onSaveKeys: (keys: {
    openaiApiKey?: string;
    userEmail?: string;
    appPassword?: string;
    gmailToken?: string;
  }) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  apiKeys,
  onSaveKeys,
}: SettingsModalProps) {
  const [openaiKey, setOpenaiKey] = useState(apiKeys.openaiApiKey || '');
  const [userEmail, setUserEmail] = useState(apiKeys.userEmail || '');
  const [appPassword, setAppPassword] = useState(apiKeys.appPassword || '');
  const [gmailToken, setGmailToken] = useState(apiKeys.gmailToken || '');

  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [showGmailToken, setShowGmailToken] = useState(false);

  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKeys({
      openaiApiKey: openaiKey,
      userEmail,
      appPassword,
      gmailToken,
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#12161f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <Key className="w-4 h-4 text-[#ff6d5a]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Global Workspace Credentials</h2>
              <p className="text-xs text-slate-400">Securely connect personal OpenAI and Gmail credentials</p>
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
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* OpenAI API Key */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Personal OpenAI API Key</span>
              </span>
              <span className="text-[10px] font-normal text-slate-500 font-mono">sk-proj-...</span>
            </label>
            <div className="relative">
              <input
                type={showOpenaiKey ? 'text' : 'password'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-proj-..."
                className="w-full bg-slate-900 text-xs px-3 py-2 pr-9 rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none font-mono text-purple-200"
              />
              <button
                type="button"
                onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showOpenaiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Used across all OpenAI nodes that inherit workspace credentials. Leave blank to run sandbox simulations.
            </p>
          </div>

          {/* Personal Gmail App Password */}
          <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-red-300">
                <Mail className="w-3.5 h-3.5 text-red-400" />
                <span>Personal Gmail Credentials (App Password)</span>
              </label>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-red-400 hover:underline flex items-center gap-0.5"
              >
                <span>Get App Password</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-0.5">Your Gmail Address</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="your.email@gmail.com"
                className="w-full bg-slate-950 text-xs px-2.5 py-1.5 rounded border border-slate-700 font-mono text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 mb-0.5">16-Character Google App Password</label>
              <div className="relative">
                <input
                  type={showAppPassword ? 'text' : 'password'}
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full bg-slate-950 text-xs px-2.5 py-1.5 pr-8 rounded border border-red-800/60 focus:border-red-500 focus:outline-none font-mono text-red-200"
                />
                <button
                  type="button"
                  onClick={() => setShowAppPassword(!showAppPassword)}
                  className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                >
                  {showAppPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Enables live 100% verified email dispatches and bulk delivery from your own Gmail account.
            </p>
          </div>

          {/* Gmail OAuth Token (Alternative) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Mail className="w-3.5 h-3.5 text-red-400" />
              <span>Gmail API OAuth Token (Alternative)</span>
            </label>
            <div className="relative">
              <input
                type={showGmailToken ? 'text' : 'password'}
                value={gmailToken}
                onChange={(e) => setGmailToken(e.target.value)}
                placeholder="ya29.a0AfH6S..."
                className="w-full bg-slate-900 text-xs px-3 py-2 pr-9 rounded-lg border border-slate-700 focus:border-red-500 focus:outline-none font-mono text-red-200"
              />
              <button
                type="button"
                onClick={() => setShowGmailToken(!showGmailToken)}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                {showGmailToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Optional Google Cloud OAuth Bearer Token.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Credentials remain strictly stored in client memory. They are securely transmitted over HTTPS directly to the execution endpoints.
            </span>
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
