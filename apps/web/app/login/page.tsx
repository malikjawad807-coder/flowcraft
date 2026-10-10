'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, Shield, KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';
import { getFriendlyErrorMessage } from '@flowcart/shared/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const { login, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // MFA 2nd-step state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  // If already logged in, redirect
  if (user) {
    router.replace(redirectPath);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setResendStatus(null);
    setSubmitting(true);

    try {
      await login({
        email: email.trim(),
        password,
        totp: mfaRequired && !isRecoveryMode ? totpCode.trim() : undefined,
        recoveryCode: mfaRequired && isRecoveryMode ? totpCode.trim() : undefined,
      });
      router.push(redirectPath);
    } catch (err: any) {
      if (err?.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setError(null);
        setErrorCode(null);
        setTotpCode('');
      } else {
        const friendly = getFriendlyErrorMessage(err?.code, err?.message);
        setError(friendly);
        setErrorCode(err?.code || 'INVALID_CREDENTIALS');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) return;
    setResending(true);
    setResendStatus(null);
    try {
      await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setResendStatus('Verification email resent. Please check your inbox.');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-card p-8 shadow-2xl space-y-6">
        {/* Brand header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red" />
            <span className="text-xs font-semibold tracking-wider text-muted uppercase">
              FlowCart Studio
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            {mfaRequired ? 'Two-Factor Authentication' : 'Sign in'}
          </h1>
          <p className="text-sm text-muted">
            {mfaRequired
              ? isRecoveryMode
                ? 'Enter an emergency 10-character recovery code.'
                : 'Enter the 6-digit code from your authenticator app.'
              : 'Enter your credentials to access your automation workspace.'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <span>{error}</span>
              {errorCode === 'EMAIL_NOT_VERIFIED' && (
                <div>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="text-xs text-text underline hover:text-red transition-colors font-medium disabled:opacity-50"
                  >
                    {resending ? 'Resending...' : 'Click here to resend verification email'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {resendStatus && (
          <div className="p-3 bg-surface-2 border border-border rounded-input text-xs text-text flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-red flex-shrink-0" />
            <span>{resendStatus}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!mfaRequired ? (
            <>
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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-muted">Password</label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted hover:text-red transition-colors underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
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
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-2.5 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-sm rounded-btn transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red/20"
              >
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
            </>
          ) : (
            <>
              {/* Step 2: MFA Verification Code */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted">
                  {isRecoveryMode ? 'Emergency Recovery Code' : 'Authentication Code'}
                </label>
                <div className="relative">
                  {isRecoveryMode ? (
                    <KeyRound className="w-4 h-4 text-muted absolute left-3 top-3" />
                  ) : (
                    <Shield className="w-4 h-4 text-muted absolute left-3 top-3" />
                  )}
                  <input
                    type="text"
                    required
                    autoFocus
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder={isRecoveryMode ? 'xxxxx-xxxxx' : '000000'}
                    className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text font-mono tracking-widest placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecoveryMode(!isRecoveryMode);
                    setTotpCode('');
                    setError(null);
                  }}
                  className="text-muted hover:text-red transition-colors underline-offset-2 hover:underline"
                >
                  {isRecoveryMode ? 'Use authenticator app' : 'Use a recovery code'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMfaRequired(false);
                    setTotpCode('');
                    setError(null);
                  }}
                  className="text-muted hover:text-text transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-2.5 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-sm rounded-btn transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red/20"
              >
                {submitting ? 'Verifying...' : 'Verify and sign in'}
              </button>
            </>
          )}
        </form>

        <div className="text-center text-xs text-muted pt-2 border-t border-border">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-text hover:text-red transition-colors font-medium underline underline-offset-4">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-bg">
          <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
