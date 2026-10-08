'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { WorkflowNodeData, FormFieldDefinition } from '@/types/workflow';

interface NodeConfigDrawerProps {
  node: WorkflowNodeData | null;
  upstreamNodes: WorkflowNodeData[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updatedData: Partial<WorkflowNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  apiKeys: { openaiApiKey?: string };
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

  // Local editable state
  const [label, setLabel] = useState('');
  const [config, setConfig] = useState<Record<string, any>>({});

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

  // Test Node Directly
  const handleTestNode = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      if (nodeType === 'openai_llm' || nodeType === 'openai_classifier') {
        const res = await fetch('/api/ai/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model || 'gpt-4o-mini',
            systemPrompt: config.systemPrompt,
            userPrompt: config.userPrompt,
            apiKey: apiKeys.openaiApiKey,
          }),
        });
        const data = await res.json();
        setTestResult(data);
        onUpdateNode(node.id, {
          status: 'success',
          lastRunOutput: data,
        });
      } else if (nodeType === 'gmail_send') {
        const res = await fetch('/api/email/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: config.to || 'alex.morgan@example.com',
            cc: config.cc,
            subject: config.subject,
            body: config.body,
          }),
        });
        const data = await res.json();
        setTestResult(data);
        onUpdateNode(node.id, {
          status: 'success',
          lastRunOutput: data,
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
    <div className="fixed inset-y-0 right-0 w-[480px] bg-[#12161f] border-l border-slate-800 shadow-2xl z-30 flex flex-col font-sans text-slate-200 animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#ff6d5a]/15 border border-[#ff6d5a]/30 flex items-center justify-center text-[#ff6d5a]">
            {nodeType.includes('trigger') ? (
              <FormInput className="w-4 h-4" />
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
              className="text-sm font-semibold bg-transparent text-white border-b border-transparent hover:border-slate-700 focus:border-[#ff6d5a] focus:outline-none px-0.5 py-0.5 w-64 transition-all"
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
          Parameters &amp; Settings
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
                    <Variable className="w-3.5 h-3.5 text-[#ff6d5a]" /> Available Input Variables
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {upstreamNodes.length} source node(s)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {upstreamNodes.map((u) => {
                    const tag = `${u.id}.output`;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          if (nodeType === 'openai_llm') insertVariable(tag, 'userPrompt');
                          if (nodeType === 'gmail_send') insertVariable(tag, 'body');
                        }}
                        className="text-[10px] font-mono px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-[#ff6d5a]/20 hover:text-[#ff6d5a] border border-slate-700/60 transition-colors flex items-center gap-1"
                        title={`Click to insert {{${tag}}}`}
                      >
                        <span>&#123;&#123;{u.label || u.id}&#125;&#125;</span>
                      </button>
                    );
                  })}
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

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Form Description
                  </label>
                  <textarea
                    rows={2}
                    value={config.formDescription || ''}
                    onChange={(e) => handleConfigChange('formDescription', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-[#ff6d5a] focus:outline-none font-sans"
                    placeholder="Instructions for the user"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">Live Test Form Fields</label>
                    <span className="text-[10px] text-slate-500 font-mono">Fill to trigger workflow</span>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
                    {config.fields?.map((field: FormFieldDefinition) => (
                      <div key={field.id} className="space-y-1">
                        <label className="text-[11px] text-slate-400 font-medium">
                          {field.label} {field.required && <span className="text-rose-400">*</span>}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea
                            rows={3}
                            value={config.submittedValues?.[field.name] || ''}
                            onChange={(e) => {
                              const updatedValues = {
                                ...config.submittedValues,
                                [field.name]: e.target.value,
                              };
                              handleConfigChange('submittedValues', updatedValues);
                            }}
                            className="w-full bg-slate-950 text-xs px-2.5 py-1.5 rounded border border-slate-800 focus:border-[#ff6d5a] focus:outline-none font-sans"
                          />
                        ) : field.type === 'select' ? (
                          <select
                            value={config.submittedValues?.[field.name] || field.defaultValue || ''}
                            onChange={(e) => {
                              const updatedValues = {
                                ...config.submittedValues,
                                [field.name]: e.target.value,
                              };
                              handleConfigChange('submittedValues', updatedValues);
                            }}
                            className="w-full bg-slate-950 text-xs px-2.5 py-1.5 rounded border border-slate-800 focus:border-[#ff6d5a] focus:outline-none"
                          >
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
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
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FILE UPLOAD CONFIGURATION */}
            {nodeType === 'file_upload_trigger' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Sample File Name
                  </label>
                  <input
                    type="text"
                    value={config.sampleFileName || ''}
                    onChange={(e) => handleConfigChange('sampleFileName', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-[#ff6d5a] focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    File Payload Content (JSON / Text)
                  </label>
                  <textarea
                    rows={8}
                    value={config.sampleFileContent || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleConfigChange('sampleFileContent', val);
                      try {
                        const parsed = JSON.parse(val);
                        handleConfigChange('parsedData', parsed);
                      } catch (e) {
                        // Keep text
                      }
                    }}
                    className="w-full bg-slate-950 text-[11px] p-3 rounded-lg border border-slate-800 focus:border-[#ff6d5a] focus:outline-none font-mono text-emerald-300 leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* OPENAI LLM CONFIGURATION */}
            {(nodeType === 'openai_llm' || nodeType === 'openai_classifier') && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Model</label>
                    <select
                      value={config.model || 'gpt-4o-mini'}
                      onChange={(e) => handleConfigChange('model', e.target.value)}
                      className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none font-mono text-purple-300"
                    >
                      <option value="gpt-4o">gpt-4o (Omni Reasoning)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (Fast &amp; Efficient)</option>
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
                    rows={3}
                    value={config.systemPrompt || ''}
                    onChange={(e) => handleConfigChange('systemPrompt', e.target.value)}
                    className="w-full bg-slate-900 text-xs p-2.5 rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none font-sans"
                    placeholder="You are an expert AI assistant..."
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
                    rows={6}
                    value={config.userPrompt || ''}
                    onChange={(e) => handleConfigChange('userPrompt', e.target.value)}
                    className="w-full bg-slate-900 text-xs p-2.5 rounded-lg border border-slate-700 focus:border-purple-500 focus:outline-none font-mono text-purple-200 leading-relaxed"
                    placeholder="Enter prompt with template tags like {{input.field}}..."
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-950/20 border border-purple-900/40 text-xs">
                  <div>
                    <span className="font-medium text-purple-300">Sandbox Simulation Mode</span>
                    <p className="text-[10px] text-slate-400">
                      Returns realistic responses if API key is not configured.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.mockFallback ?? true}
                    onChange={(e) => handleConfigChange('mockFallback', e.target.checked)}
                    className="accent-purple-500 w-4 h-4 rounded"
                  />
                </div>
              </div>
            )}

            {/* GMAIL API SEND CONFIGURATION */}
            {nodeType === 'gmail_send' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    To (Recipient)
                  </label>
                  <input
                    type="text"
                    value={config.to || ''}
                    onChange={(e) => handleConfigChange('to', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-red-500 focus:outline-none font-mono"
                    placeholder="recipient@example.com or {{input.email}}"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    CC (Optional)
                  </label>
                  <input
                    type="text"
                    value={config.cc || ''}
                    onChange={(e) => handleConfigChange('cc', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-red-500 focus:outline-none font-mono"
                    placeholder="team@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Subject</label>
                  <input
                    type="text"
                    value={config.subject || ''}
                    onChange={(e) => handleConfigChange('subject', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-red-500 focus:outline-none"
                    placeholder="Email subject line..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">Email Body</label>
                    <span className="text-[10px] text-red-400 font-mono">Supports &#123;&#123;variables&#125;&#125;</span>
                  </div>
                  <textarea
                    rows={7}
                    value={config.body || ''}
                    onChange={(e) => handleConfigChange('body', e.target.value)}
                    className="w-full bg-slate-900 text-xs p-2.5 rounded-lg border border-slate-700 focus:border-red-500 focus:outline-none font-sans text-slate-200 leading-relaxed"
                    placeholder="Hi {{name}}, your summary is {{openai_llm.output}}..."
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-red-950/20 border border-red-900/40 text-xs">
                  <div>
                    <span className="font-medium text-red-300">Save as Gmail Draft Only</span>
                    <p className="text-[10px] text-slate-400">
                      Creates draft without immediate dispatch.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.sendAsDraft ?? false}
                    onChange={(e) => handleConfigChange('sendAsDraft', e.target.checked)}
                    className="accent-red-500 w-4 h-4 rounded"
                  />
                </div>
              </div>
            )}

            {/* CODE TRANSFORM CONFIGURATION */}
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

            {/* CONDITION FILTER CONFIGURATION */}
            {nodeType === 'condition_filter' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Field Path</label>
                  <input
                    type="text"
                    value={config.field || ''}
                    onChange={(e) => handleConfigChange('field', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-amber-500 focus:outline-none font-mono"
                    placeholder="node_openai.output.classification"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Operator</label>
                  <select
                    value={config.operator || 'equals'}
                    onChange={(e) => handleConfigChange('operator', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="equals">Equals</option>
                    <option value="contains">Contains</option>
                    <option value="greater_than">Greater Than</option>
                    <option value="is_truthy">Is Truthy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Expected Value</label>
                  <input
                    type="text"
                    value={config.value || ''}
                    onChange={(e) => handleConfigChange('value', e.target.value)}
                    className="w-full bg-slate-900 text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-amber-500 focus:outline-none"
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
              <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[420px] leading-relaxed">
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
