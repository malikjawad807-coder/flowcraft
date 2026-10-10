'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Password reset token is missing from the link. Please request a new one.');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password. The link may have expired.');
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
          <h1 className="text-2xl font-bold tracking-tight text-text">Choose a new password</h1>
          <p className="text-sm text-muted">
            Set a strong password for your account.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="space-y-6 text-center pt-2">
            <div className="w-16 h-16 rounded-full bg-red-soft border border-red/30 flex items-center justify-center mx-auto text-red">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-text">Password updated!</h2>
              <p className="text-sm text-muted">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
            </div>

            <Link
              href="/login"
              className="w-full py-2.5 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-sm rounded-btn transition-colors inline-flex items-center justify-center gap-2"
            >
              Sign in now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted">New password (min 10 chars)</label>
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

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted">Confirm new password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-sm rounded-btn transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red/20"
            >
              {loading ? 'Updating password...' : 'Update password'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-bg">
          <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

