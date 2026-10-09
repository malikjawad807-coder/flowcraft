import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Sparkles, Brain, Trash2, Database, Plus, 
  CheckCircle2, AlertCircle, RefreshCw, MessageSquare, Edit2, 
  Terminal, ShieldCheck, HelpCircle
} from 'lucide-react';

export default function AgentPage() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [memories, setMemories] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('chat'); // 'chat' | 'memories'
  const [toast, setToast] = useState(null);

  // New memory modal
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryType, setNewMemoryType] = useState('preference');

  const messagesEndRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages();
    fetchMemories();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/agent/messages');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/agent/memories');
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || sending) return;

    const userMsg = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic UI update
    setMessages((prev) => [...prev, { id: `temp-${Date.now()}`, role: 'user', content: userMsg }]);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      fetchMessages();
      fetchMemories(); // Refresh if memory was captured
    } catch (err) {
      showToast(err.message || 'Chat error', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!confirm('Clear entire conversation history?')) return;
    try {
      await fetch('/api/agent/messages', { method: 'DELETE' });
      setMessages([]);
      showToast('Conversation cleared');
    } catch (err) {
      showToast('Failed to clear chat', 'error');
    }
  };

  const handleSaveMemory = async (e) => {
    e.preventDefault();
    if (!newMemoryContent.trim()) return;
    try {
      const res = await fetch('/api/agent/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newMemoryType, content: newMemoryContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Memory item saved');
      setShowAddMemory(false);
      setNewMemoryContent('');
      fetchMemories();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteMemory = async (id) => {
    try {
      await fetch(`/api/agent/memories/${id}`, { method: 'DELETE' });
      showToast('Memory removed');
      fetchMemories();
    } catch (err) {
      showToast('Failed to delete memory', 'error');
    }
  };

  const handleClearAllMemories = async () => {
    if (!confirm('Clear all long-term memory entries?')) return;
    try {
      await fetch('/api/agent/memories', { method: 'DELETE' });
      showToast('All memories cleared');
      fetchMemories();
    } catch (err) {
      showToast('Failed to clear memories', 'error');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 border text-xs font-mono shadow-2xl ${
          toast.type === 'error'
            ? 'bg-[#1C0000] border-[#E10600] text-[#FF4D4D]'
            : 'bg-[#001A09] border-[#10B981] text-[#34D399]'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-[#E10600]" /> : <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#2A2A2A] gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-wider uppercase text-white font-mono flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#E10600]" />
            AI Executive Assistant & Memory Vault
          </h1>
          <p className="text-xs text-[#888888] mt-1 font-mono">
            Direct workflow synthesizer with persistent memory and autonomous schema execution.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`px-3 py-1.5 border uppercase font-semibold transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'chat'
                ? 'bg-[#1C1C1C] border-[#E10600] text-white'
                : 'bg-[#141414] border-[#2A2A2A] text-[#888888] hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#E10600]" />
            <span>Agent Chat</span>
          </button>

          <button
            onClick={() => setActiveSubTab('memories')}
            className={`px-3 py-1.5 border uppercase font-semibold transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'memories'
                ? 'bg-[#1C1C1C] border-[#E10600] text-white'
                : 'bg-[#141414] border-[#2A2A2A] text-[#888888] hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-[#E10600]" />
            <span>Memory Vault ({memories.length})</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'chat' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Conversation */}
          <div className="lg:col-span-3 bg-[#141414] border border-[#2A2A2A] flex flex-col h-[650px] font-mono text-xs">
            {/* Chat Header */}
            <div className="p-3 border-b border-[#2A2A2A] flex items-center justify-between bg-[#0E0E0E]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="font-bold text-white uppercase text-[11px]">FlowCart Executive Agent</span>
                <span className="text-[10px] text-[#666666]">Autonomous Mode</span>
              </div>
              <button
                onClick={handleClearChat}
                className="text-[10px] text-[#888888] hover:text-[#EF4444] uppercase"
              >
                Clear History
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#666666]">
                  <Bot className="w-10 h-10 mb-3 text-[#333333]" />
                  <div className="text-white font-semibold mb-1 uppercase text-xs">
                    FlowCart AI Agent Ready
                  </div>
                  <p className="max-w-md text-[11px] mb-4">
                    Ask me to build cold outreach workflows, check your leads database, run executions, or store business preferences.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {[
                      'Create a workflow that emails pending leads every day at 10am',
                      'Show my pending leads and summarize their status',
                      'Remember that our niche is B2B SaaS in New York',
                      'List all currently configured workflows',
                    ].map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setInputText(prompt);
                        }}
                        className="bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#E10600] text-white px-2.5 py-1 text-[11px] text-left transition-colors"
                      >
                        "{prompt}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="text-[10px] text-[#666666] uppercase mb-1 font-semibold">
                    {msg.role === 'user' ? 'You' : 'FlowCart AI'}
                  </div>
                  <div
                    className={`max-w-xl p-3 border leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#1C1C1C] border-[#333333] text-white'
                        : 'bg-[#0A0A0A] border-[#2A2A2A] text-[#DDDDDD]'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Box */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-[#2A2A2A] bg-[#0E0E0E] flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask agent to build a workflow, inspect leads, or save memory..."
                className="flex-1 bg-[#141414] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white placeholder-[#555555] focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="bg-[#E10600] hover:bg-[#FF1A1A] disabled:opacity-50 text-white px-4 py-2 uppercase font-semibold tracking-wider flex items-center gap-1.5 transition-colors"
              >
                {sending ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send</span>
              </button>
            </form>
          </div>

          {/* Side Context Panel: Active Memories */}
          <div className="space-y-4 font-mono text-xs">
            <div className="bg-[#141414] border border-[#2A2A2A] p-4">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#2A2A2A]">
                <div className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-[#E10600]" />
                  <span>Grounding Memories</span>
                </div>
                <span className="text-[10px] text-[#888888]">{memories.length} saved</span>
              </div>

              {memories.length === 0 ? (
                <div className="text-[11px] text-[#666666] italic">
                  No active memories. Tell the agent your business preferences (e.g., tone, wait limits, niche) to ground future workflows automatically.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {memories.slice(0, 5).map((m) => (
                    <div key={m.id} className="p-2 bg-[#0A0A0A] border border-[#222222] text-[11px]">
                      <div className="text-[9px] text-[#E10600] uppercase font-bold">{m.type}</div>
                      <div className="text-white mt-0.5 line-clamp-2">{m.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#141414] border border-[#2A2A2A] p-4 text-[11px] text-[#888888] space-y-2">
              <div className="text-white font-bold uppercase text-[11px] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#E10600]" />
                <span>Safety Guardrails</span>
              </div>
              <div>• Asks user confirmation before activating workflows</div>
              <div>• Daily send limits enforced from settings</div>
              <div>• Unsubscribed and invalid leads are strictly excluded</div>
            </div>
          </div>
        </div>
      ) : (
        /* Memory Management Tab */
        <div className="space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between bg-[#141414] border border-[#2A2A2A] p-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Long-Term Memory Vault
              </h2>
              <p className="text-[11px] text-[#888888] mt-0.5">
                Saved preferences, operational rules, and persistent context used by the agent to tailor workflows.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearAllMemories}
                disabled={memories.length === 0}
                className="bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#EF4444] text-[#888888] hover:text-[#EF4444] px-3 py-1.5 uppercase text-[11px] transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowAddMemory(true)}
                className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-3.5 py-1.5 uppercase font-semibold text-[11px] flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Memory Item</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {memories.map((m) => (
              <div key={m.id} className="bg-[#141414] border border-[#2A2A2A] p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
                    <span className="text-[10px] text-[#E10600] uppercase font-bold px-1.5 py-0.2 bg-[#E10600]/10 border border-[#E10600]/30">
                      {m.type}
                    </span>
                    <span className="text-[10px] text-[#666666]">
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-white text-xs mt-2 leading-relaxed">
                    {m.content}
                  </p>
                </div>
                <div className="flex justify-end pt-2 border-t border-[#222222]">
                  <button
                    onClick={() => handleDeleteMemory(m.id)}
                    className="p-1 text-[#666666] hover:text-[#EF4444]"
                    title="Delete Memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddMemory && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2A2A2A] w-full max-w-md p-6 font-mono text-xs">
            <h3 className="text-sm font-bold uppercase text-white mb-3">Add Long-Term Memory</h3>
            <form onSubmit={handleSaveMemory} className="space-y-3">
              <div>
                <label className="block text-[#888888] uppercase text-[10px] mb-1">Memory Type</label>
                <select
                  value={newMemoryType}
                  onChange={(e) => setNewMemoryType(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] p-2 text-white"
                >
                  <option value="preference">Preference (Tone, Limits, Style)</option>
                  <option value="fact">Fact (Company profile, Niche, Offers)</option>
                  <option value="summary">Summary (Campaign takeaway)</option>
                </select>
              </div>
              <div>
                <label className="block text-[#888888] uppercase text-[10px] mb-1">Content</label>
                <textarea
                  rows={4}
                  required
                  value={newMemoryContent}
                  onChange={(e) => setNewMemoryContent(e.target.value)}
                  placeholder="e.g. Always maintain a polite and consultative tone. Daily sending limit is 25 emails."
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] p-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#2A2A2A]">
                <button
                  type="button"
                  onClick={() => setShowAddMemory(false)}
                  className="px-3 py-1.5 border border-[#2A2A2A] text-[#888888] uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#E10600] text-white px-4 py-1.5 uppercase font-semibold"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
