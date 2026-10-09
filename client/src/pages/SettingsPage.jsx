import React, { useState, useEffect } from 'react';
import { Settings, Shield, Save, Key, AlertCircle, CheckCircle2, Download, Database, Cpu } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    daily_send_limit: '30',
    default_wait_seconds: '45',
    unsubscribe_text: 'If you wish to unsubscribe, click here: {{unsubscribe_url}}',
    llm_provider: 'openai',
    llm_api_key: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const [pwStatus, setPwStatus] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaveStatus({ type: 'loading', msg: 'Saving settings...' });
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSaveStatus({ type: 'success', msg: 'Settings saved successfully' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus({ type: 'error', msg: err.message });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwStatus({ type: 'loading', msg: 'Updating password...' });
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setPwStatus({ type: 'success', msg: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPwStatus(null), 3000);
    } catch (err) {
      setPwStatus({ type: 'error', msg: err.message });
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = '/api/settings/backup';
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="pb-6 border-b border-[#2A2A2A]">
        <h1 className="text-xl font-bold tracking-wider uppercase text-white font-mono flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#E10600]" />
          System Settings
        </h1>
        <p className="text-xs text-[#888888] mt-1 font-mono">
          Email safety limits, delivery pacing, unsubscribe compliance, AI models, and database backups.
        </p>
      </div>

      {/* Safety & Delivery Settings */}
      <div className="bg-[#141414] border border-[#2A2A2A] p-6 font-mono text-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#E10600]" />
          Email Safety & Delivery Limits
        </h2>

        {saveStatus && (
          <div className={`mb-4 p-3 text-xs flex items-center gap-2 border ${
            saveStatus.type === 'error'
              ? 'border-[#E10600] text-[#FF4D4D] bg-[#1C0000]'
              : 'border-[#10B981] text-[#34D399] bg-[#001A09]'
          }`}>
            {saveStatus.type === 'error' ? <AlertCircle className="w-4 h-4 text-[#E10600]" /> : <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
            <span>{saveStatus.msg}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#888888] mb-2 font-mono">
                Daily Send Limit
              </label>
              <input
                type="number"
                value={settings.daily_send_limit || '30'}
                onChange={(e) => setSettings({ ...settings, daily_send_limit: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] text-sm text-white px-3 py-2 outline-none font-mono"
              />
              <p className="text-[11px] text-[#888888] mt-1 font-mono">
                Workflows automatically halt when limit is reached. Default: 30.
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-[#888888] mb-2 font-mono">
                Default Wait Seconds
              </label>
              <input
                type="number"
                value={settings.default_wait_seconds || '45'}
                onChange={(e) => setSettings({ ...settings, default_wait_seconds: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] text-sm text-white px-3 py-2 outline-none font-mono"
              />
              <p className="text-[11px] text-[#888888] mt-1 font-mono">
                Pacing delay between outbound SMTP sends. Default: 45s.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#888888] mb-2 font-mono">
              Unsubscribe Footer Text
            </label>
            <textarea
              rows={2}
              value={settings.unsubscribe_text || ''}
              onChange={(e) => setSettings({ ...settings, unsubscribe_text: e.target.value })}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] text-xs text-white p-3 outline-none font-mono"
            />
            <p className="text-[11px] text-[#888888] mt-1 font-mono">
              Appended to all emails automatically. Supports {`{{unsubscribe_url}}`}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#2A2A2A]">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#888888] mb-2 font-mono">
                LLM Provider
              </label>
              <select
                value={settings.llm_provider || 'openai'}
                onChange={(e) => setSettings({ ...settings, llm_provider: e.target.value })}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] text-sm text-white px-3 py-2 outline-none font-mono"
              >
                <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                <option value="openrouter">OpenRouter (Multi-model)</option>
                <option value="groq">Groq (Llama-3, fast)</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-[#888888] mb-2 font-mono">
                LLM API Key
              </label>
              <input
                type="password"
                value={settings.llm_api_key || ''}
                onChange={(e) => setSettings({ ...settings, llm_api_key: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] text-sm text-white px-3 py-2 outline-none font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors font-mono"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Delivery Settings</span>
          </button>
        </form>
      </div>

      {/* Database Backup Section */}
      <div className="bg-[#141414] border border-[#2A2A2A] p-6 font-mono text-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white mb-2 flex items-center gap-2">
          <Database className="w-4 h-4 text-[#E10600]" />
          SQLite Database Snapshot
        </h2>
        <p className="text-[11px] text-[#888888] mb-4">
          Download a standalone binary backup copy of your <code>/data/flowcart.db</code> database, containing all workflows, leads, encrypted credentials, executions, and agent memories.
        </p>

        <button
          type="button"
          onClick={handleDownloadBackup}
          className="bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#E10600] text-white px-4 py-2 text-xs uppercase font-semibold tracking-wider flex items-center gap-2 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-[#E10600]" />
          <span>Download flowcart.db Snapshot</span>
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-[#141414] border border-[#2A2A2A] p-6 font-mono text-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
          <Key className="w-4 h-4 text-[#E10600]" />
          Administrator Password
        </h2>

        {pwStatus && (
          <div className={`mb-4 p-3 text-xs flex items-center gap-2 border ${
            pwStatus.type === 'error'
              ? 'border-[#E10600] text-[#FF4D4D] bg-[#1C0000]'
              : 'border-[#10B981] text-[#34D399] bg-[#001A09]'
          }`}>
            {pwStatus.type === 'error' ? <AlertCircle className="w-4 h-4 text-[#E10600]" /> : <CheckCircle2 className="w-4 h-4 text-[#10B981]" />}
            <span>{pwStatus.msg}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#888888] mb-2 font-mono">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] text-sm text-white px-3 py-2 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#888888] mb-2 font-mono">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] text-sm text-white px-3 py-2 outline-none font-mono"
            />
          </div>

          <button
            type="submit"
            className="bg-[#141414] border border-[#2A2A2A] hover:border-[#E10600] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-[#E10600]" />
            <span>Update Password</span>
          </button>
        </form>
      </div>
    </div>
  );
}
