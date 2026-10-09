import React, { useState, useEffect } from 'react';
import { GitBranch, Plus, Play, Trash2, Power, Clock, ArrowRight, Loader2 } from 'lucide-react';

export default function WorkflowsPage({ onOpenEditor }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workflows');
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#2A2A2A]">
        <div>
          <h1 className="text-xl font-bold tracking-wider uppercase text-white font-mono flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-[#E10600]" />
            Workflows
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Email automation pipelines. Built strictly for email triggers, logic, and SMTP dispatch.
          </p>
        </div>

        <button
          onClick={() => onOpenEditor && onOpenEditor('new')}
          className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Workflow</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-[#888888] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#E10600]" />
          <span>Loading workflows...</span>
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] p-12 text-center">
          <GitBranch className="w-10 h-10 text-[#888888] mx-auto mb-3" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-1">
            No Workflows Found
          </h3>
          <p className="text-xs text-[#888888] max-w-sm mx-auto mb-6">
            Create your first email automation pipeline to start processing leads, executing schedules, and dispatching SMTP campaigns.
          </p>
          <button
            onClick={() => onOpenEditor && onOpenEditor('new')}
            className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Workflow</span>
          </button>
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#2A2A2A] divide-y divide-[#2A2A2A]">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="p-4 flex items-center justify-between hover:bg-[#0A0A0A] transition-colors"
            >
              <div className="flex items-center gap-4">
                <button
                  className={`w-3 h-3 ${wf.is_active ? 'bg-[#E10600]' : 'bg-[#2A2A2A]'}`}
                  title={wf.is_active ? 'Active' : 'Inactive'}
                />
                <div>
                  <h4 className="text-sm font-semibold text-white font-mono hover:text-[#E10600] cursor-pointer"
                    onClick={() => onOpenEditor && onOpenEditor(wf.id)}
                  >
                    {wf.name}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-[#888888] mt-1">
                    <span>Trigger: {wf.trigger_type}</span>
                    <span>•</span>
                    <span>Last run: {wf.last_run_at ? new Date(wf.last_run_at).toLocaleString() : 'Never'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenEditor && onOpenEditor(wf.id)}
                  className="px-3 py-1.5 border border-[#2A2A2A] hover:border-[#E10600] text-xs font-mono text-white transition-colors"
                >
                  Edit Canvas
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
