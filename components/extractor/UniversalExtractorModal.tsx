'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Mail,
  Send,
  Download,
  Filter,
  Search,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  Users,
  Layers,
  ArrowRight,
  Database,
  ExternalLink,
} from 'lucide-react';
import {
  ExtractedEmail,
  ExtractionResult,
  extractEmailsFromFile,
  extractEmailsFromText,
} from '@/lib/email-extractor';

interface UniversalExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedEmails: ExtractedEmail[];
  setExtractedEmails: React.Dispatch<React.SetStateAction<ExtractedEmail[]>>;
  onBulkSend: (selectedEmails: ExtractedEmail[]) => void;
  onSingleSend: (email: ExtractedEmail) => void;
  onInjectIntoCanvas: (emails: ExtractedEmail[]) => void;
}

export function UniversalExtractorModal({
  isOpen,
  onClose,
  extractedEmails,
  setExtractedEmails,
  onBulkSend,
  onSingleSend,
  onInjectIntoCanvas,
}: UniversalExtractorModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastFileName, setLastFileName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setIsScanning(true);
    try {
      const result: ExtractionResult = await extractEmailsFromFile(file);
      setLastFileName(result.fileName);

      // Merge and deduplicate with existing
      const existingSet = new Set(extractedEmails.map((e) => e.email));
      const freshEmails = result.emails.filter((e) => !existingSet.has(e.email));
      setExtractedEmails((prev) => [...freshEmails, ...prev]);
    } catch (e: any) {
      alert(`Error extracting emails from file: ${e.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFile(files[0]);
    }
    e.target.value = '';
  };

  // Sample data loaders
  const loadSampleData = (type: 'mixed' | 'b2b' | 'raw_log') => {
    let sampleContent = '';
    let name = 'sample.txt';

    if (type === 'mixed') {
      name = 'global_leads_mixed.csv';
      sampleContent = `User,Contact Email,Notes\nAlex,alex.chen99@gmail.com,Personal account\nDavid,d.ross@yahoo.com,Yahoo mail\nJordan,jordan.smith@outlook.com,Outlook\nSarah,sarah@fintechhub.net,Enterprise lead\nElena,elena_k@gmail.com,Inbound query\nMarcus,marcus@databridge.co,CTO\nRachel,rachel.green@hotmail.com,Hotmail user\nTom,tom.b@apple.com,Corporate\nSophie,sophie@swiftscale.co,COO\nLiam,liam@ymail.com,Yahoo contact`;
    } else if (type === 'b2b') {
      name = 'enterprise_executives.xlsx';
      sampleContent = `email,name,company,title\navapatel@nexuscloud.ai,Ava Patel,NexusCloud,VP Engineering\nnoahw@automateiq.io,Noah Williams,AutomateIQ,Lead Architect\nisabella.b@quantumbyte.org,Isabella Brown,QuantumByte,VP Data Science\nethan.taylor@synapseworks.com,Ethan Taylor,SynapseWorks,Head of Growth\nmia@vectorbase.io,Mia Anderson,VectorBase,Product Lead\nlucas.t@flowlogic.ai,Lucas Thomas,FlowLogic,CTO\ncharlotte.j@devscale.co,Charlotte Jackson,DevScale,Engineering Director\nben.white@orbitalsystems.net,Benjamin White,OrbitalSystems,Operations Director`;
    } else {
      name = 'server_access_log.txt';
      sampleContent = `[2026-10-08 21:04:12] AUTH_SUCCESS user="admin@cloudmatrix.dev" ip=192.168.1.4\n[2026-10-08 21:05:01] NOTIFY_QUEUED to="oliver.m@gmail.com" priority=high\n[2026-10-08 21:05:44] INVOICE_SENT to="billing@hyperlink.ai" amt=450.00\n[2026-10-08 21:06:12] SIGNUP_EVENT email="evelyn.lee@yahoo.com" status=active\n[2026-10-08 21:07:00] WEBHOOK_DISPATCH target="support@saasmetrics.net"\n[2026-10-08 21:08:29] EMAIL_VERIFIED user="henry_allen@outlook.com"`;
    }

    const result = extractEmailsFromText(sampleContent, name);
    setLastFileName(name);
    setExtractedEmails(result.emails);
  };

  // Selection handlers
  const toggleSelectAll = () => {
    const allSelected = filteredEmails.every((e) => e.selected);
    const updated = extractedEmails.map((e) => {
      if (filteredEmails.some((fe) => fe.id === e.id)) {
        return { ...e, selected: !allSelected };
      }
      return e;
    });
    setExtractedEmails(updated);
  };

  const toggleSelectEmail = (id: string) => {
    setExtractedEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e))
    );
  };

  const removeEmail = (id: string) => {
    setExtractedEmails((prev) => prev.filter((e) => e.id !== id));
  };

  // Filter & Search computation
  const filteredEmails = extractedEmails.filter((item) => {
    const matchesSearch =
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.domain.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterDomain === 'all') return true;
    return item.provider.toLowerCase() === filterDomain.toLowerCase();
  });

  const selectedCount = filteredEmails.filter((e) => e.selected).length;

  // Domain breakdown stats
  const domainStats = {
    gmail: extractedEmails.filter((e) => e.provider === 'Gmail').length,
    yahoo: extractedEmails.filter((e) => e.provider === 'Yahoo').length,
    outlook: extractedEmails.filter((e) => e.provider === 'Outlook').length,
    custom: extractedEmails.filter((e) => e.provider === 'Custom').length,
  };

  // Export clean CSV
  const handleExportCsv = () => {
    if (extractedEmails.length === 0) return;
    const csvContent =
      'Email,Domain,Provider,Source\n' +
      extractedEmails
        .map((e) => `${e.email},${e.domain},${e.provider},${e.sourceFile}`)
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_emails_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-5xl bg-[#12161f] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Universal File Email Extractor &amp; Data Grid
                </h2>
                <span className="text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  Universal Regex Scanner
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Drop ANY file format (CSV, Excel, TXT, JSON, PDF, Logs) to extract all valid emails instantly.
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

        {/* Universal Dropzone Banner */}
        <div className="p-5 border-b border-slate-800/80 bg-slate-950/40">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-5 text-center cursor-pointer bg-slate-900/40 hover:bg-slate-900/70 transition-all flex flex-col items-center justify-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center transition-colors">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {isScanning ? (
                  <span className="text-emerald-400 animate-pulse">Scanning file buffers for emails...</span>
                ) : (
                  <>
                    Drag &amp; drop <span className="text-emerald-400 font-mono">ANY FILE FORMAT</span> here, or{' '}
                    <span className="text-emerald-400 underline">browse files</span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Accepts .csv, .xlsx, .xls, .txt, .json, .log, .pdf, .docx, or raw dumps
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {/* Quick Sample Presets */}
          <div className="flex items-center justify-between mt-3 text-xs">
            <span className="text-slate-500 text-[11px]">Or load realistic sample datasets:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadSampleData('mixed')}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/80"
              >
                Mixed Domains (Gmail, Yahoo, Outlook)
              </button>
              <button
                onClick={() => loadSampleData('b2b')}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/80"
              >
                B2B Executive Leads (.xlsx)
              </button>
              <button
                onClick={() => loadSampleData('raw_log')}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700/80"
              >
                Raw Server Logs (.txt)
              </button>
            </div>
          </div>
        </div>

        {/* Stats & Filters Bar */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
          {/* Domain Breakdown Pills */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <button
              onClick={() => setFilterDomain('all')}
              className={`px-2 py-1 rounded-lg border transition-all ${
                filterDomain === 'all'
                  ? 'bg-slate-700 text-white border-slate-600 font-semibold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              All ({extractedEmails.length})
            </button>
            <button
              onClick={() => setFilterDomain('gmail')}
              className={`px-2 py-1 rounded-lg border transition-all ${
                filterDomain === 'gmail'
                  ? 'bg-red-950/80 text-red-300 border-red-700 font-semibold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              @gmail.com ({domainStats.gmail})
            </button>
            <button
              onClick={() => setFilterDomain('yahoo')}
              className={`px-2 py-1 rounded-lg border transition-all ${
                filterDomain === 'yahoo'
                  ? 'bg-purple-950/80 text-purple-300 border-purple-700 font-semibold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              @yahoo.com ({domainStats.yahoo})
            </button>
            <button
              onClick={() => setFilterDomain('outlook')}
              className={`px-2 py-1 rounded-lg border transition-all ${
                filterDomain === 'outlook'
                  ? 'bg-blue-950/80 text-blue-300 border-blue-700 font-semibold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              @outlook.com ({domainStats.outlook})
            </button>
            <button
              onClick={() => setFilterDomain('custom')}
              className={`px-2 py-1 rounded-lg border transition-all ${
                filterDomain === 'custom'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700 font-semibold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Custom / Corporate ({domainStats.custom})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search emails or domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Data Grid Table */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white">
                      {filteredEmails.length > 0 && filteredEmails.every((e) => e.selected) ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-3 w-12 text-slate-500">#</th>
                  <th className="p-3">Email Address</th>
                  <th className="p-3">Domain</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Source File</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredEmails.length > 0 ? (
                  filteredEmails.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-900/60 transition-colors ${
                        item.selected ? 'bg-emerald-950/15' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleSelectEmail(item.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {item.selected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-slate-600 font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-100 flex items-center gap-2">
                        <span>{item.email}</span>
                      </td>
                      <td className="p-3 text-slate-400 text-[11px]">{item.domain}</td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            item.provider === 'Gmail'
                              ? 'text-red-400 bg-red-950/50 border-red-800/50'
                              : item.provider === 'Yahoo'
                              ? 'text-purple-400 bg-purple-950/50 border-purple-800/50'
                              : item.provider === 'Outlook'
                              ? 'text-blue-400 bg-blue-950/50 border-blue-800/50'
                              : 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50'
                          }`}
                        >
                          {item.provider}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[11px] truncate max-w-[140px]">
                        {item.sourceFile}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSingleSend(item)}
                            className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-200 border border-slate-700/80 transition-colors flex items-center gap-1 font-sans"
                            title="Single Send to this email"
                          >
                            <Send className="w-3 h-3 text-red-400" />
                            <span>Send</span>
                          </button>
                          <button
                            onClick={() => removeEmail(item.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Remove from list"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                      <Mail className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      <p className="text-xs">No email addresses found matching criteria.</p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Drag &amp; drop a file above or click one of the sample presets.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-mono">
              Selected: <strong className="text-white">{selectedCount}</strong> of{' '}
              {filteredEmails.length} emails
            </span>
            <button
              onClick={handleExportCsv}
              disabled={extractedEmails.length === 0}
              className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700 transition-colors disabled:opacity-40"
            >
              <Download className="w-3 h-3" />
              <span>Export Clean CSV</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onInjectIntoCanvas(filteredEmails.filter((e) => e.selected))}
              disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-40 shadow-sm"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Send to Workflow Canvas</span>
            </button>

            <button
              onClick={() => onBulkSend(filteredEmails.filter((e) => e.selected))}
              disabled={selectedCount === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-red-900/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed transform active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Bulk Send to {selectedCount} Emails</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
