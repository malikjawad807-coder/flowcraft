'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PasswordStrengthMeter, calculatePasswordStrength } from '@/components/auth/PasswordStrengthMeter';
import { apiFetch } from '@/lib/api-fetch';

export default function SignupPage() {
  const router = useRouter();
  const { signup, user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // If already logged in, redirect
  if (user) {
    router.replace('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      await signup({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
      });
      setRegisteredEmail(email.trim());
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!registeredEmail) return;
    setResending(true);
    setResendStatus(null);
    try {
      await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: registeredEmail }),
      });
      setResendStatus('Verification link resent. Please check your inbox.');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  if (registeredEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="w-full max-w-md bg-surface border border-border rounded-card p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-soft border border-red/30 flex items-center justify-center mx-auto text-red">
            <Mail className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-text">Verify your email</h1>
            <p className="text-sm text-muted">
              We sent a verification link to{' '}
              <span className="font-semibold text-text">{registeredEmail}</span>.
              Please check your inbox and confirm your address to activate your account.
            </p>
          </div>

          {resendStatus && (
            <div className="p-3 bg-surface-2 border border-border rounded-input text-xs text-text flex items-center gap-2 text-left">
              <CheckCircle2 className="w-4 h-4 text-red flex-shrink-0" />
              <span>{resendStatus}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 space-y-3">
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full py-2.5 px-4 bg-surface-2 hover:bg-border/60 text-text font-medium text-sm rounded-btn transition-colors border border-border disabled:opacity-50"
            >
              {resending ? 'Resending...' : 'Resend verification link'}
            </button>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs text-muted hover:text-text transition-colors"
            >
              Back to sign in <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-card p-8 shadow-2xl space-y-6">
        {/* Brand header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red animate-pulse-subtle" />
            <span className="text-xs font-semibold tracking-wider text-muted uppercase">
              FlowCart Studio
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Create account</h1>
          <p className="text-sm text-muted">
            Start automating intelligent email workflows in seconds.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted">Name (optional)</label>
            <div className="relative">
              <User className="w-4 h-4 text-muted absolute left-3 top-3" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted">Work email</label>
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

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted">Password (min 10 characters)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-10 py-2 bg-surface-2 border border-border rounded-input text-sm text-text placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted hover:text-text transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={password} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-2.5 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-sm rounded-btn transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red/20"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="text-center text-xs text-muted pt-2 border-t border-border">
          Already have an account?{' '}
          <Link href="/login" className="text-text hover:text-red transition-colors font-medium underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
