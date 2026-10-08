'use client';

import React from 'react';
import { X, Sparkles, FileText, ArrowRight, Check, Layers } from 'lucide-react';
import { SAMPLE_WORKFLOWS } from '@/lib/sample-workflows';
import { WorkflowTemplate } from '@/types/workflow';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WorkflowTemplate) => void;
}

export function TemplatesModal({ isOpen, onClose, onSelectTemplate }: TemplatesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#12161f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Starter Workflow Templates</h2>
              <p className="text-xs text-slate-400">
                Pre-wired automation blueprints connecting triggers, OpenAI, and Gmail
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

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {SAMPLE_WORKFLOWS.map((template) => (
            <div
              key={template.id}
              className="group p-4 rounded-xl bg-slate-900/70 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all duration-200 flex flex-col justify-between gap-3 shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-purple-400 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded-full">
                      {template.category}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                      {template.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-[#ff6d5a] transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {template.description}
                  </p>
                </div>
              </div>

              {/* Node Sequence preview */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60 text-xs font-mono text-slate-400">
                <span className="text-slate-500 text-[11px]">Flow:</span>
                {template.nodes.map((n, i) => (
                  <React.Fragment key={n.id}>
                    <span className="text-[11px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                      {n.data.label}
                    </span>
                    {i < template.nodes.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    onSelectTemplate(template);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#ff6d5a] hover:bg-[#ea580c] text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <span>Load Workflow</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
