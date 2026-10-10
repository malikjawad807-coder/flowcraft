'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Search,
  Plus,
  Pin,
  PinOff,
  Trash2,
  Edit2,
  Check,
  X,
  Download,
  AlertTriangle,
  ChevronLeft,
  Sparkles,
  Filter,
  RefreshCw,
  Info,
  Clock,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';

export interface MemoryItem {
  id: string;
  userId: string;
  text: string;
  category: 'profile' | 'preference' | 'contact' | 'project' | 'style' | 'rule';
  importance: number;
  pinned: boolean;
  source: 'explicit' | 'extracted' | 'manual';
  sourceConversationId?: string | null;
  useCount: number;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'profile', label: 'Profile' },
  { id: 'preference', label: 'Preferences' },
  { id: 'contact', label: 'Contacts' },
  { id: 'project', label: 'Projects' },
  { id: 'style', label: 'Style & Tone' },
  { id: 'rule', label: 'Standing Rules' },
] as const;

export default function MemoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Settings & Toggles
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryLearnEnabled, setMemoryLearnEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Memories Data
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [softCapReached, setSoftCapReached] = useState(false);
  const [hardCapReached, setHardCapReached] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState<MemoryItem['category']>('profile');
  const [editImportance, setEditImportance] = useState(3);
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Memory Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryItem['category']>('profile');
  const [newImportance, setNewImportance] = useState(3);
  const [newPinned, setNewPinned] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addingMemory, setAddingMemory] = useState(false);

  // Forget Everything Modal
  const [isForgetOpen, setIsForgetOpen] = useState(false);
  const [forgetConfirmText, setForgetConfirmText] = useState('');
  const [forgetting, setForgetting] = useState(false);
  const [forgetError, setForgetError] = useState<string | null>(null);

  // Load User Settings & Memories
  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch settings
      const settingsRes = await apiFetch<{
        settings: { memoryEnabled?: boolean; memoryLearnEnabled?: boolean };
      }>('/api/settings');

      if (settingsRes?.settings) {
        setMemoryEnabled(settingsRes.settings.memoryEnabled ?? true);
        setMemoryLearnEnabled(settingsRes.settings.memoryLearnEnabled ?? true);
      }

      // Fetch memories
      const memoryRes = await apiFetch<{
        memories: MemoryItem[];
        total: number;
        softCapReached: boolean;
        hardCapReached: boolean;
      }>('/api/memories');

      if (memoryRes) {
        setMemories(memoryRes.memories || []);
        setTotalCount(memoryRes.total || 0);
        setSoftCapReached(Boolean(memoryRes.softCapReached));
        setHardCapReached(Boolean(memoryRes.hardCapReached));
      }
    } catch (err: any) {
      console.error('Failed to load memory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      loadData();
    }
  }, [user, authLoading]);

  // Update Settings Switches
  const handleToggleSetting = async (key: 'memoryEnabled' | 'memoryLearnEnabled', val: boolean) => {
    try {
      setSavingSettings(true);
      if (key === 'memoryEnabled') setMemoryEnabled(val);
      if (key === 'memoryLearnEnabled') setMemoryLearnEnabled(val);

      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          [key]: val,
        }),
      });
    } catch (err: any) {
      console.error('Failed to update memory setting:', err);
      // Revert on error
      if (key === 'memoryEnabled') setMemoryEnabled(!val);
      if (key === 'memoryLearnEnabled') setMemoryLearnEnabled(!val);
    } finally {
      setSavingSettings(false);
    }
  };

  // Add Memory
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    if (newText.trim().length > 500) {
      setAddError('Memory text cannot exceed 500 characters.');
      return;
    }

    try {
      setAddingMemory(true);
      setAddError(null);

      const res = await apiFetch<{ memory: MemoryItem }>('/api/memories', {
        method: 'POST',
        body: JSON.stringify({
          text: newText.trim(),
          category: newCategory,
          importance: newImportance,
          pinned: newPinned,
        }),
      });

      if (res?.memory) {
        setIsAddOpen(false);
        setNewText('');
        setNewPinned(false);
        setNewImportance(3);
        await loadData();
      }
    } catch (err: any) {
      setAddError(err.message || 'Failed to save memory.');
    } finally {
      setAddingMemory(false);
    }
  };

  // Pin/Unpin Memory
  const handleTogglePin = async (item: MemoryItem) => {
    try {
      const nextPinned = !item.pinned;
      setMemories((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, pinned: nextPinned } : m))
      );

      await apiFetch(`/api/memories/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ pinned: nextPinned }),
      });
    } catch (err: any) {
      console.error('Failed to toggle pin:', err);
      await loadData();
    }
  };

  // Inline Edit Save
  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) return;
    try {
      setSavingEdit(true);
      await apiFetch(`/api/memories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          text: editText.trim(),
          category: editCategory,
          importance: editImportance,
        }),
      });

      setEditingId(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update memory.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Memory
  const handleDeleteMemory = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this memory?')) return;
    try {
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
      await apiFetch(`/api/memories/${id}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      console.error('Failed to delete memory:', err);
      await loadData();
    }
  };

  // Forget Everything
  const handleForgetEverything = async () => {
    if (forgetConfirmText !== 'FORGET') return;
    try {
      setForgetting(true);
      setForgetError(null);
      await apiFetch('/api/memories', {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'FORGET' }),
      });
      setIsForgetOpen(false);
      setForgetConfirmText('');
      await loadData();
    } catch (err: any) {
      setForgetError(err.message || 'Failed to wipe memories.');
    } finally {
      setForgetting(false);
    }
  };

  // Export JSON
  const handleExportJson = async () => {
    try {
      const data = await apiFetch<any>('/api/memories/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowcart-memories-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to export memories.');
    }
  };

  // Filtered list
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
      const matchesQuery =
        !searchQuery.trim() ||
        m.text.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [memories, selectedCategory, searchQuery]);

  // Grouped by Category for display
  const groupedMemories = useMemo(() => {
    const groups: Record<string, MemoryItem[]> = {};
    for (const m of filteredMemories) {
      if (!groups[m.category]) {
        groups[m.category] = [];
      }
      groups[m.category].push(m);
    }
    return groups;
  }, [filteredMemories]);

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text font-sans flex flex-col selection:bg-red/20 selection:text-red-text">
      {/* Header Bar */}
      <header className="h-14 bg-surface border-b border-border px-4 sm:px-6 flex items-center justify-between select-none z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors pr-3 border-r border-border"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Workflow Studio</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red flex items-center justify-center text-white shadow-sm">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs font-bold tracking-tight text-text">Long-Term Memory</h1>
                <span className="text-[10px] font-mono text-muted bg-surface-2 px-1.5 py-0.2 rounded border border-border">
                  {totalCount} / 500
                </span>
              </div>
              <p className="text-[10px] text-muted">Durable user facts, preferences and standing rules</p>
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium text-muted hover:text-text bg-surface-2 hover:bg-[#222227] border border-border transition-colors"
            title="Export all memories as JSON"
          >
            <Download className="w-3.5 h-3.5 text-red-text" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setIsForgetOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium text-red-text hover:text-white bg-red-soft hover:bg-red border border-red/30 transition-colors"
            title="Permanently erase all stored memories"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Forget Everything</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-btn text-xs font-semibold text-white bg-red hover:bg-red-hover active:bg-red-press transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Memory</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Soft Cap Warning Banner */}
        {softCapReached && (
          <div className="p-3.5 rounded-card bg-red-soft border border-red/40 flex items-start gap-3 text-xs text-red-text">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red" />
            <div>
              <p className="font-semibold text-text">Memory Soft Cap Reached (300+ memories)</p>
              <p className="text-muted leading-relaxed mt-0.5">
                Automatic chat learning is paused while the background consolidation pass merges near-duplicate memories.
                You can still add or pin explicit memories manually up to the hard cap of 500.
              </p>
            </div>
          </div>
        )}

        {/* Global Controls & Privacy Note */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Switch 1: Use Memory */}
          <div className="p-4 rounded-card bg-surface border border-border flex items-center justify-between">
            <div className="space-y-0.5 pr-3">
              <span className="text-xs font-semibold text-text block">Use Memory</span>
              <span className="text-[11px] text-muted block leading-snug">
                Inject relevant facts into agent requests
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={memoryEnabled}
              disabled={savingSettings}
              onClick={() => handleToggleSetting('memoryEnabled', !memoryEnabled)}
              className={`w-10 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                memoryEnabled ? 'bg-red' : 'bg-[#2A2A2F]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  memoryEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Switch 2: Learn from chats */}
          <div className="p-4 rounded-card bg-surface border border-border flex items-center justify-between">
            <div className="space-y-0.5 pr-3">
              <span className="text-xs font-semibold text-text block">Learn From Chats</span>
              <span className="text-[11px] text-muted block leading-snug">
                Extract durable preferences automatically
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={memoryLearnEnabled}
              disabled={savingSettings}
              onClick={() => handleToggleSetting('memoryLearnEnabled', !memoryLearnEnabled)}
              className={`w-10 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                memoryLearnEnabled ? 'bg-red' : 'bg-[#2A2A2F]'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  memoryLearnEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Privacy & Retention Note */}
          <div className="p-4 rounded-card bg-surface-2 border border-border flex items-start gap-2.5">
            <Info className="w-4 h-4 text-muted shrink-0 mt-0.5" />
            <div className="text-[11px] text-muted leading-relaxed">
              <strong className="text-text font-medium block">Independent Retention:</strong>
              Deleting a chat conversation does not delete memories learned from it.
              Manage and purge individual facts right here.
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-btn text-xs font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'bg-red text-white shadow-sm'
                      : 'bg-surface-2 text-muted hover:text-text border border-border'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full pl-8 pr-3 py-1.5 rounded-btn text-xs bg-surface border border-border focus:border-red focus:outline-none text-text placeholder:text-muted"
            />
          </div>
        </div>

        {/* Memories Content List */}
        {loading ? (
          <div className="space-y-3 py-8">
            <div className="h-16 bg-surface rounded-card animate-pulse border border-border" />
            <div className="h-16 bg-surface rounded-card animate-pulse border border-border" />
            <div className="h-16 bg-surface rounded-card animate-pulse border border-border" />
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="p-12 text-center rounded-card bg-surface border border-border space-y-3">
            <div className="w-10 h-10 rounded-full bg-surface-2 text-muted mx-auto flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-text">No memories found</p>
            <p className="text-[11px] text-muted max-w-sm mx-auto">
              {searchQuery
                ? 'No facts match your search query. Try clearing the filter.'
                : 'The agent will learn durable preferences from your chats, or you can add one manually.'}
            </p>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="px-3.5 py-1.5 rounded-btn text-xs font-semibold text-white bg-red hover:bg-red-hover transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Memory</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMemories).map(([cat, items]) => (
              <div key={cat} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                    {cat} ({items.length})
                  </h3>
                </div>

                <div className="space-y-2">
                  {items.map((mem) => {
                    const isEditing = editingId === mem.id;

                    return (
                      <div
                        key={mem.id}
                        className={`p-3.5 rounded-card bg-surface border transition-all ${
                          mem.pinned
                            ? 'border-red/40 bg-surface/90 shadow-sm'
                            : 'border-border hover:border-border/80'
                        }`}
                      >
                        {isEditing ? (
                          /* Inline Edit Mode */
                          <div className="space-y-3">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              maxLength={500}
                              rows={2}
                              className="w-full p-2.5 text-xs bg-surface-2 border border-border rounded focus:border-red focus:outline-none text-text resize-none"
                            />
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <select
                                  value={editCategory}
                                  onChange={(e) => setEditCategory(e.target.value as any)}
                                  className="bg-surface-2 border border-border text-xs rounded px-2 py-1 text-text focus:outline-none"
                                >
                                  {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[10px] text-muted">
                                  {editText.length}/500 chars
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="px-2.5 py-1 rounded text-xs text-muted hover:text-text bg-surface-2"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={savingEdit || !editText.trim()}
                                  onClick={() => handleSaveEdit(mem.id)}
                                  className="px-3 py-1 rounded text-xs font-semibold text-white bg-red hover:bg-red-hover disabled:opacity-50"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {mem.pinned && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-red-soft text-red-text border border-red/30">
                                    <Pin className="w-2.5 h-2.5 fill-current" />
                                    <span>Pinned</span>
                                  </span>
                                )}
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-surface-2 text-muted border border-border">
                                  {mem.category}
                                </span>
                                <span className="text-[10px] font-mono text-muted capitalize">
                                  Source: {mem.source}
                                </span>
                                {mem.useCount > 0 && (
                                  <span className="text-[10px] font-mono text-muted">
                                    • Used {mem.useCount} {mem.useCount === 1 ? 'time' : 'times'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text leading-relaxed font-sans">{mem.text}</p>
                              <div className="text-[10px] text-muted font-mono flex items-center gap-3 pt-1">
                                <span>Updated: {new Date(mem.updatedAt).toLocaleDateString()}</span>
                                {mem.lastUsedAt && (
                                  <span>
                                    Last retrieved: {new Date(mem.lastUsedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 self-end sm:self-start">
                              <button
                                type="button"
                                onClick={() => handleTogglePin(mem)}
                                className={`p-1.5 rounded transition-colors ${
                                  mem.pinned
                                    ? 'text-red hover:text-red-hover bg-red-soft'
                                    : 'text-muted hover:text-text bg-surface-2'
                                }`}
                                title={mem.pinned ? 'Unpin from system prompt' : 'Pin to system prompt priority'}
                              >
                                {mem.pinned ? (
                                  <PinOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Pin className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(mem.id);
                                  setEditText(mem.text);
                                  setEditCategory(mem.category);
                                  setEditImportance(mem.importance);
                                }}
                                className="p-1.5 rounded text-muted hover:text-text bg-surface-2 transition-colors"
                                title="Edit memory"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMemory(mem.id)}
                                className="p-1.5 rounded text-muted hover:text-red-text bg-surface-2 transition-colors"
                                title="Delete memory"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Memory Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface border border-border rounded-modal shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-red" />
                <h3 className="text-sm font-bold text-text">Add Memory Manually</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-muted hover:text-text p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded bg-red-soft border border-red/40 text-xs text-red-text flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddMemory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text block">Memory Fact or Rule</label>
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="e.g., Prefers bullet-pointed replies under 150 words."
                  maxLength={500}
                  rows={3}
                  required
                  className="w-full p-3 text-xs bg-surface-2 border border-border rounded focus:border-red focus:outline-none text-text resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Third person factual statement</span>
                  <span>{newText.length} / 500</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text block">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full p-2 text-xs bg-surface-2 border border-border rounded text-text focus:outline-none"
                  >
                    {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text block">Importance (1-5)</label>
                  <select
                    value={newImportance}
                    onChange={(e) => setNewImportance(Number(e.target.value))}
                    className="w-full p-2 text-xs bg-surface-2 border border-border rounded text-text focus:outline-none"
                  >
                    <option value={1}>1 - Low</option>
                    <option value={2}>2 - Normal</option>
                    <option value={3}>3 - Standard</option>
                    <option value={4}>4 - High</option>
                    <option value={5}>5 - Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-surface-2 border border-border">
                <div>
                  <span className="text-xs font-medium text-text block">Pin to Priority</span>
                  <span className="text-[10px] text-muted block">
                    Always retrieve in system prompt (up to 10 priority memories)
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={newPinned}
                  onClick={() => setNewPinned(!newPinned)}
                  className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                    newPinned ? 'bg-red' : 'bg-[#2A2A2F]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      newPinned ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3.5 py-1.5 rounded-btn text-xs font-medium text-muted hover:text-text bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMemory || !newText.trim()}
                  className="px-4 py-1.5 rounded-btn text-xs font-semibold text-white bg-red hover:bg-red-hover disabled:opacity-50"
                >
                  {addingMemory ? 'Saving...' : 'Save Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forget Everything Confirmation Modal */}
      {isForgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-red/40 rounded-modal shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 text-red border-b border-border">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-sm font-bold text-text">Erase All Memories</h3>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              This action permanently purges all <strong className="text-text">{totalCount} stored memories</strong>.
              This cannot be undone. To proceed, please type <code className="text-red font-mono font-bold">FORGET</code> in the field below.
            </p>

            {forgetError && (
              <div className="p-2.5 rounded bg-red-soft border border-red/40 text-xs text-red-text">
                {forgetError}
              </div>
            )}

            <div className="space-y-1">
              <input
                type="text"
                value={forgetConfirmText}
                onChange={(e) => setForgetConfirmText(e.target.value)}
                placeholder="Type FORGET to confirm"
                className="w-full p-2.5 text-xs font-mono bg-surface-2 border border-border focus:border-red focus:outline-none rounded text-text"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setIsForgetOpen(false);
                  setForgetConfirmText('');
                }}
                className="px-3.5 py-1.5 rounded-btn text-xs font-medium text-muted hover:text-text bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={forgetConfirmText !== 'FORGET' || forgetting}
                onClick={handleForgetEverything}
                className="px-4 py-1.5 rounded-btn text-xs font-semibold text-white bg-red hover:bg-red-hover disabled:opacity-40 transition-colors shadow-sm"
              >
                {forgetting ? 'Purging...' : 'Wipe All Memories'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
