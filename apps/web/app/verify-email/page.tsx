'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Mail } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(Boolean(token));
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    let mounted = true;
    (async () => {
      try {
        await apiFetch('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        if (mounted) {
          setSuccess(true);
          setError(null);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Verification token is invalid or has expired.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResending(true);
    setResendSuccess(false);
    try {
      await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      setResendSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to resend verification link.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-card p-8 shadow-2xl space-y-6 text-center">
        {loading && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-10 h-10 text-red animate-spin mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-text">Verifying your email...</h2>
              <p className="text-xs text-muted">Please wait while we validate your token.</p>
            </div>
          </div>
        )}

        {!loading && success && (
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-soft border border-red/30 flex items-center justify-center mx-auto text-red">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-text">Email verified!</h1>
              <p className="text-sm text-muted">
                Your account is active. You can now sign in to your FlowCart workspace.
              </p>
            </div>

            <Link
              href="/login"
              className="w-full py-2.5 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-sm rounded-btn transition-colors inline-flex items-center justify-center gap-2"
            >
              Sign in to FlowCart <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {!loading && !success && (
          <div className="space-y-6">
            <div className="w-16 h-16 rounded-full bg-surface-2 border border-border flex items-center justify-center mx-auto text-red">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-text">Verification failed</h1>
              <p className="text-sm text-muted">
                {error || 'This link may have expired or was already used.'}
              </p>
            </div>

            {resendSuccess ? (
              <div className="p-3 bg-surface-2 border border-border rounded-input text-xs text-text flex items-center gap-2 text-left">
                <CheckCircle2 className="w-4 h-4 text-red flex-shrink-0" />
                <span>Verification link sent! Check your inbox.</span>
              </div>
            ) : (
              <form onSubmit={handleResend} className="space-y-3 text-left">
                <label className="block text-xs font-medium text-muted">
                  Request a new verification link:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resending}
                  className="w-full py-2 px-3 bg-surface-2 hover:bg-border/60 text-text font-medium text-xs rounded-btn transition-colors border border-border disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Send fresh verification link'}
                </button>
              </form>
            )}

            <div className="pt-2 border-t border-border">
              <Link
                href="/login"
                className="text-xs text-muted hover:text-text transition-colors inline-flex items-center gap-1.5"
              >
                Back to sign in <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-bg">
          <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

