import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Plus, Upload, Search, Filter, Trash2, Mail, 
  CheckSquare, Square, Edit2, X, AlertCircle, CheckCircle2, 
  Database, RefreshCw, ChevronRight, FileText, Download, Copy, Check
} from 'lucide-react';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({
    total: 0, pending: 0, sent: 0, failed: 0, replied: 0, unsubscribed: 0, invalid: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(null);
  
  // Toast notifications
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append('q', searchTerm);
      if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch leads');
      const data = await res.json();
      setLeads(data.leads || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error(err);
      showToast('Error loading leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [selectedStatus]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchLeads();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleSelectAll = () => {
    if (selectedIds.size === leads.length && leads.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const handleToggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDeleteLead = async (id) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete lead');
      showToast('Lead deleted successfully');
      fetchLeads();
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));
    } catch (err) {
      showToast('Failed to delete lead', 'error');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected leads?`)) return;
    try {
      const res = await fetch('/api/leads/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      showToast(`Deleted ${data.deletedCount || selectedIds.size} leads`);
      setSelectedIds(new Set());
      fetchLeads();
    } catch (err) {
      showToast('Batch delete failed', 'error');
    }
  };

  const handleBatchStatus = async (status) => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch('/api/leads/batch-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      const data = await res.json();
      showToast(`Updated ${data.updatedCount || selectedIds.size} leads to ${status}`);
      setSelectedIds(new Set());
      fetchLeads();
    } catch (err) {
      showToast('Batch status update failed', 'error');
    }
  };

  const handleSeedSampleLeads = async () => {
    try {
      const res = await fetch('/api/leads/sample', { method: 'POST' });
      const data = await res.json();
      showToast(`Added ${data.inserted} sample leads to database!`);
      fetchLeads();
    } catch (err) {
      showToast('Failed to seed sample leads', 'error');
    }
  };

  const handleCopy = (email) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return 'text-[#E5A93C] border-[#E5A93C]/30 bg-[#E5A93C]/10';
      case 'Sent':
        return 'text-[#3B82F6] border-[#3B82F6]/30 bg-[#3B82F6]/10';
      case 'Replied':
        return 'text-[#10B981] border-[#10B981]/30 bg-[#10B981]/10';
      case 'Failed':
        return 'text-[#E10600] border-[#E10600]/30 bg-[#E10600]/10';
      case 'Unsubscribed':
        return 'text-[#8B5CF6] border-[#8B5CF6]/30 bg-[#8B5CF6]/10';
      case 'Invalid':
        return 'text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/10';
      default:
        return 'text-[#888888] border-[#2A2A2A] bg-[#141414]';
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
            <Users className="w-5 h-5 text-[#E10600]" />
            Leads Management
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Built-in recipient database. Filter by status, import CSVs, and manage email campaigns.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handleSeedSampleLeads}
            className="bg-[#141414] border border-[#2A2A2A] hover:border-[#888888] text-white px-3 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors font-mono"
            title="Populate test leads"
          >
            <Database className="w-3.5 h-3.5 text-[#E10600]" />
            <span>Load 10 Samples</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="bg-[#141414] border border-[#2A2A2A] hover:border-[#E10600] text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors font-mono"
          >
            <Upload className="w-3.5 h-3.5 text-[#E10600]" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => {
              setEditingLead(null);
              setShowAddModal(true);
            }}
            className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors font-mono"
          >
            <Plus className="w-4 h-4" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Stats Filter Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 font-mono text-xs">
        {[
          { key: 'all', label: 'All Leads', count: stats.total, color: 'text-white' },
          { key: 'Pending', label: 'Pending', count: stats.pending, color: 'text-[#E5A93C]' },
          { key: 'Sent', label: 'Sent', count: stats.sent, color: 'text-[#3B82F6]' },
          { key: 'Replied', label: 'Replied', count: stats.replied, color: 'text-[#10B981]' },
          { key: 'Failed', label: 'Failed', count: stats.failed, color: 'text-[#E10600]' },
          { key: 'Unsubscribed', label: 'Unsub', count: stats.unsubscribed, color: 'text-[#8B5CF6]' },
          { key: 'Invalid', label: 'Invalid', count: stats.invalid, color: 'text-[#EF4444]' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setSelectedStatus(item.key)}
            className={`p-3 text-left border transition-all ${
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

      {/* Search & Bulk Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#141414] border border-[#2A2A2A] p-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search leads by name, email, company, city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#555555] font-mono focus:outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888888] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#888888] px-2">{selectedIds.size} selected</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleBatchStatus('Pending')}
                className="px-2 py-1 bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#E5A93C] text-[#E5A93C] text-[11px]"
              >
                Mark Pending
              </button>
              <button
                onClick={() => handleBatchStatus('Unsubscribed')}
                className="px-2 py-1 bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#8B5CF6] text-[#8B5CF6] text-[11px]"
              >
                Mark Unsub
              </button>
              <button
                onClick={handleBatchDelete}
                className="px-2.5 py-1 bg-[#1C0000] border border-[#E10600] hover:bg-[#E10600] text-white text-[11px] flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-[#888888] font-mono">
            <span>Showing {leads.length} matching leads</span>
            <button
              onClick={fetchLeads}
              className="p-1 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Leads Table */}
      <div className="bg-[#141414] border border-[#2A2A2A] overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs font-mono text-[#888888] flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-[#E10600] border-t-transparent animate-spin rounded-full" />
            <span>Loading leads...</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-10 h-10 text-[#444444] mx-auto mb-3" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-1 font-mono">
              No Leads Found
            </h3>
            <p className="text-xs text-[#888888] max-w-sm mx-auto mb-6">
              {searchTerm || selectedStatus !== 'all'
                ? 'No leads matched your filter criteria. Try clearing search or status filters.'
                : 'Your leads database is empty. Add a lead manually, load samples, or import a CSV file.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleSeedSampleLeads}
                className="bg-[#141414] border border-[#2A2A2A] hover:border-[#E10600] text-white px-3 py-2 text-xs font-mono uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
              >
                <Database className="w-3.5 h-3.5 text-[#E10600]" />
                <span>Load 10 Samples</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-3.5 py-2 text-xs font-mono uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Single Lead</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2A2A2A] bg-[#0E0E0E] text-[#888888] font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <button
                      onClick={handleSelectAll}
                      className="text-[#888888] hover:text-white"
                    >
                      {selectedIds.size === leads.length && leads.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-[#E10600]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Business & City</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Pipeline Step</th>
                  <th className="py-3 px-4">Last Sent</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {leads.map((lead) => {
                  const isSelected = selectedIds.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-[#1A1A1A] transition-colors ${
                        isSelected ? 'bg-[#181212]' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleSelect(lead.id)}
                          className="text-[#888888] hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#E10600]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">
                          {lead.name || <span className="text-[#555555] italic">No Name</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#888888] font-mono mt-0.5">
                          <span>{lead.email}</span>
                          <button
                            onClick={() => handleCopy(lead.email)}
                            className="hover:text-white"
                            title="Copy email"
                          >
                            {copiedEmail === lead.email ? (
                              <Check className="w-3 h-3 text-[#10B981]" />
                            ) : (
                              <Copy className="w-3 h-3 text-[#555555]" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#AAAAAA]">
                        <div>{lead.business || <span className="text-[#555555]">-</span>}</div>
                        <div className="text-[11px] text-[#777777]">{lead.city || ''}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] uppercase font-semibold border ${getStatusBadge(
                            lead.status
                          )}`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#888888] text-[11px]">
                        {lead.step || 'Initial'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#777777] text-[11px]">
                        {lead.sent_at ? new Date(lead.sent_at).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingLead(lead);
                              setShowAddModal(true);
                            }}
                            className="p-1 text-[#888888] hover:text-white hover:bg-[#2A2A2A]"
                            title="Edit Lead"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="p-1 text-[#888888] hover:text-[#E10600] hover:bg-[#2A2A2A]"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Lead Modal */}
      {showAddModal && (
        <LeadFormModal
          lead={editingLead}
          onClose={() => {
            setShowAddModal(false);
            setEditingLead(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingLead(null);
            fetchLeads();
            showToast(editingLead ? 'Lead updated' : 'Lead created');
          }}
        />
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <CsvImportModal
          onClose={() => setShowImportModal(false)}
          onImported={(summary) => {
            setShowImportModal(false);
            fetchLeads();
            showToast(
              `Imported ${summary.imported} leads (${summary.skipped} skipped, ${summary.invalid} invalid)`
            );
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Subcomponent: Lead Add/Edit Modal
// -------------------------------------------------------------
function LeadFormModal({ lead, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    name: lead?.name || '',
    email: lead?.email || '',
    business: lead?.business || '',
    city: lead?.city || '',
    status: lead?.status || 'Pending',
    step: lead?.step || 'Initial',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email.trim()) {
      setError('Email address is required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const url = lead ? `/api/leads/${lead.id}` : '/api/leads';
      const method = lead ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] w-full max-w-lg p-6 relative">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2A2A2A]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Users className="w-4 h-4 text-[#E10600]" />
            <span>{lead ? 'Edit Lead' : 'Add New Lead'}</span>
          </h2>
          <button onClick={onClose} className="text-[#888888] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#1C0000] border border-[#E10600] text-xs font-mono text-[#FF4D4D] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#888888] uppercase mb-1">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. John Doe"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#888888] uppercase mb-1">
                Email Address <span className="text-[#E10600]">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@company.com"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#888888] uppercase mb-1">Company / Business</label>
              <input
                type="text"
                value={formData.business}
                onChange={(e) => setFormData({ ...formData, business: e.target.value })}
                placeholder="e.g. Acme Corp"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#888888] uppercase mb-1">City / Region</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. New York"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#888888] uppercase mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              >
                <option value="Pending">Pending</option>
                <option value="Sent">Sent</option>
                <option value="Replied">Replied</option>
                <option value="Failed">Failed</option>
                <option value="Unsubscribed">Unsubscribed</option>
                <option value="Invalid">Invalid</option>
              </select>
            </div>
            <div>
              <label className="block text-[#888888] uppercase mb-1">Pipeline Step</label>
              <input
                type="text"
                value={formData.step}
                onChange={(e) => setFormData({ ...formData, step: e.target.value })}
                placeholder="e.g. Initial, Step 1"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2A2A2A]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#2A2A2A] hover:border-[#888888] text-[#888888] hover:text-white uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#E10600] hover:bg-[#FF1A1A] disabled:opacity-50 text-white px-5 py-2 uppercase tracking-wider font-semibold transition-colors flex items-center gap-2"
            >
              {saving && <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />}
              <span>{lead ? 'Update Lead' : 'Save Lead'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Subcomponent: CSV Import Modal with Smart Column Mapping
// -------------------------------------------------------------
function CsvImportModal({ onClose, onImported }) {
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({ email: '', name: '', business: '', city: '' });
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  // Parse CSV text into headers and rows
  const parseCSVData = (text) => {
    try {
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setError('CSV must have a header row and at least one data row');
        return;
      }

      const parseLine = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim().replace(/^["']|["']$/g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim().replace(/^["']|["']$/g, ''));
        return result;
      };

      const hdrs = parseLine(lines[0]);
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = parseLine(lines[i]);
        if (vals.some((v) => v.length > 0)) {
          const rowObj = {};
          hdrs.forEach((h, idx) => {
            rowObj[h] = vals[idx] || '';
          });
          rows.push(rowObj);
        }
      }

      setHeaders(hdrs);
      setRawRows(rows);
      setError('');

      // Auto-detect column mappings
      const detected = { email: '', name: '', business: '', city: '' };
      hdrs.forEach((h) => {
        const lower = h.toLowerCase().trim();
        if (!detected.email && (lower.includes('email') || lower.includes('mail'))) {
          detected.email = h;
        } else if (!detected.name && (lower.includes('name') || lower.includes('contact') || lower.includes('person'))) {
          detected.name = h;
        } else if (!detected.business && (lower.includes('business') || lower.includes('company') || lower.includes('org') || lower.includes('firm'))) {
          detected.business = h;
        } else if (!detected.city && (lower.includes('city') || lower.includes('location') || lower.includes('town'))) {
          detected.city = h;
        }
      });
      setMapping(detected);
    } catch (err) {
      setError('Failed to parse CSV format');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      setCsvText(content);
      parseCSVData(content);
    };
    reader.readAsText(file);
  };

  const handleLoadSampleCSV = () => {
    const sample = `Full Name,Work Email,Company Name,Headquarters
Sarah Connor,sarah.connor@cyberdyne.tech,Cyberdyne Systems,Los Angeles
Bruce Wayne,bruce@wayne-enterprises.com,Wayne Enterprises,Gotham
Tony Stark,tony@starkindustries.io,Stark Industries,New York
Elena Rostova,elena@novatech-logistics.com,NovaTech Logistics,Chicago
Marcus Vance,marcus@apexcapital.co,Apex Capital,Boston`;
    setCsvText(sample);
    parseCSVData(sample);
  };

  const handleExecuteImport = async () => {
    if (!mapping.email) {
      setError('Please map the Email column');
      return;
    }

    try {
      setImporting(true);
      setError('');

      // Transform rows using mapped fields
      const formattedLeads = rawRows.map((row) => ({
        email: row[mapping.email] || '',
        name: mapping.name ? row[mapping.name] : '',
        business: mapping.business ? row[mapping.business] : '',
        city: mapping.city ? row[mapping.city] : '',
        status: 'Pending',
        step: 'Initial',
      }));

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: formattedLeads,
          skipDuplicates,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      onImported(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2A2A2A]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#E10600]" />
            <span>CSV Lead Importer</span>
          </h2>
          <button onClick={onClose} className="text-[#888888] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#1C0000] border border-[#E10600] text-xs font-mono text-[#FF4D4D] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {rawRows.length === 0 ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-[#2A2A2A] hover:border-[#E10600] p-10 text-center transition-colors">
              <Upload className="w-8 h-8 text-[#888888] mx-auto mb-2" />
              <p className="text-xs font-mono text-white mb-1">
                Select or drop a CSV file containing contacts
              </p>
              <p className="text-[11px] font-mono text-[#666666] mb-4">
                Accepted format: comma-separated values (.csv, .txt)
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                id="csv-file-input"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-3">
                <label
                  htmlFor="csv-file-input"
                  className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-4 py-2 text-xs font-mono uppercase tracking-wider font-semibold cursor-pointer"
                >
                  Browse Files
                </label>
                <button
                  type="button"
                  onClick={handleLoadSampleCSV}
                  className="bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#888888] text-white px-4 py-2 text-xs font-mono uppercase tracking-wider"
                >
                  Load Sample CSV
                </button>
              </div>
            </div>

            <div className="text-[11px] font-mono text-[#777777] p-3 bg-[#0A0A0A] border border-[#2A2A2A]">
              <span className="text-white font-semibold">Tip: </span>
              FlowCart automatically maps headers like "Email", "Name", "Company", and "City". You will be able to review column mapping on the next step.
            </div>
          </div>
        ) : (
          <div className="space-y-5 text-xs font-mono">
            {/* Column Mapping Section */}
            <div>
              <div className="text-[#888888] uppercase text-[11px] mb-2 font-semibold">
                Map CSV Headers to Lead Fields
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0A0A0A] p-3 border border-[#2A2A2A]">
                <div>
                  <label className="block text-[#E10600] uppercase mb-1 font-bold">
                    Email *
                  </label>
                  <select
                    value={mapping.email}
                    onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                    className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#E10600] p-1.5 text-white"
                  >
                    <option value="">-- Select --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#888888] uppercase mb-1">Name</label>
                  <select
                    value={mapping.name}
                    onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                    className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#E10600] p-1.5 text-white"
                  >
                    <option value="">-- Ignore --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#888888] uppercase mb-1">Company</label>
                  <select
                    value={mapping.business}
                    onChange={(e) => setMapping({ ...mapping, business: e.target.value })}
                    className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#E10600] p-1.5 text-white"
                  >
                    <option value="">-- Ignore --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#888888] uppercase mb-1">City</label>
                  <select
                    value={mapping.city}
                    onChange={(e) => setMapping({ ...mapping, city: e.target.value })}
                    className="w-full bg-[#141414] border border-[#2A2A2A] focus:border-[#E10600] p-1.5 text-white"
                  >
                    <option value="">-- Ignore --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Preview First 3 Rows */}
            <div>
              <div className="text-[#888888] uppercase text-[11px] mb-2 font-semibold">
                Preview ({rawRows.length} total rows parsed)
              </div>
              <div className="bg-[#0A0A0A] border border-[#2A2A2A] overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-[#2A2A2A] text-[#777777]">
                      <th className="p-2">#</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Company</th>
                      <th className="p-2">City</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2A2A]">
                    {rawRows.slice(0, 4).map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 text-[#555555]">{i + 1}</td>
                        <td className="p-2 text-white">{mapping.email ? r[mapping.email] : '-'}</td>
                        <td className="p-2 text-[#AAAAAA]">{mapping.name ? r[mapping.name] : '-'}</td>
                        <td className="p-2 text-[#AAAAAA]">{mapping.business ? r[mapping.business] : '-'}</td>
                        <td className="p-2 text-[#AAAAAA]">{mapping.city ? r[mapping.city] : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="skip-dupes"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="accent-[#E10600]"
              />
              <label htmlFor="skip-dupes" className="text-white cursor-pointer">
                Skip duplicate emails if already present in database
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#2A2A2A]">
              <button
                type="button"
                onClick={() => {
                  setRawRows([]);
                  setHeaders([]);
                  setCsvText('');
                }}
                className="text-[#888888] hover:text-white uppercase tracking-wider text-[11px]"
              >
                Choose Different File
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-[#2A2A2A] hover:border-[#888888] text-[#888888] hover:text-white uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={importing || !mapping.email}
                  className="bg-[#E10600] hover:bg-[#FF1A1A] disabled:opacity-50 text-white px-5 py-2 uppercase tracking-wider font-semibold transition-colors flex items-center gap-2"
                >
                  {importing && (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  )}
                  <span>Import {rawRows.length} Leads</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
