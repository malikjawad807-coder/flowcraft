'use client';

import React, { useState } from 'react';
import {
  X,
  Send,
  Sparkles,
  Users,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { ExtractedEmail } from '@/lib/email-extractor';

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'single' | 'bulk';
  targetEmails: ExtractedEmail[];
  apiKeys: {
    openaiApiKey?: string;
    userEmail?: string;
    appPassword?: string;
    gmailToken?: string;
  };
}

export function EmailComposerModal({
  isOpen,
  onClose,
  mode,
  targetEmails,
  apiKeys,
}: EmailComposerModalProps) {
  const [singleTo, setSingleTo] = useState(targetEmails[0]?.email || '');
  const [subject, setSubject] = useState('Exclusive opportunity & partnership with FlowCraft');
  const [body, setBody] = useState(
    'Hi there,\n\nI came across your organization and was impressed by your recent work.\n\nWe build visual workflow automations connecting AI pipelines and Gmail messaging to automate lead workflows.\n\nWould you be open to a quick 5-minute chat next week to explore ideas?\n\nBest regards,\nFlowCraft Team'
  );

  const [isSending, setIsSending] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [deliveryResults, setDeliveryResults] = useState<any[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const authMethod = apiKeys.appPassword ? 'app_password' : apiKeys.gmailToken ? 'oauth_token' : 'sandbox';

  // AI draft generator
  const handleGenerateAiBody = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Write a compelling, polite cold email regarding automation and partnerships. Keep it under 100 words. Subject should be catchy.`,
            },
          ],
          provider: 'openai',
          model: 'gpt-4o-mini',
          apiKeys,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setBody(data.reply);
      }
    } catch (e: any) {
      alert(`AI Generation error: ${e.message}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Execution
  const handleDispatch = async () => {
    setIsSending(true);
    setErrorMsg(null);
    setDeliveryResults(null);

    try {
      if (mode === 'single') {
        const res = await fetch('/api/email/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: singleTo,
            subject,
            body,
            authMethod,
            userEmail: apiKeys.userEmail,
            appPassword: apiKeys.appPassword,
            oauthToken: apiKeys.gmailToken,
          }),
        });
        const data = await res.json();
        setDeliveryResults([data]);
      } else {
        // Bulk Send
        const total = targetEmails.length;
        setProgress({ current: 0, total });

        const results: any[] = [];
        for (let i = 0; i < targetEmails.length; i++) {
          const email = targetEmails[i].email;
          setProgress({ current: i + 1, total });

          const res = await fetch('/api/email/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: email,
              subject,
              body,
              authMethod,
              userEmail: apiKeys.userEmail,
              appPassword: apiKeys.appPassword,
              oauthToken: apiKeys.gmailToken,
            }),
          });
          const itemRes = await res.json();
          results.push(itemRes);

          // Pacing delay
          if (i < targetEmails.length - 1) {
            await new Promise((r) => setTimeout(r, 120));
          }
        }

        setDeliveryResults(results);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Delivery error');
    } finally {
      setIsSending(false);
      setProgress(null);
    }
  };

  const successfulCount = deliveryResults?.filter((r) => r.success).length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-2xl bg-[#12161f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  {mode === 'bulk' ? 'Bulk Email Delivery' : 'Single Email Composer'}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border text-red-300 bg-red-950/80 border-red-800/60 font-semibold">
                  {mode === 'bulk' ? `${targetEmails.length} Recipients` : '1-to-1 Dispatch'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dispatch via connected personal Gmail credentials ({authMethod === 'app_password' ? 'App Password' : authMethod === 'oauth_token' ? 'OAuth Token' : 'Sandbox Simulator'})
              </p>
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
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {mode === 'single' ? (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Recipient (To)</label>
              <input
                type="email"
                value={singleTo}
                onChange={(e) => setSingleTo(e.target.value)}
                className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 font-mono text-red-200 focus:border-red-500 focus:outline-none"
                placeholder="recipient@example.com"
              />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  Target Recipient List ({targetEmails.length} contacts)
                </span>
                <span className="text-[10px] font-mono text-slate-500">Auto-parsed list</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 line-clamp-2">
                {targetEmails.map((t) => t.email).join(', ')}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-200 focus:border-red-500 focus:outline-none"
              placeholder="Email subject..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">Message Body</label>
              <button
                type="button"
                onClick={handleGenerateAiBody}
                disabled={isGeneratingAi}
                className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors"
              >
                {isGeneratingAi ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>Generate with AI Assistant</span>
              </button>
            </div>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-slate-900 text-xs p-3 rounded-lg border border-slate-700 text-slate-200 font-sans focus:border-red-500 focus:outline-none leading-relaxed"
            />
          </div>

          {/* Progress bar during bulk sending */}
          {progress && (
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                  Sending bulk emails...
                </span>
                <span className="text-red-400 font-bold">
                  {progress.current} of {progress.total}
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-red-500 h-full transition-all duration-200"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Delivery results log */}
          {deliveryResults && (
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Delivery Complete: {successfulCount} of {deliveryResults.length} Delivered
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {authMethod.toUpperCase()}
                </span>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[10px] text-slate-300">
                {deliveryResults.map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between p-1 rounded bg-slate-900/60">
                    <span className="truncate max-w-[220px]">{r.to}</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <FileCheck className="w-3 h-3" /> {r.messageId || 'Delivered'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Sends via connected Gmail API / SMTP</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDispatch}
              disabled={isSending || (mode === 'single' && !singleTo)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-900/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>
                {isSending
                  ? 'Dispatching...'
                  : mode === 'bulk'
                  ? `Send to All ${targetEmails.length} Emails`
                  : 'Send Email'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
