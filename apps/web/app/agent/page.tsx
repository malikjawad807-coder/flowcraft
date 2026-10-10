'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Plus,
  Send,
  Square,
  Trash2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Brain,
  Wrench,
  Check,
  X,
  Layers,
  ShieldAlert,
  ArrowDown,
  RotateCcw,
  Menu,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';
import { SafeMarkdown } from '@/components/markdown/SafeMarkdown';

interface Conversation {
  id: string;
  title: string | null;
  temporary: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ToolExecution {
  toolName: string;
  argsSummary?: string;
  status: 'running' | 'completed' | 'error';
  summary?: string;
}

interface ApprovalCardData {
  id: string;
  toolName: string;
  preview: {
    recipient?: string;
    subject?: string;
    body?: string;
    warning?: string;
  };
  args?: any;
  status: 'pending' | 'approved' | 'rejected';
}

interface Message {
  id: string | number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolExecutions?: ToolExecution[];
  approval?: ApprovalCardData;
  memoriesCount?: number;
  isStreaming?: boolean;
  createdAt?: string;
}

const SUGGESTIONS = [
  'Summarise my unread emails',
  'Draft a reply to my latest email from a customer',
  'Find emails about urgent issues',
  'Check if I have any pending requests',
];

export default function AgentCommandCenterPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Conversations list & active selection
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isTemporary, setIsTemporary] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Messages & active streaming
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // UI state
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [editableBodies, setEditableBodies] = useState<Record<string, string>>({});
  const [decidingApprovalId, setDecidingApprovalId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Require auth
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await apiFetch<{ conversations: Conversation[] }>('/api/agent/conversations');
      if (res?.conversations) {
        setConversations(res.conversations);
        if (!activeConvId && res.conversations.length > 0) {
          setActiveConvId(res.conversations[0].id);
        }
      }
    } catch {
      // Non-fatal if fails
    } finally {
      setLoadingConversations(false);
    }
  }, [activeConvId]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Load active conversation messages
  const loadMessages = useCallback(async (convId: string) => {
    try {
      const res = await apiFetch<{ conversation: Conversation; messages: any[] }>(
        `/api/agent/conversations/${convId}`
      );
      if (res?.messages) {
        const formatted: Message[] = res.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content || '',
            createdAt: m.createdAt,
          }));
        setMessages(formatted);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId, loadMessages]);

  // Auto-scroll logic
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom();
    }
  }, [messages, showScrollBottom]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollBottom(!isAtBottom);
  };

  // Start a new conversation
  const handleNewChat = async () => {
    try {
      const res = await apiFetch<{ conversation: Conversation }>('/api/agent/conversations', {
        method: 'POST',
        body: JSON.stringify({
          temporary: isTemporary,
          title: isTemporary ? 'Temporary Chat' : 'New Chat',
        }),
      });

      if (res?.conversation) {
        setConversations((prev) => [res.conversation, ...prev]);
        setActiveConvId(res.conversation.id);
        setMessages([]);
        setIsMobileSidebarOpen(false);
      }
    } catch (err: any) {
      setRunError(err?.message || 'Failed to start new chat.');
    }
  };

  // Delete a conversation
  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/agent/conversations/${id}`, { method: 'DELETE' });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      setRunError(err?.message || 'Failed to delete conversation.');
    }
  };

  // Connect SSE stream for an agent run
  const connectStream = useCallback((runId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/agent/runs/${runId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('text_delta', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const delta = data.delta || '';
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + delta },
            ];
          }
          return prev;
        });
      } catch {
        // Parse error ignored
      }
    });

    es.addEventListener('memory_used', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, memoriesCount: data.count },
            ];
          }
          return prev;
        });
      } catch {
        // Ignore
      }
    });

    es.addEventListener('tool_call_started', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const toolExecution: ToolExecution = {
          toolName: data.name,
          argsSummary: data.argsSummary || '',
          status: 'running',
        };
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            const list = last.toolExecutions || [];
            return [
              ...prev.slice(0, -1),
              { ...last, toolExecutions: [...list, toolExecution] },
            ];
          }
          return prev;
        });
      } catch {
        // Ignore
      }
    });

    es.addEventListener('tool_call_finished', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant' && last.toolExecutions) {
            const list = [...last.toolExecutions];
            const runningIdx = list.findIndex(
              (t) => t.toolName === data.name && t.status === 'running'
            );
            if (runningIdx !== -1) {
              list[runningIdx] = {
                ...list[runningIdx],
                status: data.status === 'ok' ? 'completed' : 'error',
                summary: data.summary,
              };
            }
            return [
              ...prev.slice(0, -1),
              { ...last, toolExecutions: list },
            ];
          }
          return prev;
        });
      } catch {
        // Ignore
      }
    });

    es.addEventListener('approval_required', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const approval: ApprovalCardData = {
          id: data.id,
          toolName: data.toolName,
          preview: data.preview,
          args: data.args,
          status: 'pending',
        };

        if (data.preview?.body) {
          setEditableBodies((prev) => ({ ...prev, [data.id]: data.preview.body }));
        }

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              { ...last, approval },
            ];
          }
          return prev;
        });
        setIsRunning(false);
      } catch {
        // Ignore
      }
    });

    es.addEventListener('message_final', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'assistant') {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: data.content || last.content,
                isStreaming: false,
              },
            ];
          }
          return prev;
        });
      } catch {
        // Ignore
      }
    });

    es.addEventListener('error', (e: any) => {
      try {
        if (e.data) {
          const data = JSON.parse(e.data);
          setRunError(data.message || 'Agent encountered an error.');
        }
      } catch {
        // Fallback network error
      }
      setIsRunning(false);
      es.close();
    });

    es.addEventListener('run_finished', () => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, isStreaming: false },
          ];
        }
        return prev;
      });
      setIsRunning(false);
      es.close();
    });

    es.onerror = () => {
      // Stream closed or error
      setIsRunning(false);
      es.close();
    };
  }, []);

  // Send message
  const handleSend = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isRunning) return;

    setRunError(null);
    setInputText('');

    // Optimistically add user message
    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: textToSend,
      createdAt: new Date().toISOString(),
    };

    // Placeholder assistant message
    const assistantMsg: Message = {
      id: `asst_${Date.now()}`,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolExecutions: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsRunning(true);

    try {
      const res = await apiFetch<{
        conversationId: string;
        runId: string;
        status: string;
      }>('/api/agent/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConvId || undefined,
          text: textToSend,
          temporary: isTemporary,
        }),
      });

      if (res?.conversationId && res.conversationId !== activeConvId) {
        setActiveConvId(res.conversationId);
        loadConversations();
      }

      if (res?.runId) {
        setActiveRunId(res.runId);
        connectStream(res.runId);
      }
    } catch (err: any) {
      setIsRunning(false);
      setRunError(err?.message || 'Failed to send message.');
      setMessages((prev) => prev.slice(0, -1)); // Remove empty assistant bubble
    }
  };

  // Stop / Cancel active run
  const handleStopRun = async () => {
    if (!activeRunId) return;
    try {
      await apiFetch(`/api/agent/runs/${activeRunId}/cancel`, { method: 'POST' });
    } catch {
      // Ignore
    } finally {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setIsRunning(false);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + '\n\n*(Run stopped by user)*', isStreaming: false },
          ];
        }
        return prev;
      });
    }
  };

  // Handle inline approval decision
  const handleDecideApproval = async (
    approvalId: string,
    decision: 'approve' | 'reject'
  ) => {
    setDecidingApprovalId(approvalId);
    try {
      const editedBody = editableBodies[approvalId];
      const payload = decision === 'approve' && editedBody ? { editedArgs: { bodyText: editedBody } } : {};

      const res = await apiFetch<{ status: string; runId?: string }>(
        `/api/approvals/${approvalId}/${decision}`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      // Update approval card state in messages
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.approval && msg.approval.id === approvalId) {
            return {
              ...msg,
              approval: {
                ...msg.approval,
                status: decision === 'approve' ? 'approved' : 'rejected',
              },
            };
          }
          return msg;
        })
      );

      // If run resumed, re-connect streaming
      if (res?.runId) {
        setIsRunning(true);
        setActiveRunId(res.runId);
        connectStream(res.runId);
      }
    } catch (err: any) {
      setRunError(err?.message || `Failed to ${decision} action.`);
    } finally {
      setDecidingApprovalId(null);
    }
  };

  // Keyboard navigation on composer
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text font-sans select-none">
      {/* Mobile Drawer Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-30 sm:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar (240px) */}
      <aside
        className={`fixed sm:static top-0 bottom-0 left-0 z-40 w-64 bg-surface border-r border-border flex flex-col transition-transform duration-150 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
        }`}
      >
        {/* Top Header */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold hover:text-red-text transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted" />
            <span>Workflow Studio</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red" />
            <span className="text-[10px] font-mono font-medium text-red-text">Agent</span>
          </div>
        </div>

        {/* New Chat & Temporary Toggle */}
        <div className="p-3 space-y-2 border-b border-border">
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-btn text-xs font-medium text-white bg-red hover:bg-red-hover active:bg-red-press transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Chat</span>
          </button>

          {/* Temporary Chat Toggle */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-surface-2 border border-border">
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-medium text-text">Temporary chat</span>
              <span className="text-[9px] text-muted">Memory disabled</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isTemporary}
              onClick={() => setIsTemporary(!isTemporary)}
              className={`w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 ${
                isTemporary ? 'bg-red' : 'bg-[#2A2A2F]'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white transition-transform ${
                  isTemporary ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-mono text-muted uppercase tracking-wider">
            Conversations
          </div>
          {loadingConversations ? (
            <div className="space-y-2 p-2">
              <div className="h-7 bg-surface-2 rounded animate-pulse" />
              <div className="h-7 bg-surface-2 rounded animate-pulse" />
              <div className="h-7 bg-surface-2 rounded animate-pulse" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted">
              No conversations yet. Start a new chat!
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeConvId;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveConvId(c.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-surface-2 text-text border border-red/30'
                      : 'text-muted hover:text-text hover:bg-surface-2/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-red' : 'text-muted'}`} />
                    <span className="truncate">{c.title || 'Untitled Conversation'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteConversation(e, c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-text transition-opacity"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border flex items-center justify-between text-[11px] text-muted">
          <Link href="/approvals" className="hover:text-text flex items-center gap-1.5 transition-colors">
            <Clock className="w-3.5 h-3.5 text-red-text" />
            <span>Approvals</span>
          </Link>
          <Link href="/settings" className="hover:text-text transition-colors">
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Chat View */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-14 border-b border-border bg-surface px-4 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg border border-border text-muted hover:text-text sm:hidden"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red flex items-center justify-center text-white">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h1 className="text-xs font-bold text-text">
                  {activeConversation?.title || 'Command Center'}
                </h1>
                <div className="flex items-center gap-1.5 text-[10px] text-muted font-mono">
                  <span>FlowCart Assistant</span>
                  {activeConversation?.temporary && (
                    <>
                      <span>•</span>
                      <span className="text-red-text">Temporary Session</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/approvals"
              className="px-2.5 py-1 rounded text-xs font-medium text-muted hover:text-text bg-surface-2 border border-border transition-colors flex items-center gap-1.5"
            >
              <Clock className="w-3 h-3 text-red-text" />
              <span>Pending Approvals</span>
            </Link>
          </div>
        </header>

        {/* Message Stream Scroll Area */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
        >
          {messages.length === 0 ? (
            /* Empty State with 4 Suggestion Chips */
            <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center space-y-6 py-12">
              <div className="w-12 h-12 rounded-2xl bg-red-soft border border-red/30 flex items-center justify-center text-red">
                <Brain className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-text">FlowCart Command Center</h2>
                <p className="text-xs text-muted leading-relaxed">
                  Ask the agent to review emails, draft replies, search conversations, or manage labels.
                  Actions that send mail will request your explicit approval first.
                </p>
              </div>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(s)}
                    className="p-3 text-left rounded-card bg-surface hover:bg-surface-2 border border-border hover:border-red/40 transition-colors text-xs text-text/90 flex items-start gap-2.5 group"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-red-text group-hover:text-red shrink-0 mt-0.5" />
                    <span className="leading-snug">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Render Messages */
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    {/* Role header */}
                    <div className="flex items-center gap-1.5 text-[10px] text-muted mb-1 px-1 font-mono">
                      <span>{isUser ? 'You' : 'Assistant'}</span>
                    </div>

                    {/* Message Card */}
                    <div
                      className={`rounded-card px-4 py-3 text-xs leading-relaxed max-w-[90%] sm:max-w-[85%] ${
                        isUser
                          ? 'bg-surface-2 text-text border border-border shadow-sm'
                          : 'bg-surface text-text border border-border shadow-sm space-y-3'
                      }`}
                    >
                      {/* Memory Usage Chip (Assistant Only) */}
                      {!isUser && m.memoriesCount !== undefined && m.memoriesCount > 0 && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-red-soft text-red-text border border-red/20 mb-1">
                          <Brain className="w-3 h-3 text-red" />
                          <span>{m.memoriesCount} {m.memoriesCount === 1 ? 'memory used' : 'memories used'}</span>
                        </div>
                      )}

                      {/* Tool Execution Chips (Assistant Only) */}
                      {!isUser && m.toolExecutions && m.toolExecutions.length > 0 && (
                        <div className="space-y-1.5 pb-1">
                          {m.toolExecutions.map((tool, tIdx) => {
                            const isExpanded = expandedTools[`${m.id}_${tIdx}`];
                            return (
                              <div
                                key={tIdx}
                                className="rounded-lg bg-surface-2 border border-border text-[11px] font-mono overflow-hidden"
                              >
                                <div
                                  onClick={() =>
                                    setExpandedTools((prev) => ({
                                      ...prev,
                                      [`${m.id}_${tIdx}`]: !prev[`${m.id}_${tIdx}`],
                                    }))
                                  }
                                  className="px-2.5 py-1.5 flex items-center justify-between cursor-pointer hover:bg-[#222227] transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {tool.status === 'running' ? (
                                      <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red" />
                                      </span>
                                    ) : tool.status === 'completed' ? (
                                      <Check className="w-3 h-3 text-muted" />
                                    ) : (
                                      <X className="w-3 h-3 text-red-text" />
                                    )}
                                    <span className="font-semibold text-text/90">{tool.toolName}</span>
                                    {tool.status === 'running' && (
                                      <span className="text-[10px] text-muted">Running...</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-muted">
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div className="px-2.5 py-2 bg-[#0E0E10] border-t border-border text-[10px] text-muted space-y-1">
                                    {tool.argsSummary && (
                                      <div>
                                        <span className="text-text/70">Args: </span>
                                        <span>{tool.argsSummary}</span>
                                      </div>
                                    )}
                                    {tool.summary && (
                                      <div>
                                        <span className="text-text/70">Result: </span>
                                        <span>{tool.summary}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Message Content */}
                      {m.content ? (
                        <SafeMarkdown content={m.content} />
                      ) : m.isStreaming ? (
                        <div className="flex items-center gap-1.5 text-muted font-mono text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />
                          <span>Thinking...</span>
                        </div>
                      ) : null}

                      {/* Inline Approval Card */}
                      {!isUser && m.approval && (
                        <div className="my-2 p-3.5 rounded-card bg-[#0E0E10] border border-red/40 space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-border">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-red" />
                              <span className="text-xs font-semibold text-text">Approval Required</span>
                            </div>
                            <span className="text-[10px] font-mono uppercase bg-red-soft text-red-text px-1.5 py-0.5 rounded border border-red/30">
                              {m.approval.toolName}
                            </span>
                          </div>

                          {/* Warning Banner */}
                          {m.approval.preview?.warning && (
                            <div className="p-2 rounded bg-red-soft border border-red/30 flex items-start gap-2 text-[11px] text-red-text">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span>{m.approval.preview.warning}</span>
                            </div>
                          )}

                          {/* Preview Details */}
                          <div className="space-y-1.5 text-[11px] font-mono">
                            <div className="flex items-center gap-2">
                              <span className="text-muted w-16">To:</span>
                              <span className="text-text font-medium">{m.approval.preview?.recipient || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted w-16">Subject:</span>
                              <span className="text-text">{m.approval.preview?.subject || '-'}</span>
                            </div>
                          </div>

                          {/* Editable Body */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-muted uppercase">Email Body (Editable)</label>
                            <textarea
                              disabled={m.approval.status !== 'pending'}
                              value={editableBodies[m.approval.id] ?? m.approval.preview?.body ?? ''}
                              onChange={(e) =>
                                setEditableBodies((prev) => ({
                                  ...prev,
                                  [m.approval!.id]: e.target.value,
                                }))
                              }
                              rows={4}
                              className="w-full bg-surface-2 text-text text-xs p-2.5 rounded border border-border focus:border-red focus:outline-none font-sans resize-none leading-relaxed"
                            />
                          </div>

                          {/* Approval Actions */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] font-mono text-muted">
                              Status: <strong className="uppercase text-text">{m.approval.status}</strong>
                            </span>
                            {m.approval.status === 'pending' ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={decidingApprovalId === m.approval.id}
                                  onClick={() => handleDecideApproval(m.approval!.id, 'reject')}
                                  className="px-3 py-1.5 rounded-btn text-xs font-medium text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors disabled:opacity-50"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  disabled={decidingApprovalId === m.approval.id}
                                  onClick={() => handleDecideApproval(m.approval!.id, 'approve')}
                                  className="px-3.5 py-1.5 rounded-btn text-xs font-semibold text-white bg-red hover:bg-red-hover active:bg-red-press transition-colors disabled:opacity-50 shadow-sm"
                                >
                                  Approve & Send
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-mono text-muted">
                                Decision recorded ({m.approval.status})
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Floating Jump to Bottom Button */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-20 right-8 p-2 rounded-full bg-surface-2 text-text border border-border hover:bg-[#222227] shadow-lg transition-transform hover:scale-105"
            title="Jump to latest message"
          >
            <ArrowDown className="w-4 h-4 text-red-text" />
          </button>
        )}

        {/* Error Banner with Retry */}
        {runError && (
          <div className="px-4 py-2 mx-4 mb-2 rounded bg-red-soft border border-red/40 flex items-center justify-between text-xs text-red-text">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red" />
              <span>{runError}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setRunError(null);
                const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                if (lastUser) handleSend(lastUser.content);
              }}
              className="flex items-center gap-1 font-mono font-medium hover:underline text-text"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Bottom Composer */}
        <div className="p-4 border-t border-border bg-surface">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="relative flex items-end gap-2 bg-surface-2 border border-border focus-within:border-red rounded-card p-2 transition-colors">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask FlowCart Assistant (e.g. 'Summarise unread emails from client')..."
                rows={1}
                className="flex-1 max-h-36 bg-transparent text-xs text-text placeholder-muted px-2 py-1 focus:outline-none resize-none leading-relaxed"
              />

              {isRunning ? (
                <button
                  type="button"
                  onClick={handleStopRun}
                  className="p-2 rounded-btn bg-red hover:bg-red-hover active:bg-red-press text-white transition-colors shadow-sm"
                  title="Stop agent run"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!inputText.trim()}
                  onClick={() => handleSend()}
                  className="p-2 rounded-btn bg-red hover:bg-red-hover active:bg-red-press text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  title="Send message (Enter)"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted font-mono px-1">
              <span>Enter to send • Shift+Enter for newline</span>
              <span>12 tool calls max • Prompt injection protected</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
