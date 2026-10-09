import React, { useState, useEffect } from 'react';
import { 
  Key, Plus, ShieldCheck, Mail, Server, Trash2, Edit2, 
  CheckCircle2, AlertCircle, RefreshCw, Send, Lock, Eye, EyeOff, X, Zap
} from 'lucide-react';

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCred, setEditingCred] = useState(null);
  
  // Test connection state
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState({});

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/credentials');
      if (!res.ok) throw new Error('Failed to fetch credentials');
      const data = await res.json();
      setCredentials(data.credentials || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading credentials', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this SMTP credential?')) return;
    try {
      const res = await fetch(`/api/credentials/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete credential');
      showToast('Credential removed');
      fetchCredentials();
    } catch (err) {
      showToast('Failed to delete credential', 'error');
    }
  };

  const handleTestExisting = async (id) => {
    try {
      setTestingId(id);
      setTestResult((prev) => ({ ...prev, [id]: { testing: true } }));
      
      const res = await fetch('/api/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();

      if (data.success) {
        setTestResult((prev) => ({
          ...prev,
          [id]: { testing: false, success: true, message: data.message },
        }));
        showToast('SMTP Handshake Successful!');
      } else {
        setTestResult((prev) => ({
          ...prev,
          [id]: { testing: false, success: false, error: data.error },
        }));
        showToast(data.error || 'SMTP test failed', 'error');
      }
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        [id]: { testing: false, success: false, error: err.message },
      }));
      showToast('Connection test error', 'error');
    } finally {
      setTestingId(null);
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
            <Key className="w-5 h-5 text-[#E10600]" />
            SMTP Credentials Vault
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Store and verify outbound mail servers. All secrets are encrypted at rest with AES-256-GCM.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCred(null);
            setShowAddModal(true);
          }}
          className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors font-mono self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add SMTP Credential</span>
        </button>
      </div>

      {/* Security Banner */}
      <div className="bg-[#141414] border border-[#2A2A2A] p-4 flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0A0A0A] border border-[#2A2A2A] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-[#E10600]" />
          </div>
          <div>
            <div className="text-white font-semibold flex items-center gap-2">
              <span>AES-256-GCM Zero-Leak Storage</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-[#E10600]/10 border border-[#E10600]/30 text-[#E10600]">ACTIVE</span>
            </div>
            <div className="text-[#888888] text-[11px]">
              Passwords never leave the server unencrypted. Connection tests execute live SMTP handshakes securely.
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-[#777777] text-[11px]">
          <span>{credentials.length} vaults configured</span>
        </div>
      </div>

      {/* Credentials List */}
      {loading ? (
        <div className="p-16 text-center text-xs font-mono text-[#888888] flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-[#E10600] border-t-transparent animate-spin rounded-full" />
          <span>Loading SMTP credentials...</span>
        </div>
      ) : credentials.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2A] p-16 text-center">
          <Server className="w-10 h-10 text-[#444444] mx-auto mb-3" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-1 font-mono">
            No SMTP Credentials Configured
          </h3>
          <p className="text-xs text-[#888888] max-w-sm mx-auto mb-6 font-mono">
            Add your Gmail, SendGrid, Mailgun, Amazon SES, or custom SMTP server to start dispatching automated campaigns.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-4 py-2 text-xs font-mono uppercase tracking-wider font-semibold transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Configure First SMTP Vault</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {credentials.map((cred) => {
            const result = testResult[cred.id];
            const isTesting = testingId === cred.id;

            return (
              <div
                key={cred.id}
                className="bg-[#141414] border border-[#2A2A2A] hover:border-[#383838] transition-all p-5 font-mono flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-[#2A2A2A]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-[#0A0A0A] border border-[#2A2A2A] flex items-center justify-center">
                        <Mail className="w-4 h-4 text-[#E10600]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                          {cred.name}
                        </h3>
                        <div className="text-[11px] text-[#888888] flex items-center gap-1.5 mt-0.5">
                          <span>{cred.from_name ? `"${cred.from_name}" ` : ''}&lt;{cred.from_email}&gt;</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingCred(cred);
                          setShowAddModal(true);
                        }}
                        className="p-1.5 text-[#888888] hover:text-white hover:bg-[#2A2A2A]"
                        title="Edit SMTP settings"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cred.id)}
                        className="p-1.5 text-[#888888] hover:text-[#E10600] hover:bg-[#2A2A2A]"
                        title="Delete credential"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Connection Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-3 text-[#AAAAAA]">
                    <div className="bg-[#0A0A0A] p-2 border border-[#222222]">
                      <div className="text-[10px] text-[#666666] uppercase">SMTP Host</div>
                      <div className="text-white truncate font-semibold mt-0.5">{cred.host}</div>
                    </div>

                    <div className="bg-[#0A0A0A] p-2 border border-[#222222]">
                      <div className="text-[10px] text-[#666666] uppercase">Port & Protocol</div>
                      <div className="text-white truncate font-semibold mt-0.5">
                        {cred.port} ({cred.secure ? 'SSL/TLS' : 'STARTTLS'})
                      </div>
                    </div>

                    <div className="bg-[#0A0A0A] p-2 border border-[#222222]">
                      <div className="text-[10px] text-[#666666] uppercase">Username</div>
                      <div className="text-white truncate mt-0.5">{cred.user}</div>
                    </div>

                    <div className="bg-[#0A0A0A] p-2 border border-[#222222]">
                      <div className="text-[10px] text-[#666666] uppercase">Password</div>
                      <div className="text-[#888888] truncate mt-0.5 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-[#E10600]" />
                        <span>••••••••••••</span>
                      </div>
                    </div>
                  </div>

                  {/* Inline Test Feedback if available */}
                  {result && (
                    <div className={`mt-2 p-2.5 text-[11px] border flex items-start gap-2 ${
                      result.success 
                        ? 'bg-[#001A09] border-[#10B981] text-[#34D399]'
                        : 'bg-[#1C0000] border-[#E10600] text-[#FF4D4D]'
                    }`}>
                      {result.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#10B981]" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#E10600]" />
                      )}
                      <div className="leading-tight">{result.message || result.error}</div>
                    </div>
                  )}
                </div>

                {/* Card Action */}
                <div className="pt-2 border-t border-[#2A2A2A] flex items-center justify-between text-xs">
                  <span className="text-[10px] text-[#666666]">
                    Added: {new Date(cred.created_at).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => handleTestExisting(cred.id)}
                    disabled={isTesting}
                    className="bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#E10600] text-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                  >
                    {isTesting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-[#E10600] border-t-transparent animate-spin rounded-full" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3 text-[#E10600]" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Credential Modal */}
      {showAddModal && (
        <CredentialFormModal
          credential={editingCred}
          onClose={() => {
            setShowAddModal(false);
            setEditingCred(null);
          }}
          onSaved={() => {
            setShowAddModal(false);
            setEditingCred(null);
            fetchCredentials();
            showToast(editingCred ? 'SMTP Credential updated' : 'SMTP Credential saved');
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Subcomponent: SMTP Credential Add/Edit Modal
// -------------------------------------------------------------
function CredentialFormModal({ credential, onClose, onSaved }) {
  const [formData, setFormData] = useState({
    name: credential?.name || '',
    host: credential?.host || '',
    port: credential?.port || 587,
    secure: credential ? (credential.secure === 1 || credential.secure === true) : false,
    user: credential?.user || '',
    password: '',
    from_name: credential?.from_name || '',
    from_email: credential?.from_email || '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Quick preset loader
  const applyPreset = (preset) => {
    switch (preset) {
      case 'gmail':
        setFormData((prev) => ({
          ...prev,
          name: prev.name || 'Gmail SMTP',
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
        }));
        break;
      case 'sendgrid':
        setFormData((prev) => ({
          ...prev,
          name: prev.name || 'SendGrid SMTP',
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          user: 'apikey',
        }));
        break;
      case 'mailgun':
        setFormData((prev) => ({
          ...prev,
          name: prev.name || 'Mailgun SMTP',
          host: 'smtp.mailgun.org',
          port: 587,
          secure: false,
        }));
        break;
      case 'outlook':
        setFormData((prev) => ({
          ...prev,
          name: prev.name || 'Office365 / Outlook',
          host: 'smtp.office365.com',
          port: 587,
          secure: false,
        }));
        break;
      default:
        break;
    }
  };

  const handleTestConnection = async () => {
    // If editing and password hasn't changed, pass ID to test
    if (!formData.host || !formData.user || (!formData.password && !credential)) {
      setTestStatus({
        success: false,
        message: 'Host, username, and password are required to test connection',
      });
      return;
    }

    try {
      setTesting(true);
      setTestStatus(null);

      const payload = credential && !formData.password
        ? { id: credential.id }
        : {
            host: formData.host,
            port: Number(formData.port),
            secure: formData.secure ? 1 : 0,
            user: formData.user,
            password: formData.password,
          };

      const res = await fetch('/api/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setTestStatus({ success: true, message: data.message });
      } else {
        setTestStatus({ success: false, message: data.error });
      }
    } catch (err) {
      setTestStatus({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.host || !formData.user || !formData.from_email) {
      setError('Name, host, user, and from email are required');
      return;
    }

    if (!credential && !formData.password) {
      setError('Password is required for new SMTP credential');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const url = credential ? `/api/credentials/${credential.id}` : '/api/credentials';
      const method = credential ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          port: Number(formData.port),
          secure: formData.secure ? 1 : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save credential');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-[#2A2A2A] w-full max-w-xl p-6 relative max-h-[90vh] overflow-y-auto font-mono text-xs">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#2A2A2A]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-[#E10600]" />
            <span>{credential ? 'Edit SMTP Credential' : 'Add SMTP Credential'}</span>
          </h2>
          <button onClick={onClose} className="text-[#888888] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick presets */}
        <div className="mb-4">
          <label className="block text-[#888888] uppercase mb-1 text-[10px]">
            Quick Presets
          </label>
          <div className="flex items-center gap-2">
            {['gmail', 'sendgrid', 'mailgun', 'outlook'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 bg-[#0A0A0A] border border-[#2A2A2A] hover:border-[#E10600] text-white uppercase text-[10px] font-semibold tracking-wider transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#1C0000] border border-[#E10600] text-xs text-[#FF4D4D] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {testStatus && (
          <div className={`mb-4 p-3 border text-xs flex items-start gap-2 ${
            testStatus.success 
              ? 'bg-[#001A09] border-[#10B981] text-[#34D399]'
              : 'bg-[#1C0000] border-[#E10600] text-[#FF4D4D]'
          }`}>
            {testStatus.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#10B981]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E10600]" />
            )}
            <div className="leading-tight">{testStatus.message}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#888888] uppercase mb-1">
              Configuration Name <span className="text-[#E10600]">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Outreach Gmail Primary"
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[#888888] uppercase mb-1">
                SMTP Host <span className="text-[#E10600]">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#888888] uppercase mb-1">Port</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  setFormData({
                    ...formData,
                    port: p,
                    secure: p === 465,
                  });
                }}
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="secure-toggle"
              checked={formData.secure}
              onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
              className="accent-[#E10600]"
            />
            <label htmlFor="secure-toggle" className="text-white cursor-pointer">
              Use SSL/TLS directly (Port 465). Uncheck for Port 587 STARTTLS.
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#888888] uppercase mb-1">
                Username / Email <span className="text-[#E10600]">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.user}
                onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                placeholder="outreach@company.com"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#888888] uppercase mb-1">
                Password / App Password {credential ? '(Leave blank to keep)' : '*'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!credential}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={credential ? '•••••••••••• (Unchanged)' : 'Enter password'}
                  className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 pr-9 text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888888] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#888888] uppercase mb-1">Sender From Name</label>
              <input
                type="text"
                value={formData.from_name}
                onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                placeholder="e.g. Sarah from FlowCart"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[#888888] uppercase mb-1">
                Sender From Email <span className="text-[#E10600]">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.from_email}
                onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                placeholder="outreach@company.com"
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] px-3 py-2 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-[#0A0A0A] border border-[#2A2A2A] text-[11px] text-[#777777] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#E10600] shrink-0" />
              <span>Password will be stored using AES-256-GCM encryption.</span>
            </div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="bg-[#141414] border border-[#2A2A2A] hover:border-[#E10600] text-white px-3 py-1.5 uppercase text-[10px] tracking-wider font-semibold transition-colors flex items-center gap-1.5"
            >
              {testing ? (
                <>
                  <div className="w-3 h-3 border-2 border-[#E10600] border-t-transparent animate-spin rounded-full" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3 text-[#E10600]" />
                  <span>Test Handshake</span>
                </>
              )}
            </button>
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
              <span>{credential ? 'Update Vault' : 'Save Vault'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
