'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  KeyRound,
  Laptop,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  LogOut,
  ChevronLeft,
  Clock,
  Globe,
  Copy,
  Check,
  QrCode,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api-fetch';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';

interface SessionItem {
  idHash: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout, refreshUser } = useAuth();

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // MFA state
  const [showMfaSetupModal, setShowMfaSetupModal] = useState(false);
  const [showMfaDisableModal, setShowMfaDisableModal] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaCodeInput, setMfaCodeInput] = useState('');
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState<string[] | null>(null);
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccessMsg, setMfaSuccessMsg] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);


  // Sessions state
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingHash, setRevokingHash] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      const data = await apiFetch<SessionItem[]>('/api/auth/sessions');
      setSessions(data || []);
      setSessionsError(null);
    } catch (err: any) {
      setSessionsError(err?.message || 'Failed to load active sessions.');
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSuccess(null);
    setPwdError(null);

    if (newPassword.length < 10) {
      setPwdError('New password must be at least 10 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }

    setPwdSubmitting(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current: currentPassword,
          new: newPassword,
        }),
      });
      setPwdSuccess('Password changed successfully. Other sessions have been revoked.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      loadSessions();
    } catch (err: any) {
      setPwdError(err?.message || 'Failed to change password. Please check your current password.');
    } finally {
      setPwdSubmitting(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setMfaError(null);
    setMfaLoading(true);
    setMfaCodeInput('');
    setMfaRecoveryCodes(null);
    try {
      const data = await apiFetch<{ secret: string; qrCode: string }>('/api/auth/mfa/setup', {
        method: 'POST',
      });
      setMfaSecret(data.secret);
      setMfaQrCode(data.qrCode);
      setShowMfaSetupModal(true);
    } catch (err: any) {
      setMfaError(err?.message || 'Failed to initialize MFA setup.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleConfirmMfaEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCodeInput.length < 6) return;
    setMfaError(null);
    setMfaLoading(true);
    try {
      const data = await apiFetch<{ recoveryCodes: string[] }>('/api/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ code: mfaCodeInput.trim() }),
      });
      setMfaRecoveryCodes(data.recoveryCodes);
      setMfaSuccessMsg('Two-factor authentication enabled successfully.');
      await refreshUser();
    } catch (err: any) {
      setMfaError(err?.message || 'Invalid authentication code. Please check and try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleConfirmMfaDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaDisablePassword) return;
    setMfaError(null);
    setMfaLoading(true);
    try {
      await apiFetch('/api/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: mfaDisablePassword }),
      });
      setShowMfaDisableModal(false);
      setMfaDisablePassword('');
      setMfaSuccessMsg('Two-factor authentication has been disabled.');
      await refreshUser();
    } catch (err: any) {
      setMfaError(err?.message || 'Incorrect password.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleRevokeSession = async (idHash: string) => {

    setRevokingHash(idHash);
    try {
      await apiFetch(`/api/auth/sessions/${idHash}`, {
        method: 'DELETE',
      });
      setSessions((prev) => prev.filter((s) => s.idHash !== idHash));
    } catch (err: any) {
      setSessionsError(err?.message || 'Failed to revoke session.');
    } finally {
      setRevokingHash(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm('Are you sure you want to sign out all other devices?')) return;
    setRevokingAll(true);
    try {
      await apiFetch('/api/auth/sessions/revoke-all', {
        method: 'POST',
      });
      loadSessions();
    } catch (err: any) {
      setSessionsError(err?.message || 'Failed to revoke other sessions.');
    } finally {
      setRevokingAll(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    setDeleting(true);

    try {
      await apiFetch('/api/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      setShowDeleteModal(false);
      await logout();
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete account. Incorrect password.');
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div className="space-y-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-text transition-colors mb-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Studio
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-red-soft border border-red/30 rounded-lg text-red">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-text">Security Settings</h1>
                <p className="text-xs text-muted">
                  Manage your credentials, active sessions, and access protection.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="py-2 px-3 bg-surface-2 hover:bg-border/60 text-muted hover:text-text text-xs font-medium rounded-btn transition-colors border border-border inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>

        {/* Section 1: Change Password */}
        <div className="bg-surface border border-border rounded-card p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-red" />
            <div>
              <h2 className="text-base font-semibold text-text">Change Password</h2>
              <p className="text-xs text-muted">
                Updating your password will revoke all other active sessions across devices.
              </p>
            </div>
          </div>

          {pwdSuccess && (
            <div className="p-3 bg-surface-2 border border-border rounded-input text-xs text-text flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-red flex-shrink-0" />
              <span>{pwdSuccess}</span>
            </div>
          )}

          {pwdError && (
            <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red flex-shrink-0" />
              <span>{pwdError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted">Current password</label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-muted">New password (min 10 chars)</label>
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="text-xs text-muted hover:text-text inline-flex items-center gap-1"
                >
                  {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPasswords ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
              />
              <PasswordStrengthMeter password={newPassword} />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted">Confirm new password</label>
              <input
                type={showPasswords ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={pwdSubmitting}
              className="py-2 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-xs rounded-btn transition-colors disabled:opacity-50"
            >
              {pwdSubmitting ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>

        {/* Section 2: Two-Factor Authentication (TOTP MFA) */}
        <div className="bg-surface border border-border rounded-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-red" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-text">Two-Factor Authentication</h2>
                  {user?.mfaEnabled ? (
                    <span className="px-2 py-0.5 bg-red-soft text-red text-[11px] font-semibold rounded-full border border-red/30">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-surface-2 text-muted text-[11px] font-semibold rounded-full border border-border">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {user?.mfaEnabled
                    ? 'Your account is secured with time-based one-time passwords (TOTP).'
                    : 'Protect your account by requiring an authentication code on sign in.'}
                </p>
              </div>
            </div>

            {user?.mfaEnabled ? (
              <button
                onClick={() => {
                  setMfaError(null);
                  setMfaDisablePassword('');
                  setShowMfaDisableModal(true);
                }}
                className="py-1.5 px-3 bg-surface-2 hover:bg-border/60 text-xs text-text border border-border rounded-btn transition-colors"
              >
                Disable 2FA
              </button>
            ) : (
              <button
                onClick={handleStartMfaSetup}
                disabled={mfaLoading}
                className="py-1.5 px-3 bg-red hover:bg-red-hover active:bg-red-press text-xs text-text font-medium rounded-btn transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                {mfaLoading ? 'Loading...' : 'Enable 2FA'}
              </button>
            )}
          </div>

          {mfaSuccessMsg && (
            <div className="p-3 bg-surface-2 border border-border rounded-input text-xs text-text flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-red flex-shrink-0" />
              <span>{mfaSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* Section 3: Active Sessions */}
        <div className="bg-surface border border-border rounded-card p-6 space-y-5">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Laptop className="w-5 h-5 text-red" />
              <div>
                <h2 className="text-base font-semibold text-text">Active Sessions</h2>
                <p className="text-xs text-muted">
                  Devices currently signed into your FlowCart account.
                </p>
              </div>
            </div>

            {sessions.filter((s) => !s.current).length > 0 && (
              <button
                onClick={handleRevokeAllSessions}
                disabled={revokingAll}
                className="py-1.5 px-3 bg-surface-2 hover:bg-border/60 text-xs text-text border border-border rounded-btn transition-colors disabled:opacity-50"
              >
                {revokingAll ? 'Revoking...' : 'Sign out other devices'}
              </button>
            )}
          </div>

          {sessionsError && (
            <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text">
              {sessionsError}
            </div>
          )}

          {sessionsLoading ? (
            <div className="py-6 text-center text-xs text-muted">Loading sessions...</div>
          ) : (
            <div className="space-y-3">
              {sessions.map((sess) => (
                <div
                  key={sess.idHash}
                  className="p-3.5 bg-surface-2 border border-border rounded-lg flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">
                        {sess.userAgent ? sess.userAgent.split(' ')[0] : 'Browser session'}
                      </span>
                      {sess.current && (
                        <span className="px-2 py-0.5 bg-red-soft text-red text-[11px] font-semibold rounded-full border border-red/30">
                          Current device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      {sess.ip && (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {sess.ip}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Last active:{' '}
                        {new Date(sess.lastSeenAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {!sess.current && (
                    <button
                      onClick={() => handleRevokeSession(sess.idHash)}
                      disabled={revokingHash === sess.idHash}
                      className="py-1 px-2.5 bg-surface hover:bg-border/40 text-muted hover:text-red text-xs border border-border rounded-btn transition-colors disabled:opacity-50"
                    >
                      {revokingHash === sess.idHash ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Danger Zone */}
        <div className="bg-surface border border-red/30 rounded-card p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Trash2 className="w-5 h-5 text-red" />
            <div>
              <h2 className="text-base font-semibold text-text">Delete Account</h2>
              <p className="text-xs text-muted">
                Permanently purge your account, workflows, and encrypted credentials. This cannot be undone.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="py-2 px-3 bg-red-soft hover:bg-red/20 text-red text-xs font-medium border border-red/30 rounded-btn transition-colors"
          >
            Delete FlowCart account
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface border border-red/40 rounded-card p-6 space-y-4 shadow-2xl">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-text">Confirm Account Deletion</h3>
                <p className="text-xs text-muted">
                  Please enter your password to confirm that you want to delete your account. All data will be permanently destroyed.
                </p>
              </div>

              {deleteError && (
                <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text">
                  {deleteError}
                </div>
              )}

              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted">Confirm with password</label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeletePassword('');
                      setDeleteError(null);
                    }}
                    className="py-2 px-3 bg-surface-2 hover:bg-border/60 text-xs text-muted hover:text-text rounded-btn border border-border transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleting}
                    className="py-2 px-3 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-xs rounded-btn transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: MFA Setup & Recovery Codes */}
        {showMfaSetupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 shadow-2xl space-y-5">
              {!mfaRecoveryCodes ? (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-red">
                      <Shield className="w-5 h-5" />
                      <h3 className="text-base font-semibold text-text">Enable Two-Factor Authentication</h3>
                    </div>
                    <p className="text-xs text-muted">
                      Scan the QR code with your authenticator app (Google Authenticator, 1Password, Authy), then enter the 6-digit code.
                    </p>
                  </div>

                  {mfaError && (
                    <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text">
                      {mfaError}
                    </div>
                  )}

                  {mfaQrCode && (
                    <div className="bg-white p-3 rounded-lg mx-auto w-48 h-48 flex items-center justify-center shadow-md">
                      <img src={mfaQrCode} alt="TOTP QR Code" className="w-44 h-44" />
                    </div>
                  )}

                  {mfaSecret && (
                    <div className="space-y-1 text-center">
                      <span className="text-[11px] text-muted">Can&apos;t scan? Enter secret manually:</span>
                      <div className="flex items-center justify-center gap-2">
                        <code className="text-xs font-mono text-text bg-surface-2 px-2.5 py-1 rounded border border-border tracking-wider">
                          {mfaSecret}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(mfaSecret);
                            setCopiedSecret(true);
                            setTimeout(() => setCopiedSecret(false), 2000);
                          }}
                          className="p-1 hover:text-red text-muted transition-colors"
                          title="Copy secret"
                        >
                          {copiedSecret ? <Check className="w-3.5 h-3.5 text-red" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleConfirmMfaEnable} className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-muted">Enter 6-digit authentication code</label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={mfaCodeInput}
                        onChange={(e) => setMfaCodeInput(e.target.value)}
                        placeholder="000000"
                        maxLength={6}
                        className="w-full px-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text font-mono text-center tracking-widest placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMfaSetupModal(false);
                          setMfaError(null);
                        }}
                        className="py-2 px-3 bg-surface-2 hover:bg-border/60 text-xs text-muted hover:text-text rounded-btn border border-border transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={mfaLoading || mfaCodeInput.length < 6}
                        className="py-2 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-xs rounded-btn transition-colors disabled:opacity-50"
                      >
                        {mfaLoading ? 'Verifying...' : 'Activate 2FA'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                /* Step 2: Recovery Codes */
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-red">
                      <CheckCircle2 className="w-5 h-5" />
                      <h3 className="text-base font-semibold text-text">Two-Factor Authentication Active</h3>
                    </div>
                    <p className="text-xs text-muted">
                      Save these 10 one-time recovery codes in a secure password manager. Each code can be used once to access your account if you lose your authenticator device.
                    </p>
                  </div>

                  <div className="p-3.5 bg-surface-2 border border-border rounded-lg space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-text">
                      {mfaRecoveryCodes.map((c, i) => (
                        <div key={i} className="py-1 px-2 bg-bg border border-border/80 rounded text-center">
                          {c}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(mfaRecoveryCodes.join('\n'));
                        setCopiedCodes(true);
                        setTimeout(() => setCopiedCodes(false), 2000);
                      }}
                      className="w-full mt-2 py-1.5 px-3 bg-surface hover:bg-border/60 text-xs text-muted hover:text-text border border-border rounded transition-colors flex items-center justify-center gap-1.5"
                    >
                      {copiedCodes ? <Check className="w-3.5 h-3.5 text-red" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCodes ? 'Copied all recovery codes' : 'Copy all recovery codes'}
                    </button>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMfaSetupModal(false);
                        setMfaRecoveryCodes(null);
                      }}
                      className="py-2 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-xs rounded-btn transition-colors"
                    >
                      I have saved my recovery codes
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Disable 2FA */}
        {showMfaDisableModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-surface border border-border rounded-card p-6 shadow-2xl space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-text">Disable Two-Factor Authentication</h3>
                <p className="text-xs text-muted">
                  Please enter your current password to confirm disabling two-factor authentication.
                </p>
              </div>

              {mfaError && (
                <div className="p-3 bg-red-soft border border-red/30 rounded-input text-xs text-red-text">
                  {mfaError}
                </div>
              )}

              <form onSubmit={handleConfirmMfaDisable} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-muted">Current password</label>
                  <input
                    type="password"
                    required
                    value={mfaDisablePassword}
                    onChange={(e) => setMfaDisablePassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 bg-surface-2 border border-border rounded-input text-sm text-text placeholder:text-muted/60 focus:border-red focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMfaDisableModal(false);
                      setMfaDisablePassword('');
                      setMfaError(null);
                    }}
                    className="py-2 px-3 bg-surface-2 hover:bg-border/60 text-xs text-muted hover:text-text rounded-btn border border-border transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={mfaLoading || !mfaDisablePassword}
                    className="py-2 px-4 bg-red hover:bg-red-hover active:bg-red-press text-text font-medium text-xs rounded-btn transition-colors disabled:opacity-50"
                  >
                    {mfaLoading ? 'Disabling...' : 'Disable 2FA'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
