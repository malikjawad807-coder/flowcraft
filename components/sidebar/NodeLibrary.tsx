'use client';

import React, { useState } from 'react';
import {
  FileUp,
  FormInput,
  Webhook,
  Sparkles,
  Bot,
  Mail,
  Code,
  GitBranch,
  Search,
  Plus,
  HelpCircle,
  Layers,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { NodeType, NodeCategory } from '@/types/workflow';

interface NodeLibraryProps {
  onAddNode: (type: NodeType) => void;
}

interface PaletteItem {
  type: NodeType;
  label: string;
  category: NodeCategory;
  description: string;
  icon: any;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
}

export function NodeLibrary({ onAddNode }: NodeLibraryProps) {
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const paletteItems: PaletteItem[] = [
    // Triggers
    {
      type: 'input_form_trigger',
      label: 'Input Form Trigger',
      category: 'trigger',
      description: 'Capture user submissions via an interactive customized form',
      icon: FormInput,
      iconColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
      badge: 'Trigger',
      badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50',
    },
    {
      type: 'file_upload_trigger',
      label: 'File Upload Trigger',
      category: 'trigger',
      description: 'Ingest resumes, CSVs, JSON, or text documents into the flow',
      icon: FileUp,
      iconColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
      badge: 'Trigger',
      badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50',
    },
    {
      type: 'webhook_trigger',
      label: 'Webhook Trigger',
      category: 'trigger',
      description: 'Listen for real-time external HTTP POST webhooks',
      icon: Webhook,
      iconColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
      badge: 'HTTP',
      badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50',
    },

    // AI Nodes
    {
      type: 'openai_llm',
      label: 'OpenAI Completion',
      category: 'ai',
      description: 'Execute GPT-4o / GPT-4o-mini reasoning, drafts, & extraction',
      icon: Sparkles,
      iconColor: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
      badge: 'GPT-4o',
      badgeColor: 'text-purple-300 bg-purple-950/60 border-purple-800/50',
    },
    {
      type: 'openai_classifier',
      label: 'AI Sentiment & Triage',
      category: 'ai',
      description: 'Categorize sentiment, customer intent, and urgency scores',
      icon: Bot,
      iconColor: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
      badge: 'AI Router',
      badgeColor: 'text-purple-300 bg-purple-950/60 border-purple-800/50',
    },

    // Action Nodes
    {
      type: 'gmail_send',
      label: 'Gmail API Send',
      category: 'action',
      description: 'Dispatch templated emails or create drafts directly via Gmail',
      icon: Mail,
      iconColor: 'text-red-400 bg-red-500/15 border-red-500/30',
      badge: 'Email',
      badgeColor: 'text-red-300 bg-red-950/60 border-red-800/50',
    },

    // Logic & Transform
    {
      type: 'code_transform',
      label: 'Code Transform',
      category: 'logic',
      description: 'Execute custom JavaScript data formatting and mappings',
      icon: Code,
      iconColor: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
      badge: 'JS',
      badgeColor: 'text-sky-300 bg-sky-950/60 border-sky-800/50',
    },
    {
      type: 'condition_filter',
      label: 'If / Else Condition',
      category: 'logic',
      description: 'Conditionally filter and route flow based on upstream variables',
      icon: GitBranch,
      iconColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
      badge: 'Branch',
      badgeColor: 'text-amber-300 bg-amber-950/60 border-amber-800/50',
    },
  ];

  const categories = [
    { id: 'trigger', label: 'Triggers (Input Events)', icon: Zap },
    { id: 'ai', label: 'AI & OpenAI Models', icon: Sparkles },
    { id: 'action', label: 'Actions (Gmail & Outputs)', icon: Mail },
    { id: 'logic', label: 'Logic & Transformations', icon: Layers },
  ];

  const filteredItems = paletteItems.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-80 h-full flex flex-col bg-[#12161f] border-r border-slate-800/80 z-20 select-none">
      {/* Search Header */}
      <div className="p-3.5 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#ff6d5a]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">Node Library</h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60">
            {filteredItems.length} nodes
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search triggers, AI, Gmail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/90 text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded-lg border border-slate-700/70 placeholder:text-slate-500 focus:outline-none focus:border-[#ff6d5a] focus:ring-1 focus:ring-[#ff6d5a]/30 transition-all font-sans"
          />
        </div>
      </div>

      {/* Node Catalog List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {categories.map((category) => {
          const itemsInCat = filteredItems.filter((item) => item.category === category.id);
          if (itemsInCat.length === 0) return null;

          const isCollapsed = collapsedCategories[category.id];

          return (
            <div key={category.id} className="space-y-1.5">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-1.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <category.icon className="w-3 h-3 text-slate-400" />
                  <span>{category.label}</span>
                </div>
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {!isCollapsed && (
                <div className="space-y-1.5">
                  {itemsInCat.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <div
                        key={item.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.type)}
                        onClick={() => onAddNode(item.type)}
                        className="group flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/70 hover:border-slate-700 cursor-grab active:cursor-grabbing transition-all duration-150 relative shadow-sm hover:shadow-md"
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${item.iconColor}`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                              {item.label}
                            </span>
                            {item.badge && (
                              <span
                                className={`text-[9px] font-mono px-1 rounded border font-semibold ${item.badgeColor}`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                            {item.description}
                          </p>
                        </div>

                        {/* Add Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddNode(item.type);
                          }}
                          title="Click to add to canvas"
                          className="absolute right-2.5 top-3 w-6 h-6 rounded-md bg-slate-800 text-slate-400 hover:text-white hover:bg-[#ff6d5a] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-slate-700/80"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer Hint */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Drag node or click &apos;+&apos; to add</span>
        </div>
        <span className="font-mono text-[10px] text-[#ff6d5a]">n8n-style v1.0</span>
      </div>
    </aside>
  );
}
