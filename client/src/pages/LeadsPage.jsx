import React, { useState, useEffect } from 'react';
import { Users, Plus, Upload, Search, Filter, Trash2, Mail } from 'lucide-react';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data.leads || []);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#2A2A2A]">
        <div>
          <h1 className="text-xl font-bold tracking-wider uppercase text-white font-mono flex items-center gap-2">
            <Users className="w-5 h-5 text-[#E10600]" />
            Leads
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Built-in recipient database. Filter by status, import CSVs, and track campaign steps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="bg-[#141414] border border-[#2A2A2A] hover:border-[#E10600] text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] p-12 text-center">
        <Users className="w-10 h-10 text-[#888888] mx-auto mb-3" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-1">
          {leads.length} Leads in Database
        </h3>
        <p className="text-xs text-[#888888] max-w-md mx-auto">
          Full Lead management table, CSV importer with column mapping, status filtering (Pending, Sent, Failed, Replied, Unsubscribed, Invalid) will be active in Step 2.
        </p>
      </div>
    </div>
  );
}
