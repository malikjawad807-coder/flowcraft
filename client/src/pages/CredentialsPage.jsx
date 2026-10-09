import React, { useState, useEffect } from 'react';
import { Key, Plus, ShieldCheck, Mail, Server } from 'lucide-react';

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/credentials');
      const data = await res.json();
      setCredentials(data.credentials || []);
    } catch (err) {
      console.error('Error fetching credentials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#2A2A2A]">
        <div>
          <h1 className="text-xl font-bold tracking-wider uppercase text-white font-mono flex items-center gap-2">
            <Key className="w-5 h-5 text-[#E10600]" />
            Credentials
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            SMTP connection vaults. Encrypted at rest with AES-256-GCM.
          </p>
        </div>

        <button className="bg-[#E10600] hover:bg-[#FF1A1A] text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          <span>Add SMTP Credential</span>
        </button>
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] p-12 text-center">
        <Server className="w-10 h-10 text-[#888888] mx-auto mb-3" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-1">
          {credentials.length} SMTP Vaults Configured
        </h3>
        <p className="text-xs text-[#888888] max-w-md mx-auto">
          Full SMTP configuration modal (Host, Port, User, AES-256-GCM Password, From Name, From Email, and Test Connection button) will be active in Step 2.
        </p>
      </div>
    </div>
  );
}
