'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Copy,
  Check,
  Trash2,
  Sparkles,
  Mail,
  FormInput,
  FileUp,
  Code,
  GitBranch,
  Send,
  Loader2,
  Plus,
  Variable,
  Layers,
  ArrowRight,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Users,
  Shield,
  Upload,
  CheckCircle2,
  AlertCircle,
  MailCheck,
} from 'lucide-react';
import { WorkflowNodeData, FormFieldDefinition, RecipientRecord } from '@/types/workflow';
import { parseCsvToRecipients } from '@/lib/workflow-engine';

interface NodeConfigDrawerProps {
  node: WorkflowNodeData | null;
  upstreamNodes: WorkflowNodeData[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updatedData: Partial<WorkflowNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  apiKeys: { openaiApiKey?: string; userEmail?: string; appPassword?: string; gmailToken?: string };
}

export function NodeConfigDrawer({
  node,
  upstreamNodes,
  isOpen,
  onClose,
  onUpdateNode,
  onDeleteNode,
  apiKeys,
}: NodeConfigDrawerProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'data'>('config');
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Password visibility states
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [showOAuthToken, setShowOAuthToken] = useState(false);

  // Local editable state
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<Record<string, any>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (node) {
      setLabel(node.label || '');
      setConfig(node.config || {});
      setTestResult(node.lastRunOutput || null);
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const nodeType = node.nodeType;

  const handleConfigChange = (key: string, value: any) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    onUpdateNode(node.id, { config: updated });
  };

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel);
    onUpdateNode(node.id, { label: newLabel });
  };

  const handleCopyJson = (obj: any) => {
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Process uploaded CSV/TXT email list
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCsvToRecipients(text, {
        email: config.emailColumn || 'email',
        name: config.nameColumn || 'name',
        company: config.companyColumn || 'company',
      });

      const updated = {
        ...config,
        fileName: file.name,
        rawContent: text,
        recipients: parsed.recipients,
        totalCount: parsed.totalCount,
        validCount: parsed.validCount,
        invalidCount: parsed.invalidCount,
      };

      setConfig(updated);
      onUpdateNode(node.id, { config: updated });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Load sample 25 leads
  const handleLoadSampleLeads = () => {
    const sampleCsv = `email,name,company,role\nalex.chen@techcorp.io,Alex Chen,TechCorp,VP Engineering\nsarah.miller@growthlab.com,Sarah Miller,GrowthLab,Director of Operations\njordan.smith@cloudpulse.ai,Jordan Smith,CloudPulse,Head of AI\nemily.davis@fintechhub.net,Emily Davis,FintechHub,Lead Product Manager\nmarcus.vance@databridge.co,Marcus Vance,DataBridge,CTO\nolivia.wang@salespeak.io,Olivia Wang,SalesPeak,VP Sales Operations\ndavid.ross@hyperflow.dev,David Ross,HyperFlow,Principal Architect\nsophia.martinez@swiftscale.co,Sophia Martinez,SwiftScale,Chief Operations Officer\nliam.johnson@apixcel.com,Liam Johnson,APIXcel,Head of Partnerships\nava.patel@nexuscloud.ai,Ava Patel,NexusCloud,Director of Engineering\nnoah.williams@automateiq.io,Noah Williams,AutomateIQ,Solutions Architect\nisabella.brown@quantumbyte.org,Isabella Brown,QuantumByte,VP Data Science\nethan.taylor@synapseworks.com,Ethan Taylor,SynapseWorks,Head of Growth\nmia.anderson@vectorbase.io,Mia Anderson,VectorBase,Product Lead\nlucas.thomas@flowlogic.ai,Lucas Thomas,FlowLogic,Chief Technology Officer\ncharlotte.jackson@devscale.co,Charlotte Jackson,DevScale,Engineering Manager\nbenjamin.white@orbitalsystems.net,Benjamin White,OrbitalSystems,Operations Director\namelia.harris@cloudmatrix.dev,Amelia Harris,CloudMatrix,Principal Engineer\noliver.martin@pulseautomations.io,Oliver Martin,PulseAutomations,Founder & CEO\nharper.clark@zenithengineering.com,Harper Clark,ZenithEngineering,VP Infrastructure\nalexander.lewis@hyperlink.ai,Alexander Lewis,HyperLink,Chief Architect\nevelyn.lee@datastream.io,Evelyn Lee,DataStream,Director of Technology\ndaniel.walker@saasmetrics.net,Daniel Walker,SaaSMetrics,VP Customer Success\nabigail.hall@agileworks.org,Abigail Hall,AgileWorks,Director of Product\nhenry.allen@apexcloud.io,Henry Allen,ApexCloud,Solutions Lead`;

    const parsed = parseCsvToRecipients(sampleCsv);
    const updated = {
      ...config,
      fileName: 'b2b_tech_leads_25.csv',
      rawContent: sampleCsv,
      recipients: parsed.recipients,
      totalCount: parsed.totalCount,
      validCount: parsed.validCount,
      invalidCount: parsed.invalidCount,
    };

    setConfig(updated);
    onUpdateNode(node.id, { config: updated });
  };

  // Test Node Directly
  const handleTestNode = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      if (nodeType === 'openai_llm' || nodeType === 'openai_classifier') {
        const effectiveKey =
          (config.apiKeySource === 'custom' && config.customApiKey)
            ? config.customApiKey
            : apiKeys.openaiApiKey;

        const res = await fetch('/api/ai/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model || 'gpt-4o-mini',
            systemPrompt: config.systemPrompt,
            userPrompt: config.userPrompt,
            apiKey: effectiveKey,
            baseUrl: config.customBaseUrl || 'https://api.openai.com/v1',
          }),
        });
        const data = await res.json();
        setTestResult(data);
        onUpdateNode(node.id, {
          status: data.success ? 'success' : 'error',
          lastRunOutput: data,
        });
      } else if (nodeType === 'gmail_send') {
        const authMethod = config.authMethod || (config.customAppPassword ? 'app_password' : 'sandbox');
        const res = await fetch('/api/email/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: config.to || 'alex.morgan@example.com',
            cc: config.cc,
            subject: config.subject,
            body: config.body,
            authMethod,
            userEmail: config.customUserEmail || apiKeys.userEmail,
            appPassword: config.customAppPassword || apiKeys.appPassword,
            oauthToken: config.customOAuthToken || apiKeys.gmailToken,
          }),
        });
        const data = await res.json();
        setTestResult(data);
        onUpdateNode(node.id, {
          status: data.success ? 'success' : 'error',
          lastRunOutput: data,
        });
      } else if (nodeType === 'email_list_file_upload') {
        const parsed = parseCsvToRecipients(config.rawContent || '', {
          email: config.emailColumn,
          name: config.nameColumn,
          company: config.companyColumn,
        });
        const simulated = {
          fileName: config.fileName || 'email_list.csv',
          totalRecipients: parsed.totalCount,
          validRecipients: parsed.validCount,
          invalidRecipients: parsed.invalidCount,
          recipients: parsed.recipients.slice(0, 5),
          status: 'verified',
        };
        setTestResult(simulated);
        onUpdateNode(node.id, {
          status: 'success',
          lastRunOutput: simulated,
        });
      } else if (nodeType === 'input_form_trigger') {
        const simulated = {
          formTitle: config.formTitle,
          submittedValues: config.submittedValues,
          triggeredAt: new Date().toISOString(),
          status: 'verified',
        };
        setTestResult(simulated);
        onUpdateNode(node.id, {
          status: 'success',
          lastRunOutput: simulated,
        });
      } else if (nodeType === 'file_upload_trigger') {
        const simulated = {
          fileName: config.sampleFileName || 'uploaded_data.json',
          parsedData: config.parsedData,
          sizeKb: 14.8,
          status: 'parsed',
        };
        setTestResult(simulated);
        onUpdateNode(node.id, {
          status: 'success',
          lastRunOutput: simulated,
        });
      }
    } catch (err: any) {
      setTestResult({ error: err.message });
      onUpdateNode(node.id, {
        status: 'error',
        lastRunError: err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Helper to insert variable tag into text fields
  const insertVariable = (varString: string, fieldKey: string) => {
    const current = config[fieldKey] || '';
    handleConfigChange(fieldKey, `${current} {{${varString}}}`);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] bg-[#12161f] border-l border-slate-800 shadow-2xl z-30 flex flex-col font-sans text-slate-200 animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#ff6d5a]/15 border border-[#ff6d5a]/30 flex items-center justify-center text-[#ff6d5a]">
            {nodeType === 'email_list_file_upload' ? (
              <Users className="w-4 h-4 text-emerald-400" />
            ) : nodeType.includes('trigger') ? (
              <FormInput className="w-4 h-4 text-emerald-400" />
            ) : nodeType.includes('openai') ? (
              <Sparkles className="w-4 h-4 text-purple-400" />
            ) : nodeType.includes('gmail') ? (
              <Mail className="w-4 h-4 text-red-400" />
            ) : nodeType.includes('code') ? (
              <Code className="w-4 h-4 text-sky-400" />
            ) : (
              <GitBranch className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div>
            <input
              type="text"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="text-sm font-semibold bg-transparent text-white border-b border-transparent hover:border-slate-700 focus:border-[#ff6d5a] focus:outline-none px-0.5 py-0.5 w-72 transition-all"
              placeholder="Node Name"
            />
            <div className="text-[11px] font-mono text-slate-500">
              ID: <span className="text-slate-400">{node.id}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onDeleteNode(node.id)}
            title="Delete Node"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Close Drawer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 px-5 bg-slate-900/40">
        <button
          onClick={() => setActiveTab('config')}
          className={`py-2.5 text-xs font-medium border-b-2 transition-colors mr-6 ${
            activeTab === 'config'
              ? 'border-[#ff6d5a] text-[#ff6d5a]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Parameters &amp; API Keys
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'data'
              ? 'border-[#ff6d5a] text-[#ff6d5a]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Data &amp; Test Output
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {activeTab === 'config' && (
          <>
            {/* Upstream variables helper */}
            {upstreamNodes.length > 0 && (
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium text-slate-300">
                    <Variable className="w-3.5 h-3.5 text-[#ff6d5a]" /> Available Upstream Variables
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {upstreamNodes.length} source node(s)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {upstreamNodes.map((u) => {
                    const tag = `${u.id}.recipients`;
                    const hasRecipients = u.nodeType === 'email_list_file_upload';
                    return (
                      <React.Fragment key={u.id}>
                        <button
                          onClick={() => {
                            if (nodeType === 'openai_llm') insertVariable(`${u.id}.output`, 'userPrompt');
                            if (nodeType === 'gmail_send') insertVariable(`${u.id}.output`, 'body');
                          }}
                          className="text-[10px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-[#ff6d5a]/20 hover:text-[#ff6d5a] border border-slate-700/60 transition-colors flex items-center gap-1"
                          title={`Click to insert {{${u.id}.output}}`}
                        >
                          <span>&#123;&#123;{u.label || u.id}&#125;&#125;</span>
                        </button>
                        {hasRecipients && (
                          <button
                            onClick={() => {
                              if (nodeType === 'openai_llm') handleConfigChange('batchSourceField', tag);
                              if (nodeType === 'gmail_send') handleConfigChange('bulkRecipientSource', tag);
                            }}
                            className="text-[10px] font-mono px-2 py-1 rounded bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/60 transition-colors flex items-center gap-1"
                            title="Set as batch/bulk recipients list"
                          >
                            <Users className="w-3 h-3 text-emerald-400" />
                            <span>&#123;&#123;{u.label}.recipients&#125;&#125;</span>
                          </button>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* EMAIL LIST FILE UPLOAD CONFIGURATION */}
            {nodeType === 'email_list_file_upload' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">Email Contact File Source</h4>
                    <p className="text-[11px] text-slate-400">
                      Upload a CSV or TXT list of recipients to process
                    </p>
                  </div>
                  <button
                    onClick={handleLoadSampleLeads}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900/80 px-2.5 py-1 rounded border border-emerald-800/60 transition-colors"
                  >
                    Load 25 Sample Leads
                  </button>
                </div>

                {/* File Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer bg-slate-900/50 hover:bg-slate-900/80 transition-all space-y-1"
                >
                  <Upload className="w-6 h-6 mx-auto text-emerald-400 mb-1" />
                  <p className="text-xs font-medium text-slate-200">
                    {config.fileName ? `Selected: ${config.fileName}` : 'Click to upload CSV or text file'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Supports .csv, .txt, .json with emails &amp; contact headers
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.json"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                {/* Column Mapping */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">Email Column</label>
                    <input
                      type="text"
                      value={config.emailColumn || 'email'}
                      onChange={(e) => handleConfigChange('emailColumn', e.target.value)}
                      className="w-full bg-slate-900 text-xs px-2.5 py-1.5 rounded border border-slate-700 font-mono"
                      placeholder="email"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">Name Column</label>
                    <input
                      type="text"
                      value={config.nameColumn || 'name'}
                      onChange={(e) => handleConfigChange('nameColumn', e.target.value)}
                      className="w-full bg-slate-900 text-xs px-2.5 py-1.5 rounded border border-slate-700 font-mono"
                      placeholder="name"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">Company Column</label>
                    <input
                      type="text"
                      value={config.companyColumn || 'company'}
                      onChange={(e) => handleConfigChange('companyColumn', e.target.value)}
                      className="w-full bg-slate-900 text-xs px-2.5 py-1.5 rounded border border-slate-700 font-mono"
                      placeholder="company"
                    />
                  </div>
                </div>

                {/* Recipient Stats & Live Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">Parsed Recipients</span>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="text-slate-400">Total: {config.totalCount || 0}</span>
                      <span className="text-emerald-400 font-semibold">Valid: {config.validCount || 0}</span>
                      {config.invalidCount > 0 && (
                        <span className="text-rose-400">Invalid: {config.invalidCount}</span>
                      )}
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/80">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">Email</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Company</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {config.recipients && config.recipients.length > 0 ? (
                          config.recipients.map((r: RecipientRecord, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-900/40">
                              <td className="p-2 text-slate-600">{idx + 1}</td>
                              <td className="p-2 text-slate-200 truncate max-w-[140px]">{r.email}</td>
                              <td className="p-2 text-slate-400 truncate max-w-[90px]">{r.name || '—'}</td>
                              <td className="p-2 text-slate-400 truncate max-w-[90px]">{r.company || '—'}</td>
                              <td className="p-2">
                                {r.isValid !== false ? (
                                  <span className="text-[9px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                                    valid
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-rose-400 bg-rose-950/80 border border-rose-800/60 px-1.5 py-0.5 rounded">
                                    invalid
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-500 font-sans">
                              No contacts loaded. Upload a file or click &apos;Load 25 Sample Leads&apos;.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* OPENAI LLM & CLASSIFIER CONFIGURATION */}
            {(nodeType === 'openai_llm' || nodeType === 'openai_classifier') && (
              <div className="space-y-5">
                {/* 1. API KEY CONFIGURATION SECTION */}
                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                      <Key className="w-3.5 h-3.5 text-purple-400" />
                      <span>OpenAI API Key Connection</span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                      <button
                        onClick={() => handleConfigChange('apiKeySource', 'global')}
                        className={`px-2 py-0.5 rounded ${
                          config.apiKeySource !== 'custom'
                            ? 'bg-purple-600 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Workspace Key
                      </button>
                      <button
                        onClick={() => handleConfigChange('apiKeySource', 'custom')}
                        className={`px-2 py-0.5 rounded ${
                          config.apiKeySource === 'custom'
                            ? 'bg-purple-600 text-white font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Custom Key
                      </button>
                    </div>
                  </div>

                  {config.apiKeySource === 'custom' ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type={showOpenAiKey ? 'text' : 'password'}
                          value={config.customApiKey || ''}
                          onChange={(e) => handleConfigChange('customApiKey', e.target.value)}
                          placeholder="sk-proj-..."
                          className="w-full bg-slate-950 text-xs px-3 py-2 pr-9 rounded-lg border border-purple-800/60 focus:border-purple-500 focus:outline-none font-mono text-purple-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                          className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                        >
                          {showOpenAiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 mb-0.5">
                          Custom Base URL (Optional / Compatible endpoints)
                        </label>
                        <input
                          type="text"
                          value={config.customBaseUrl || ''}
                          onChange={(e) => handleConfigChange('customBaseUrl', e.target.value)}
                          placeholder="https://api.openai.com/v1"
                          className="w-full bg-slate-950 text-xs px-2.5 py-1.5 rounded border border-slate-800 font-mono text-slate-300"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Using workspace global key configured in top Settings</span>
                      <span className="font-mono text-emerald-400 text-[10px]">
                        {apiKeys.openaiApiKey ? '● Key Configured' : '○ Sandbox Mode'}
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. EXECUTION MODE (SINGLE VS BATCH/BULK) */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Execution Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleConfigChange('executionMode', 'single')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        config.executionMode !== 'batch'
                          ? 'border-purple-500 bg-purple-950/30 text-white'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950/50 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-semibold">Single Execution</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Run prompt once for upstream event
                      </div>
                    </button>

                    <button
                      onClick={() => handleConfigChange('executionMode', 'batch')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        config.executionMode === 'batch'
                          ? 'border-amber-500 bg-amber-950/30 text-white'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950/50 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center gap-1 text-amber-400">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Batch / Bulk Mode</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Iterate &amp; synthesize each contact in list
                      </div>
                    </button>
                  </div>

                  {config.executionMode === 'batch' && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Batch Variables:</span>
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <button
                            onClick={() => insertVariable('item.name', 'userPrompt')}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-900/40 text-amber-300 border border-slate-700"
                          >
                            &#123;&#123;item.name&#125;&#125;
                          </button>
                          <button
                            onClick={() => insertVariable('item.company', 'userPrompt')}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-900/40 text-amber-300 border border-slate-700"
                          >
                            &#123;&#123;item.company&#125;&#125;
                          </button>
                          <button
                            onClick={() => insertVariable('item.role', 'userPrompt')}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-900/40 text-amber-300 border border-slate-700"
                          >
                            &#123;&#123;item.role&#125;&#125;
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. MODEL & PARAMETERS */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Model</label>
                    <select
                      value={config.model || 'gpt-4o-mini'}
                      onChange={(e) => handleConfigChange('model', e.target.value)}
                      className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none font-mono text-purple-300"
                    >
                      <option value="gpt-4o">gpt-4o (Omni Reasoning)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (Fast &amp; Cost-effective)</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Temperature ({config.temperature ?? 0.7})
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.temperature ?? 0.7}
                      onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                      className="w-full accent-purple-500 mt-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    System Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={config.systemPrompt || ''}
                    onChange={(e) => handleConfigChange('systemPrompt', e.target.value)}
                    className="w-full bg-slate-900 text-xs p-2.5 rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none font-sans"
                    placeholder="You are an expert sales outreach AI..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      User Prompt Template
                    </label>
                    <span className="text-[10px] text-purple-400 font-mono">Supports &#123;&#123;variables&#125;&#125;</span>
                  </div>
                  <textarea
                    rows={5}
                    value={config.userPrompt || ''}
                    onChange={(e) => handleConfigChange('userPrompt', e.target.value)}
                    className="w-full bg-slate-900 text-xs p-2.5 rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none font-mono text-purple-200 leading-relaxed"
                    placeholder="Draft a personalized outreach pitch to {{item.name}} at {{item.company}}..."
                  />
                </div>
              </div>
            )}

            {/* GMAIL API SEND & BULK CONFIGURATION */}
            {nodeType === 'gmail_send' && (
              <div className="space-y-5">
                {/* 1. GMAIL CREDENTIALS SECTION */}
                <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-300">
                      <Key className="w-3.5 h-3.5 text-red-400" />
                      <span>Gmail Authentication Method</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                    <button
                      onClick={() => handleConfigChange('authMethod', 'app_password')}
                      className={`p-1.5 rounded border text-center ${
                        config.authMethod === 'app_password' || (!config.authMethod && config.customAppPassword)
                          ? 'border-red-500 bg-red-950/60 text-white font-semibold'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      App Password
                    </button>
                    <button
                      onClick={() => handleConfigChange('authMethod', 'oauth_token')}
                      className={`p-1.5 rounded border text-center ${
                        config.authMethod === 'oauth_token'
                          ? 'border-red-500 bg-red-950/60 text-white font-semibold'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      OAuth Token
                    </button>
                    <button
                      onClick={() => handleConfigChange('authMethod', 'sandbox')}
                      className={`p-1.5 rounded border text-center ${
                        config.authMethod === 'sandbox' || (!config.authMethod && !config.customAppPassword)
                          ? 'border-emerald-500 bg-emerald-950/60 text-white font-semibold'
                          : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Sandbox Mode
                    </button>
                  </div>

                  {/* App Password input fields */}
                  {(config.authMethod === 'app_password' || (!config.authMethod && config.customAppPassword)) && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="block text-[10px] font-mono text-slate-400 mb-0.5">
                          Your Personal Gmail Address
                        </label>
                        <input
                          type="email"
                          value={config.customUserEmail || ''}
                          onChange={(e) => handleConfigChange('customUserEmail', e.target.value)}
                          placeholder="you@gmail.com"
                          className="w-full bg-slate-950 text-xs px-2.5 py-1.5 rounded border border-slate-700 font-mono text-slate-200"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10px] font-mono text-slate-400">
                            16-Char Google App Password
                          </label>
                          <a
                            href="https://myaccount.google.com/apppasswords"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-red-400 hover:underline flex items-center gap-0.5"
                          >
                            <span>Generate in Google Security</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <div className="relative">
                          <input
                            type={showGmailPassword ? 'text' : 'password'}
                            value={config.customAppPassword || ''}
                            onChange={(e) => handleConfigChange('customAppPassword', e.target.value)}
                            placeholder="xxxx xxxx xxxx xxxx"
                            className="w-full bg-slate-950 text-xs px-2.5 py-1.5 pr-8 rounded border border-red-800/60 focus:border-red-500 focus:outline-none font-mono text-red-200"
                          />
                          <button
                            type="button"
                            onClick={() => setShowGmailPassword(!showGmailPassword)}
                            className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                          >
                            {showGmailPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* OAuth Token field */}
                  {config.authMethod === 'oauth_token' && (
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[10px] font-mono text-slate-400">
                        OAuth Bearer Token
                      </label>
                      <div className="relative">
                        <input
                          type={showOAuthToken ? 'text' : 'password'}
                          value={config.customOAuthToken || ''}
                          onChange={(e) => handleConfigChange('customOAuthToken', e.target.value)}
                          placeholder="ya29.a0AfH6S..."
                          className="w-full bg-slate-950 text-xs px-2.5 py-1.5 pr-8 rounded border border-red-800/60 font-mono text-red-200"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOAuthToken(!showOAuthToken)}
                          className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                        >
                          {showOAuthToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. SEND MODE (SINGLE VS BULK) */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Delivery Operation Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleConfigChange('sendMode', 'single')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        config.sendMode !== 'bulk'
                          ? 'border-red-500 bg-red-950/30 text-white'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950/50 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Single Email</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Send to 1 recipient or specific address
                      </div>
                    </button>

                    <button
                      onClick={() => handleConfigChange('sendMode', 'bulk')}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        config.sendMode === 'bulk'
                          ? 'border-amber-500 bg-amber-950/30 text-white'
                          : 'border-slate-800 hover:border-slate-700 bg-slate-950/50 text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-semibold flex items-center gap-1 text-amber-400">
                        <Users className="w-3.5 h-3.5" />
                        <span>Bulk Send (Batch)</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Dispatch to entire upstream list
                      </div>
                    </button>
                  </div>

                  {config.sendMode === 'bulk' ? (
                    <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Delay between emails:</span>
                        <select
                          value={config.rateLimitDelayMs || 150}
                          onChange={(e) => handleConfigChange('rateLimitDelayMs', parseInt(e.target.value))}
                          className="bg-slate-950 text-slate-300 px-2 py-1 rounded border border-slate-700 font-mono text-[11px]"
                        >
                          <option value={100}>100 ms (Fast)</option>
                          <option value={200}>200 ms (Recommended)</option>
                          <option value={500}>500 ms (Safe)</option>
                          <option value={1000}>1.0 s (Paced)</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-800">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Recipient (To)
                      </label>
                      <input
                        type="text"
                        value={config.to || ''}
                        onChange={(e) => handleConfigChange('to', e.target.value)}
                        className="w-full bg-slate-950 text-xs px-3 py-2 rounded-lg border border-slate-700 font-mono text-red-200"
                        placeholder="recipient@example.com or {{input.email}}"
                      />
                    </div>
                  )}
                </div>

                {/* 3. EMAIL CONTENT */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
                  <input
                    type="text"
                    value={config.subject || ''}
                    onChange={(e) => handleConfigChange('subject', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-red-500 focus:outline-none"
                    placeholder="Quick question for {{item.name}} at {{item.company}}"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">Email Body</label>
                    <span className="text-[10px] text-red-400 font-mono">
                      {config.sendMode === 'bulk' ? 'Supports {{personalizedText}}' : 'Supports {{variables}}'}
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={config.body || ''}
                    onChange={(e) => handleConfigChange('body', e.target.value)}
                    className="w-full bg-slate-900 text-xs p-2.5 rounded-lg border border-slate-700 focus:border-red-500 focus:outline-none font-sans text-slate-200 leading-relaxed"
                    placeholder="{{personalizedText}}"
                  />
                </div>
              </div>
            )}

            {/* INPUT FORM CONFIGURATION */}
            {nodeType === 'input_form_trigger' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Form Title</label>
                  <input
                    type="text"
                    value={config.formTitle || ''}
                    onChange={(e) => handleConfigChange('formTitle', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-[#ff6d5a] focus:outline-none"
                    placeholder="E.g. Inbound Support Ticket"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300">Live Test Form Fields</label>
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
                    {config.fields?.map((field: FormFieldDefinition) => (
                      <div key={field.id} className="space-y-1">
                        <label className="text-[11px] text-slate-400 font-medium">
                          {field.label} {field.required && <span className="text-rose-400">*</span>}
                        </label>
                        <input
                          type={field.type === 'textarea' ? 'text' : field.type}
                          value={config.submittedValues?.[field.name] || ''}
                          onChange={(e) => {
                            const updatedValues = {
                              ...config.submittedValues,
                              [field.name]: e.target.value,
                            };
                            handleConfigChange('submittedValues', updatedValues);
                          }}
                          className="w-full bg-slate-950 text-xs px-2.5 py-1.5 rounded border border-slate-800 focus:border-[#ff6d5a] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FILE UPLOAD TRIGGER */}
            {nodeType === 'file_upload_trigger' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Sample File Content
                  </label>
                  <textarea
                    rows={8}
                    value={config.sampleFileContent || ''}
                    onChange={(e) => handleConfigChange('sampleFileContent', e.target.value)}
                    className="w-full bg-slate-950 text-[11px] p-3 rounded-lg border border-slate-800 font-mono text-emerald-300 leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* CODE TRANSFORM */}
            {nodeType === 'code_transform' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    JavaScript Transform Function
                  </label>
                  <textarea
                    rows={8}
                    value={config.code || ''}
                    onChange={(e) => handleConfigChange('code', e.target.value)}
                    className="w-full bg-slate-950 text-xs p-3 rounded-lg border border-slate-800 focus:border-sky-500 focus:outline-none font-mono text-sky-300"
                    placeholder="return { ...input, timestamp: Date.now() };"
                  />
                </div>
              </div>
            )}

            {/* CONDITION FILTER */}
            {nodeType === 'condition_filter' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Field Path</label>
                  <input
                    type="text"
                    value={config.field || ''}
                    onChange={(e) => handleConfigChange('field', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 font-mono"
                    placeholder="node_openai.output.classification"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Expected Value</label>
                  <input
                    type="text"
                    value={config.value || ''}
                    onChange={(e) => handleConfigChange('value', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700"
                    placeholder="High Priority"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* DATA & OUTPUT TAB */}
        {activeTab === 'data' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Execution Output JSON</span>
              {testResult && (
                <button
                  onClick={() => handleCopyJson(testResult)}
                  className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
              )}
            </div>

            {testResult ? (
              <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[460px] leading-relaxed">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            ) : (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2 text-slate-500">
                <Layers className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">No output recorded yet.</p>
                <p className="text-[11px] text-slate-600">
                  Click &apos;Test This Step&apos; below to execute this node individually.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Action Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <button
          onClick={handleTestNode}
          disabled={isTesting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors border border-slate-700 disabled:opacity-50"
        >
          {isTesting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 text-emerald-400" />
          )}
          {isTesting ? 'Testing Step...' : 'Test This Step'}
        </button>

        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-[#ff6d5a] hover:bg-[#ea580c] text-white text-xs font-semibold shadow-md transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
