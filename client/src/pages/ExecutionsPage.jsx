import React, { useState, useEffect } from 'react';
import { Activity, Clock, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/executions');
      const data = await res.json();
      setExecutions(data.executions || []);
    } catch (err) {
      console.error('Error fetching executions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#2A2A2A]">
        <div>
          <h1 className="text-xl font-bold tracking-wider uppercase text-white font-mono flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#E10600]" />
            Executions
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Real-time execution run logs, node inputs/outputs, timing, and errors.
          </p>
        </div>
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] p-12 text-center">
        <Activity className="w-10 h-10 text-[#888888] mx-auto mb-3" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-1">
          {executions.length} Execution Runs Recorded
        </h3>
        <p className="text-xs text-[#888888] max-w-md mx-auto">
          Detailed inspection panel showing per-node JSON inputs, outputs, timings, and error stacktraces will be active in Step 5.
        </p>
      </div>
    </div>
  );
}
