'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  Bot,
  Zap,
  Play,
  Plus,
  Copy,
  Check,
  ChevronDown,
  Key,
  Trash2,
  Loader2,
  Terminal,
  Cpu,
  Mail,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { NodeType } from '@/types/workflow';

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  badge: string;
  badgeColor: string;
  description: string;
}

export const AI_MODELS: AIModelOption[] = [
  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Omni)',
    provider: 'openai',
    badge: 'OpenAI',
    badgeColor: 'text-purple-300 bg-purple-950/80 border-purple-800/60',
    description: 'Flagship multimodal reasoning model',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    badge: 'OpenAI',
    badgeColor: 'text-purple-300 bg-purple-950/80 border-purple-800/60',
    description: 'Fast, cost-efficient everyday task runner',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    badge: 'OpenAI',
    badgeColor: 'text-purple-300 bg-purple-950/80 border-purple-800/60',
    description: 'Legacy high-throughput completions',
  },

  // Anthropic Claude
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    badge: 'Anthropic',
    badgeColor: 'text-amber-300 bg-amber-950/80 border-amber-800/60',
    description: 'Industry-leading coding and nuanced writing',
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    badge: 'Anthropic',
    badgeColor: 'text-amber-300 bg-amber-950/80 border-amber-800/60',
    description: 'Maximum intelligence for complex reasoning',
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    badge: 'Anthropic',
    badgeColor: 'text-amber-300 bg-amber-950/80 border-amber-800/60',
    description: 'Ultra-fast near-instant responses',
  },

  // Google Gemini
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    badge: 'Google',
    badgeColor: 'text-cyan-300 bg-cyan-950/80 border-cyan-800/60',
    description: 'Large 2M token context window for deep analysis',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    badge: 'Google',
    badgeColor: 'text-cyan-300 bg-cyan-950/80 border-cyan-800/60',
    description: 'High-speed multimodal lightweight model',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    badge: 'Google',
    badgeColor: 'text-cyan-300 bg-cyan-950/80 border-cyan-800/60',
    description: 'Next-gen real-time multimodal intelligence',
  },
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
  workflowAction?: any;
}

interface AiAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  apiKeys: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    geminiApiKey?: string;
    [key: string]: any;
  };
  onOpenSettings: () => void;
  onAddNodeToCanvas: (type: NodeType) => void;
  onRunWorkflow: () => void;
  onClearWorkflow: () => void;
  onLoadTemplate: (templateId: string) => void;
}

export function AiAssistantPanel({
  isOpen,
  onClose,
  selectedModel,
  onSelectModel,
  apiKeys,
  onOpenSettings,
  onAddNodeToCanvas,
  onRunWorkflow,
  onClearWorkflow,
  onLoadTemplate,
}: AiAssistantPanelProps) {
  const currentModelObj =
    AI_MODELS.find((m) => m.id === selectedModel) || AI_MODELS[0];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your **FlowCraft AI Co-Pilot**.\n\nYou can ask me to draft high-converting emails, generate personalized copy, or control your workflow canvas (e.g. *"Add a Gmail node"*, *"Run workflow"*, or *"Suggest subject lines"*).\n\nUse the model selector above to switch between OpenAI, Claude, and Gemini anytime!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: currentModelObj.name,
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          provider: currentModelObj.provider,
          model: currentModelObj.id,
          apiKeys,
        }),
      });

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Request completed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.model || currentModelObj.name,
        workflowAction: data.workflowAction,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Automatically execute detected canvas action
      if (data.workflowAction) {
        if (data.workflowAction.type === 'ADD_NODE') {
          onAddNodeToCanvas(data.workflowAction.nodeType);
        } else if (data.workflowAction.type === 'RUN_WORKFLOW') {
          onRunWorkflow();
        } else if (data.workflowAction.type === 'CLEAR_CANVAS') {
          onClearWorkflow();
        } else if (data.workflowAction.type === 'LOAD_TEMPLATE') {
          onLoadTemplate(data.workflowAction.templateId);
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasKeyForCurrentProvider =
    currentModelObj.provider === 'openai'
      ? Boolean(apiKeys.openaiApiKey)
      : currentModelObj.provider === 'anthropic'
      ? Boolean(apiKeys.anthropicApiKey)
      : Boolean(apiKeys.geminiApiKey);

  return (
    <div className="fixed inset-y-0 right-0 w-[440px] bg-[#12161f] border-l border-slate-800 shadow-2xl z-40 flex flex-col font-sans animate-in slide-in-from-right duration-200">
      {/* Header with Model Selector */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-600/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>AI Assistant Co-Pilot</span>
              </h3>
              <p className="text-[10px] text-slate-400">Workflow controller &amp; content generator</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multi-Model Selector Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
              className="w-full appearance-none bg-slate-950 text-xs text-slate-200 pl-3 pr-8 py-2 rounded-lg border border-slate-700 hover:border-slate-600 focus:border-purple-500 focus:outline-none font-medium cursor-pointer transition-colors"
            >
              <optgroup label="OpenAI / ChatGPT">
                {AI_MODELS.filter((m) => m.provider === 'openai').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.badge})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Anthropic Claude">
                {AI_MODELS.filter((m) => m.provider === 'anthropic').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.badge})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Google Gemini">
                {AI_MODELS.filter((m) => m.provider === 'google').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.badge})
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Key status badge / trigger */}
          <button
            onClick={onOpenSettings}
            title={hasKeyForCurrentProvider ? 'Live API Key connected' : 'Click to configure API key'}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-lg border text-[11px] font-mono transition-colors shrink-0 ${
              hasKeyForCurrentProvider
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/60'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{hasKeyForCurrentProvider ? 'Key Ready' : 'Set Key'}</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/40">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Header info */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1 px-1 font-mono">
              <span>{m.role === 'user' ? 'You' : m.modelUsed || 'AI Co-Pilot'}</span>
              <span>•</span>
              <span>{m.timestamp}</span>
            </div>

            {/* Message Bubble */}
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-purple-600 text-white rounded-tr-sm shadow-md'
                  : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-sm shadow-sm'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>

              {/* Action trigger feedback */}
              {m.workflowAction && (
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    Action Executed: {m.workflowAction.type}
                  </span>
                </div>
              )}

              {/* Copy action for assistant messages */}
              {m.role === 'assistant' && (
                <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-end gap-2 text-[10px]">
                  <button
                    onClick={() => handleCopy(m.content, m.id)}
                    className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {copiedId === m.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-purple-400 font-mono bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 max-w-[200px]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{currentModelObj.name} thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Command Chips */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <button
          onClick={() => handleSend('Draft a cold sales email for B2B executives')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
        >
          Draft Sales Email
        </button>
        <button
          onClick={() => handleSend('Suggest 3 high-converting email subject lines')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
        >
          Subject Lines
        </button>
        <button
          onClick={() => handleSend('Add a Gmail node to canvas')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3 text-red-400" /> Add Gmail Node
        </button>
        <button
          onClick={() => handleSend('Run workflow')}
          className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors flex items-center gap-1"
        >
          <Play className="w-3 h-3 text-emerald-400" /> Run Workflow
        </button>
      </div>

      {/* Input bar */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-900/90">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${currentModelObj.name} or type workflow command...`}
            className="flex-1 bg-slate-950 text-xs text-slate-200 px-3 py-2 rounded-xl border border-slate-700 focus:border-purple-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
