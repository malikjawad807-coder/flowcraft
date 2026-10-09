import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('admin@flowcart.local');
  const [password, setPassword] = useState('admin12345');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141414] border border-[#2A2A2A] rounded-none p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-[#E10600]" />
            <h1 className="text-xl font-bold tracking-wider uppercase text-white">FlowCart</h1>
          </div>
          <p className="text-xs text-[#888888]">
            Email Automation Engine • Admin Console
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-[#0A0A0A] border border-[#E10600] text-[#E10600] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#888888] mb-2 font-mono">
              Admin Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] text-sm text-white px-3 py-2.5 outline-none font-mono transition-colors"
                placeholder="admin@flowcart.local"
              />
              <Mail className="w-4 h-4 text-[#888888] absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#888888] mb-2 font-mono">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#0A0A0A] border border-[#2A2A2A] focus:border-[#E10600] text-sm text-white px-3 py-2.5 outline-none font-mono transition-colors"
                placeholder="••••••••"
              />
              <Lock className="w-4 h-4 text-[#888888] absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E10600] hover:bg-[#FF1A1A] text-white py-2.5 px-4 font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to FlowCart</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#2A2A2A] text-center">
          <p className="text-[11px] text-[#888888] font-mono">
            Default credentials: admin@flowcart.local / admin12345
          </p>
        </div>
      </div>
    </div>
  );
}
