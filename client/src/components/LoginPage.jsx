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
    <div className="min-h-screen w-full bg-[#101114] flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-md bg-[#16171b] border border-[#22242a] rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-8 h-8 text-[#ff6d5a]" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="3" fill="#ff6d5a" />
              <circle cx="12" cy="7" r="3" fill="#ea4b71" />
              <circle cx="19" cy="12" r="3" fill="#ff6d5a" />
              <circle cx="12" cy="17" r="3" fill="#ea4b71" />
              <path d="M7.5 10.5L9.5 8.5M14.5 8.5L16.5 10.5M16.5 13.5L14.5 15.5M9.5 15.5L7.5 13.5" stroke="#ff6d5a" strokeWidth="1.5" />
            </svg>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">n8n</h1>
          </div>
          <p className="text-xs text-[#8c90a0]">
            Sign in to your workflow automation studio
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-[#2a1717] border border-[#EF4444] text-[#ff8080] text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#8c90a0] mb-1.5">
              Email
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#101114] border border-[#26282e] focus:border-[#ff6d5a] text-sm text-white px-3.5 py-2.5 rounded-lg outline-none transition-colors"
                placeholder="admin@flowcart.local"
              />
              <Mail className="w-4 h-4 text-[#727582] absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8c90a0] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#101114] border border-[#26282e] focus:border-[#ff6d5a] text-sm text-white px-3.5 py-2.5 rounded-lg outline-none transition-colors"
                placeholder="••••••••"
              />
              <Lock className="w-4 h-4 text-[#727582] absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff6d5a] hover:bg-[#ea4b71] text-white py-2.5 px-4 font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-2 shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#22242a] text-center">
          <p className="text-[11px] text-[#727582]">
            Default admin: admin@flowcart.local / admin12345
          </p>
        </div>
      </div>
    </div>
  );
}
