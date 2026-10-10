'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-card p-8 shadow-2xl space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red" />
            <span className="text-xs font-semibold tracking-wider text-muted uppercase">
              FlowCart Studio
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Reset password</h1>
          <p className="text-sm text-muted">
            Enter your email and we will send you a secure link to reset your password.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-4 pt-2 text-center">
            <div className="w-12 h-12 rounded-full bg-red-soft border border-red/30 flex items-center justify-center mx-auto text-red">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-text">Check your inbox</h2>
              <p className="text-xs text-muted">
                If an account exists for <span className="text-text font-medium">{email}</span>, a password reset link has been dispatched.
              </p>
            </div>
            <div className="pt-4">
              <Link
                href="/login"
                className="w-full py-2.5 px-4 bg-surface-2 hover:bg-border/60 text-text font-medium text-sm rounded-btn transition-colors border border-border inline-flex items-center justify-center gap-2"
              >
                Return to sign in <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-sm rounded-btn transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red/20"
            >
              {loading ? 'Sending link...' : 'Send reset link'}
            </button>

            <div className="text-center pt-2 border-t border-border">
              <Link
                href="/login"
                className="text-xs text-muted hover:text-text transition-colors inline-flex items-center gap-1.5"
              >
                Back to sign in <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
