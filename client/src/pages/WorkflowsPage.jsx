import React, { useState, useEffect } from 'react';
import { 
  GitBranch, Plus, Play, Trash2, Power, Clock, ArrowRight, Loader2, 
  CheckCircle2, AlertCircle, Copy, Sparkles, RefreshCw
} from 'lucide-react';

export default function WorkflowsPage({ onOpenEditor }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workflows');
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('Error fetching workflows:', err);
      showToast('Error fetching workflows', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleToggleActive = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/workflows/${id}/toggle`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.is_active ? 'Workflow Activated (Schedule registered)' : 'Workflow Deactivated');
      fetchWorkflows();
    } catch (err) {
      showToast(err.message || 'Toggle failed', 'error');
    }
  };

  const handleRunWorkflow = async (id, name, e) => {
    e.stopPropagation();
    try {
      setRunningId(id);
      showToast(`Running "${name}"...`, 'info');
      const res = await fetch(`/api/workflows/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTestRun: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.result?.status === 'success') {
        showToast(`Execution finished in ${data.result.durationMs}ms`);
      } else {
        showToast(`Execution failed: ${data.result?.error}`, 'error');
      }
      fetchWorkflows();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id, name, e) => {
    e.stopPropagation();
    if (!confirm(`Delete workflow "${name}"?`)) return;
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Workflow deleted');
      fetchWorkflows();
    } catch (err) {
      showToast('Failed to delete workflow', 'error');
    }
  };

  const handleCreateStarterBlueprint = async () => {
    try {
      setLoading(true);
      const nodes = [
        { id: 'n1', type: 'schedule_trigger', data: { label: 'Daily 9 AM Schedule', cron: '0 9 * * *' }, position: { x: 100, y: 150 } },
        { id: 'n2', type: 'get_leads', data: { label: 'Fetch Pending Leads', status: 'Pending', limit: 10 }, position: { x: 350, y: 150 } },
        { id: 'n3', type: 'if_condition', data: { label: 'Check Email Valid', field: '{{ $json.email }}', operator: 'contains', compareValue: '@' }, position: { x: 600, y: 150 } },
        { id: 'n4', type: 'ai_write_email', data: { label: 'AI Write Email', promptTemplate: 'Write personalized cold email for {{ $json.name }} at {{ $json.business }}.' }, position: { x: 850, y: 100 } },
        { id: 'n5', type: 'send_email', data: { label: 'Send Email (SMTP)', to: '{{ $json.email }}', subject: '{{ $json.email_subject }}', body: '{{ $json.email_body }}' }, position: { x: 1100, y: 100 } },
        { id: 'n6', type: 'update_lead', data: { label: 'Mark Sent', status: 'Sent', step: 'Outreach Sent' }, position: { x: 1350, y: 100 } },
      ];
      const connections = [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true' },
        { id: 'e4', source: 'n4', target: 'n5' },
        { id: 'e5', source: 'n5', target: 'n6' },
      ];

      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Complete B2B Cold Outreach Pipeline',
          trigger_type: 'schedule',
          schedule_cron: '0 9 * * *',
          nodes_json: JSON.stringify(nodes),
          connections_json: JSON.stringify(connections),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Created Starter Blueprint!');
      fetchWorkflows();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
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
            <GitBranch className="w-5 h-5 text-[#E10600]" />
            Workflows
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Email automation pipelines. Built strictly for email triggers, logic, and SMTP dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCreateStarterBlueprint}
            className="bg-[#141414] border border-[#2A2A2A] hover:border-[#888888] text-white px-3 py-2 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E10600]" />
            <span>Load Blueprint</span>
          </button>

          <button
            onClick={() => onOpenEditor && onOpenEditor('new')}
            className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors font-mono"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-16 text-center text-xs font-mono text-[#888888] flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-[#E10600] border-t-transparent animate-spin rounded-full" />
          <span>Loading workflows...</span>
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] p-16 text-center">
          <GitBranch className="w-10 h-10 text-[#444444] mx-auto mb-3" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-1 font-mono">
            No Workflows Found
          </h3>
          <p className="text-xs text-[#888888] max-w-sm mx-auto mb-6 font-mono">
            Create your first email automation pipeline to start processing leads, executing schedules, and dispatching campaigns.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleCreateStarterBlueprint}
              className="bg-[#141414] border border-[#2A2A2A] hover:border-[#E10600] text-white px-4 py-2 text-xs font-mono uppercase tracking-wider inline-flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E10600]" />
              <span>Load Complete Blueprint</span>
            </button>
            <button
              onClick={() => onOpenEditor && onOpenEditor('new')}
              className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 transition-colors font-mono"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Workflow</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#2A2A2A] divide-y divide-[#2A2A2A]">
          {workflows.map((wf) => {
            const isRunning = runningId === wf.id;
            return (
              <div
                key={wf.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-[#0A0A0A] transition-colors gap-4"
              >
                <div className="flex items-center gap-4">
                  {/* Status indicator button */}
                  <button
                    onClick={(e) => handleToggleActive(wf.id, e)}
                    className={`w-3.5 h-3.5 transition-colors cursor-pointer border ${
                      wf.is_active
                        ? 'bg-[#10B981] border-[#10B981]'
                        : 'bg-transparent border-[#444444] hover:border-[#888888]'
                    }`}
                    title={wf.is_active ? 'Active (Click to Deactivate)' : 'Inactive (Click to Activate)'}
                  />

                  <div>
                    <h4
                      className="text-sm font-semibold text-white font-mono hover:text-[#E10600] cursor-pointer flex items-center gap-2"
                      onClick={() => onOpenEditor && onOpenEditor(wf.id)}
                    >
                      <span>{wf.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 border uppercase ${
                        wf.is_active 
                          ? 'border-[#10B981]/40 text-[#10B981] bg-[#10B981]/10' 
                          : 'border-[#444444] text-[#888888]'
                      }`}>
                        {wf.is_active ? 'ACTIVE' : 'DRAFT'}
                      </span>
                    </h4>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-[#888888] mt-1">
                      <span>Trigger: <strong className="text-white">{wf.trigger_type}</strong></span>
                      {wf.trigger_type === 'schedule' && (
                        <span>Cron: <code className="text-[#AAAAAA]">{wf.schedule_cron}</code></span>
                      )}
                      <span>•</span>
                      <span>Last run: {wf.last_run_at ? new Date(wf.last_run_at).toLocaleString() : 'Never'}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto font-mono">
                  {/* Active Toggle Switch */}
                  <button
                    onClick={(e) => handleToggleActive(wf.id, e)}
                    className={`px-2.5 py-1 text-[11px] border uppercase transition-colors ${
                      wf.is_active
                        ? 'border-[#10B981] text-[#10B981] bg-[#10B981]/10'
                        : 'border-[#2A2A2A] text-[#888888] hover:text-white'
                    }`}
                  >
                    {wf.is_active ? 'Active' : 'Inactive'}
                  </button>

                  {/* Manual Run button */}
                  <button
                    onClick={(e) => handleRunWorkflow(wf.id, wf.name, e)}
                    disabled={isRunning}
                    className="px-2.5 py-1 bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#E10600] text-white text-[11px] uppercase flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    title="Execute test run"
                  >
                    {isRunning ? (
                      <>
                        <div className="w-2.5 h-2.5 border-2 border-[#E10600] border-t-transparent animate-spin rounded-full" />
                        <span>Running</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 text-[#E10600]" />
                        <span>Run</span>
                      </>
                    )}
                  </button>

                  {/* Edit Canvas button */}
                  <button
                    onClick={() => onOpenEditor && onOpenEditor(wf.id)}
                    className="px-3 py-1 bg-[#141414] border border-[#2A2A2A] hover:border-[#E10600] text-xs text-white transition-colors uppercase"
                  >
                    Canvas
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(wf.id, wf.name, e)}
                    className="p-1.5 border border-[#2A2A2A] hover:border-[#E10600] text-[#888888] hover:text-[#E10600] transition-colors"
                    title="Delete workflow"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
