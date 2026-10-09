import React, { useState, useEffect } from 'react';
import { 
  History, CheckCircle2, AlertCircle, Clock, Trash2, ChevronRight, 
  RefreshCw, X, Play, Code2, AlertTriangle, ArrowRight
} from 'lucide-react';

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState([]);
  const [stats, setStats] = useState({ total: 0, successCount: 0, errorCount: 0, runningCount: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedExec, setSelectedExec] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);

      const res = await fetch(`/api/executions?${params.toString()}`);
      const data = await res.json();
      setExecutions(data.executions || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error(err);
      showToast('Error loading executions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
  }, [selectedStatus]);

  const handleOpenDetail = async (id) => {
    try {
      const res = await fetch(`/api/executions/${id}`);
      const data = await res.json();
      setSelectedExec(data.execution);
    } catch (err) {
      showToast('Failed to load execution details', 'error');
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/executions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      showToast('Execution record removed');
      fetchExecutions();
      if (selectedExec?.id === id) setSelectedExec(null);
    } catch (err) {
      showToast('Failed to delete execution', 'error');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear all execution history?')) return;
    try {
      const res = await fetch('/api/executions', { method: 'DELETE' });
      if (!res.ok) throw new Error('Clear failed');
      showToast('Execution history cleared');
      setSelectedExec(null);
      fetchExecutions();
    } catch (err) {
      showToast('Failed to clear history', 'error');
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#2A2A2A] gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-wider uppercase text-white font-mono flex items-center gap-2">
            <History className="w-5 h-5 text-[#E10600]" />
            Execution Logs & Audit Trail
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Real-time execution log. Inspect node JSON payloads, step timings, and error traces.
          </p>
        </div>

        <div className="flex items-center gap-2.5 font-mono">
          <button
            onClick={fetchExecutions}
            className="p-2 bg-[#141414] border border-[#2A2A2A] hover:border-[#888888] text-[#888888] hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClearAll}
            disabled={executions.length === 0}
            className="bg-[#1C0000] border border-[#E10600] hover:bg-[#E10600] text-white px-3 py-2 text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Stats Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        {[
          { key: 'all', label: 'Total Runs', count: stats.total || 0, color: 'text-white' },
          { key: 'success', label: 'Successful', count: stats.successCount || 0, color: 'text-[#10B981]' },
          { key: 'error', label: 'Failed', count: stats.errorCount || 0, color: 'text-[#EF4444]' },
          { key: 'running', label: 'Running', count: stats.runningCount || 0, color: 'text-[#E5A93C]' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setSelectedStatus(item.key)}
            className={`p-3.5 text-left border transition-all ${
              selectedStatus === item.key
                ? 'bg-[#1C1C1C] border-[#E10600]'
                : 'bg-[#141414] border-[#2A2A2A] hover:border-[#444444]'
            }`}
          >
            <div className="text-[10px] text-[#888888] uppercase tracking-wider">{item.label}</div>
            <div className={`text-base font-bold mt-1 ${item.color}`}>
              {item.count}
            </div>
          </button>
        ))}
      </div>

      {/* Executions Table */}
      <div className="bg-[#141414] border border-[#2A2A2A]">
        {loading ? (
          <div className="p-16 text-center text-xs font-mono text-[#888888] flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-[#E10600] border-t-transparent animate-spin rounded-full" />
            <span>Loading executions...</span>
          </div>
        ) : executions.length === 0 ? (
          <div className="p-16 text-center font-mono">
            <History className="w-10 h-10 text-[#444444] mx-auto mb-3" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-1">
              No Execution Records
            </h3>
            <p className="text-xs text-[#888888] max-w-sm mx-auto">
              Execute a workflow in the Canvas or trigger a scheduled run to see step-by-step logs.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#2A2A2A]">
            {executions.map((exec) => (
              <div
                key={exec.id}
                onClick={() => handleOpenDetail(exec.id)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-[#0A0A0A] transition-colors cursor-pointer gap-3 font-mono text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    exec.status === 'success'
                      ? 'bg-[#10B981]'
                      : exec.status === 'error'
                      ? 'bg-[#EF4444]'
                      : 'bg-[#E5A93C] animate-pulse'
                  }`} />

                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span>{exec.workflow_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 border uppercase ${
                        exec.status === 'success'
                          ? 'border-[#10B981]/30 text-[#10B981] bg-[#10B981]/10'
                          : exec.status === 'error'
                          ? 'border-[#EF4444]/30 text-[#EF4444] bg-[#EF4444]/10'
                          : 'border-[#E5A93C]/30 text-[#E5A93C] bg-[#E5A93C]/10'
                      }`}>
                        {exec.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#777777] mt-1">
                      <span>Trigger: {exec.trigger_type}</span>
                      <span>•</span>
                      <span>Started: {new Date(exec.started_at).toLocaleString()}</span>
                      {exec.duration_ms !== null && (
                        <>
                          <span>•</span>
                          <span>Duration: {exec.duration_ms}ms</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {exec.error && (
                    <span className="text-[11px] text-[#EF4444] max-w-xs truncate" title={exec.error}>
                      {exec.error}
                    </span>
                  )}
                  <button
                    onClick={(e) => handleDelete(exec.id, e)}
                    className="p-1.5 text-[#666666] hover:text-[#EF4444]"
                    title="Delete log"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-[#888888]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Execution Detail Modal */}
      {selectedExec && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2A2A2A] w-full max-w-3xl p-6 relative max-h-[90vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2A2A2A]">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#E10600]" />
                  <span>Execution Inspection</span>
                </h2>
                <div className="text-[11px] text-[#888888] mt-0.5">
                  ID: {selectedExec.id}
                </div>
              </div>
              <button
                onClick={() => setSelectedExec(null)}
                className="text-[#888888] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Run Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              <div className="bg-[#0A0A0A] p-2.5 border border-[#2A2A2A]">
                <div className="text-[10px] text-[#666666] uppercase">Workflow</div>
                <div className="text-white font-semibold mt-0.5 truncate">{selectedExec.workflow_name}</div>
              </div>
              <div className="bg-[#0A0A0A] p-2.5 border border-[#2A2A2A]">
                <div className="text-[10px] text-[#666666] uppercase">Status</div>
                <div className={`font-semibold mt-0.5 uppercase ${
                  selectedExec.status === 'success' ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}>
                  {selectedExec.status}
                </div>
              </div>
              <div className="bg-[#0A0A0A] p-2.5 border border-[#2A2A2A]">
                <div className="text-[10px] text-[#666666] uppercase">Trigger</div>
                <div className="text-white font-semibold mt-0.5 uppercase">{selectedExec.trigger_type}</div>
              </div>
              <div className="bg-[#0A0A0A] p-2.5 border border-[#2A2A2A]">
                <div className="text-[10px] text-[#666666] uppercase">Duration</div>
                <div className="text-white font-semibold mt-0.5">{selectedExec.duration_ms}ms</div>
              </div>
            </div>

            {selectedExec.error && (
              <div className="mb-6 p-3 bg-[#1C0000] border border-[#EF4444] text-[#FF4D4D] text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#EF4444]" />
                <div>
                  <div className="font-bold uppercase text-[10px]">Execution Error:</div>
                  <div className="mt-1">{selectedExec.error}</div>
                </div>
              </div>
            )}

            {/* Per-Node Breakdown */}
            <div>
              <div className="text-white font-bold uppercase text-[11px] mb-3">
                Node Execution Hierarchy ({Object.keys(selectedExec.nodeResults || {}).length} nodes executed)
              </div>

              <div className="space-y-3">
                {Object.entries(selectedExec.nodeResults || {}).map(([nodeId, nodeData]) => (
                  <div key={nodeId} className="bg-[#0A0A0A] border border-[#2A2A2A] p-3 space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          nodeData.status === 'success' ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                        }`} />
                        <span className="font-bold text-white uppercase text-[11px]">{nodeData.label}</span>
                        <span className="text-[10px] text-[#666666]">({nodeData.type})</span>
                      </div>
                      <span className="text-[11px] text-[#888888]">{nodeData.duration_ms}ms</span>
                    </div>

                    {nodeData.error && (
                      <div className="p-2 bg-[#1C0000] border border-[#E10600] text-[#FF4D4D] text-[11px]">
                        {nodeData.error}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <div className="text-[10px] text-[#666666] uppercase mb-1">Input Payload</div>
                        <pre className="bg-[#141414] p-2 border border-[#222222] text-[#888888] max-h-36 overflow-auto">
                          {JSON.stringify(nodeData.input, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#666666] uppercase mb-1">Output Payload</div>
                        <pre className="bg-[#141414] p-2 border border-[#222222] text-[#34D399] max-h-36 overflow-auto">
                          {JSON.stringify(nodeData.output, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
