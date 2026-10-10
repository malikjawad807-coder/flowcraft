import {
  eq,
  and,
  sql,
  isNull,
  isNotNull,
  gt,
  count,
  users,
  sessions,
  emailTokens,
  mfaFactors,
  auditLog,
  userSettings,
} from '@flowcart/db';
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  generateEmailToken,
  hashToken,
  generateSession,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeEmail,
  SignupInput,
  LoginInput,
  ResetPasswordInput,
  ChangePasswordInput,
  ProfileInput,
  Env,
} from '@flowcart/shared';
import { Vault } from '@flowcart/vault';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { EmailService } from './email.service.js';

export interface AuthContextMeta {
  ip?: string;
  userAgent?: string;
}

export class AuthService {
  private db: any;
  private env: Env;
  private emailService: EmailService;
  private vault?: Vault;
  private dummyHash: string = '';

  constructor(db: any, env: Env, emailService: EmailService, vault?: Vault) {
    this.db = db;
    this.env = env;
    this.emailService = emailService;
    this.vault = vault;

    // Generate a dummy hash on init for timing-safe failed lookups
    hashPassword('dummy_timing_protection_password').then((h) => {
      this.dummyHash = h;
    });
  }


  private async audit(userId: string | null, action: string, detail: Record<string, unknown> = {}, meta?: AuthContextMeta) {
    try {
      await this.db.insert(auditLog).values({
        userId,
        action,
        detail,
        ip: meta?.ip || null,
        userAgent: meta?.userAgent || null,
      });
    } catch {
      // Non-blocking audit logging
    }
  }

  /**
   * User Signup (Section 6.2)
   */
  async signup(input: SignupInput, meta?: AuthContextMeta): Promise<{ message: string }> {
    const email = normalizeEmail(input.email);

    // Check if user already exists
    const [existing] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);

    if (existing) {
      // Send email that account exists; do NOT reveal to API caller (timing-safe 201)
      await this.emailService.sendAccountExistsEmail(email);
      return { message: 'Check your email to verify your account.' };
    }

    // Check if signups are disabled (Section 6.2 rule 2)
    const [userCount] = await this.db.select({ val: count() }).from(users);
    const hasUsers = Number(userCount?.val || 0) > 0;

    if (!this.env.ALLOW_SIGNUPS && hasUsers) {
      const err: any = new Error('Signups are currently disabled');
      err.statusCode = 403;
      err.code = 'SIGNUPS_DISABLED';
      throw err;
    }

    const passwordHash = await hashPassword(input.password);
    const role = !hasUsers ? 'admin' : 'user';

    const [newUser] = await this.db
      .insert(users)
      .values({
        email,
        name: input.name || null,
        passwordHash,
        role,
      })
      .returning();

    // Default user settings
    await this.db.insert(userSettings).values({
      userId: newUser.id,
    });

    // Verification token (24h expiry)
    const { rawToken, tokenHash } = generateEmailToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.db.insert(emailTokens).values({
      tokenHash,
      userId: newUser.id,
      purpose: 'verify',
      expiresAt,
    });

    await this.emailService.sendVerificationEmail(email, rawToken);
    await this.audit(newUser.id, 'signup', { email, role }, meta);

    return { message: 'Check your email to verify your account.' };
  }

  /**
   * Verify Email (Section 6.3)
   */
  async verifyEmail(token: string, meta?: AuthContextMeta): Promise<void> {
    const tokenHash = hashToken(token);
    const now = new Date();

    const [record] = await this.db
      .select()
      .from(emailTokens)
      .where(
        and(
          eq(emailTokens.tokenHash, tokenHash),
          eq(emailTokens.purpose, 'verify'),
          isNull(emailTokens.usedAt),
          gt(emailTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!record) {
      const err: any = new Error('Invalid or expired verification token');
      err.statusCode = 400;
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    // Mark token used and set email_verified_at
    await this.db
      .update(emailTokens)
      .set({ usedAt: now })
      .where(eq(emailTokens.tokenHash, tokenHash));

    await this.db
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(eq(users.id, record.userId));

    await this.audit(record.userId, 'email_verified', {}, meta);
  }

  /**
   * Resend Verification (Section 6.3)
   */
  async resendVerification(rawEmail: string, _meta?: AuthContextMeta): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);

    // If user exists and is not yet verified, create a fresh token
    if (user && !user.emailVerifiedAt) {
      const { rawToken, tokenHash } = generateEmailToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await this.db.insert(emailTokens).values({
        tokenHash,
        userId: user.id,
        purpose: 'verify',
        expiresAt,
      });

      await this.emailService.sendVerificationEmail(email, rawToken);
    }
  }

  /**
   * Login (Section 6.4)
   */
  async login(
    input: LoginInput,
    meta?: AuthContextMeta
  ): Promise<{ cookieValue: string; userId: string; email: string; role: string }> {
    const email = normalizeEmail(input.email);
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);

    // Timing attack mitigation: run dummy verify if user not found
    if (!user || !user.passwordHash) {
      await verifyPassword(this.dummyHash || '$argon2id$v=19$m=19456,t=2,p=1$fake', input.password);
      const err: any = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const now = new Date();

    // Check account lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > now) {
      const retryAfter = Math.ceil((new Date(user.lockedUntil).getTime() - now.getTime()) / 1000);
      const err: any = new Error(`Account locked due to multiple failed login attempts. Retry in ${retryAfter}s.`);
      err.statusCode = 429;
      err.code = 'ACCOUNT_LOCKED';
      err.retryAfter = retryAfter;
      throw err;
    }

    // Verify password
    const valid = await verifyPassword(user.passwordHash, input.password);

    if (!valid) {
      const failed = user.failedLogins + 1;
      let lockedUntil: Date | null = null;

      if (failed >= 5) {
        // Lockout escalation: 15 min at 5, doubled for further lockouts up to 24h
        const multiplier = Math.pow(2, Math.min(6, failed - 5));
        const lockMinutes = Math.min(24 * 60, 15 * multiplier);
        lockedUntil = new Date(now.getTime() + lockMinutes * 60 * 1000);
      }

      await this.db
        .update(users)
        .set({
          failedLogins: failed,
          lockedUntil,
        })
        .where(eq(users.id, user.id));

      await this.audit(user.id, 'login_failed', { failedLogins: failed }, meta);

      const err: any = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Check email verification
    if (!user.emailVerifiedAt) {
      const err: any = new Error('Email address has not been verified. Please check your email.');
      err.statusCode = 403;
      err.code = 'EMAIL_NOT_VERIFIED';
      throw err;
    }

    // Check disabled account
    if (user.disabledAt) {
      const err: any = new Error('This account has been disabled.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_DISABLED';
      throw err;
    }

    // Check MFA (Section 6.8 & 12.9)
    const [mfaRecord] = await this.db
      .select()
      .from(mfaFactors)
      .where(eq(mfaFactors.userId, user.id))
      .limit(1);

    if (mfaRecord && mfaRecord.enabledAt) {

      const code = (input.totp || input.recoveryCode || '').trim();
      if (!code) {
        const err: any = new Error('Two-factor authentication code required');
        err.statusCode = 401;
        err.code = 'MFA_REQUIRED';
        throw err;
      }

      // 1. Try TOTP check
      let mfaSuccess = false;
      if (this.vault) {
        try {
          const secret = this.vault.decrypt(mfaRecord.secretEnc, `${user.id}:mfa_secret`);
          if (authenticator.check(code, secret)) {
            mfaSuccess = true;
          }
        } catch {
          // Fall through to recovery code check
        }
      }

      // 2. Try recovery code check if TOTP didn't match
      if (!mfaSuccess && mfaRecord.recoveryHashes && mfaRecord.recoveryHashes.length > 0) {
        const targetHash = hashRecoveryCode(code);
        if (mfaRecord.recoveryHashes.includes(targetHash)) {
          mfaSuccess = true;
          // Consume one-time recovery code
          const updatedHashes = mfaRecord.recoveryHashes.filter((h: string) => h !== targetHash);
          await this.db
            .update(mfaFactors)
            .set({ recoveryHashes: updatedHashes })
            .where(eq(mfaFactors.userId, user.id));
          await this.audit(user.id, 'mfa_recovery_used', { remainingCount: updatedHashes.length }, meta);
        }
      }

      if (!mfaSuccess) {
        const failed = user.failedLogins + 1;
        let lockedUntil: Date | null = null;
        if (failed >= 5) {
          const multiplier = Math.pow(2, Math.min(6, failed - 5));
          const lockMinutes = Math.min(24 * 60, 15 * multiplier);
          lockedUntil = new Date(now.getTime() + lockMinutes * 60 * 1000);
        }
        await this.db
          .update(users)
          .set({ failedLogins: failed, lockedUntil })
          .where(eq(users.id, user.id));
        await this.audit(user.id, 'login_failed', { reason: 'invalid_mfa', failedLogins: failed }, meta);

        const err: any = new Error('Invalid two-factor authentication or recovery code');
        err.statusCode = 401;
        err.code = 'INVALID_MFA_CODE';
        throw err;
      }
    }

    // Reset failed logins & lockout
    await this.db
      .update(users)
      .set({
        failedLogins: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, user.id));


    // Check if password hash needs upgrade
    if (needsRehash(user.passwordHash)) {
      const newHash = await hashPassword(input.password);
      await this.db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
    }

    // Create session (Section 6.4)
    const { cookieValue, idHash } = generateSession();
    const idleDays = this.env.SESSION_IDLE_DAYS || 7;
    const absDays = this.env.SESSION_ABSOLUTE_DAYS || 30;

    const expiresAt = new Date(now.getTime() + idleDays * 24 * 60 * 60 * 1000);
    const absoluteExpiresAt = new Date(now.getTime() + absDays * 24 * 60 * 60 * 1000);

    await this.db.insert(sessions).values({
      idHash,
      userId: user.id,
      expiresAt,
      absoluteExpiresAt,
      ip: meta?.ip || null,
      userAgent: meta?.userAgent || null,
    });

    await this.audit(user.id, 'login_success', {}, meta);

    return {
      cookieValue,
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Logout (Section 6.7)
   */
  async logout(sessionHash: string, userId?: string, meta?: AuthContextMeta): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.idHash, sessionHash));
    if (userId) {
      await this.audit(userId, 'logout', {}, meta);
    }
  }

  /**
   * Logout all sessions of user
   */
  async logoutAll(userId: string, meta?: AuthContextMeta): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
    await this.audit(userId, 'logout_all', {}, meta);
  }

  /**
   * Forgot Password (Section 6.7)
   */
  async forgotPassword(rawEmail: string, meta?: AuthContextMeta): Promise<void> {
    const email = normalizeEmail(rawEmail);
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);

    if (user && !user.disabledAt) {
      const { rawToken, tokenHash } = generateEmailToken();
      // 30 minute expiry (Section 6.7)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await this.db.insert(emailTokens).values({
        tokenHash,
        userId: user.id,
        purpose: 'reset',
        expiresAt,
      });

      await this.emailService.sendPasswordResetEmail(email, rawToken);
      await this.audit(user.id, 'password_reset_requested', {}, meta);
    }
  }

  /**
   * Reset Password (Section 6.7)
   */
  async resetPassword(input: ResetPasswordInput, meta?: AuthContextMeta): Promise<void> {
    const tokenHash = hashToken(input.token);
    const now = new Date();

    const [tokenRecord] = await this.db
      .select()
      .from(emailTokens)
      .where(
        and(
          eq(emailTokens.tokenHash, tokenHash),
          eq(emailTokens.purpose, 'reset'),
          isNull(emailTokens.usedAt),
          gt(emailTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!tokenRecord) {
      const err: any = new Error('Invalid or expired password reset token');
      err.statusCode = 400;
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    const [user] = await this.db.select().from(users).where(eq(users.id, tokenRecord.userId)).limit(1);
    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const newHash = await hashPassword(input.password);

    // Save hash, mark token used, clear lockouts, invalidate all existing sessions
    await this.db
      .update(users)
      .set({
        passwordHash: newHash,
        failedLogins: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, user.id));

    await this.db
      .update(emailTokens)
      .set({ usedAt: now })
      .where(eq(emailTokens.tokenHash, tokenHash));

    await this.db.delete(sessions).where(eq(sessions.userId, user.id));

    await this.emailService.sendPasswordChangedNotice(user.email);
    await this.audit(user.id, 'password_changed', { via: 'reset' }, meta);
  }

  /**
   * Change Password (Section 6.7)
   */
  async changePassword(
    userId: string,
    currentSessionHash: string,
    input: ChangePasswordInput,
    meta?: AuthContextMeta
  ): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.passwordHash) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const valid = await verifyPassword(user.passwordHash, input.current);
    if (!valid) {
      const err: any = new Error('Current password is incorrect');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const newHash = await hashPassword(input.new);
    await this.db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));

    // Delete all other sessions except the current one (Section 6.7)
    await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), sql`${sessions.idHash} != ${currentSessionHash}`));

    await this.emailService.sendPasswordChangedNotice(user.email);
    await this.audit(userId, 'password_changed', { via: 'change' }, meta);
  }

  /**
   * List Active Sessions (Section 6.7)
   */
  async getSessions(userId: string, currentSessionHash: string) {
    const rows = await this.db.select().from(sessions).where(eq(sessions.userId, userId));
    return rows.map((s: any) => ({
      id: s.idHash,
      ip: s.ip || 'Unknown',
      userAgent: s.userAgent || 'Unknown',
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
      isCurrent: s.idHash === currentSessionHash,
    }));
  }

  /**
   * Revoke a single session
   */
  async revokeSession(userId: string, sessionIdHash: string, meta?: AuthContextMeta) {
    await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.idHash, sessionIdHash)));
    await this.audit(userId, 'session_revoked', { sessionId: sessionIdHash }, meta);
  }

  /**
   * Update Profile (Section 6.7)
   */
  async updateProfile(userId: string, input: ProfileInput) {
    await this.db
      .update(users)
      .set({
        name: input.name !== undefined ? input.name : undefined,
        timezone: input.timezone || 'UTC',
      })
      .where(eq(users.id, userId));
  }

  /**
   * Delete Account (Section 6.7)
   */
  async deleteAccount(userId: string, password: string, meta?: AuthContextMeta) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.passwordHash) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      const err: any = new Error('Incorrect password');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Cascade delete user in DB
    await this.db.delete(users).where(eq(users.id, userId));
    await this.audit(userId, 'account_deleted', {}, meta);
  }

  /**
   * TOTP MFA Setup (Section 6.8 & 13)
   */
  async setupMfa(userId: string, email: string): Promise<{ secret: string; qrCode: string }> {
    if (!this.vault) {
      throw new Error('Vault is required for MFA operations');
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(email, 'FlowCart', secret);
    const qrCode = await QRCode.toDataURL(otpauthUrl);
    const secretEnc = this.vault.encrypt(secret, `${userId}:mfa_secret`);

    const [existing] = await this.db.select().from(mfaFactors).where(eq(mfaFactors.userId, userId)).limit(1);

    if (existing) {
      await this.db
        .update(mfaFactors)
        .set({
          secretEnc,
          enabledAt: null, // Staging until verified
        })
        .where(eq(mfaFactors.userId, userId));
    } else {
      await this.db.insert(mfaFactors).values({
        userId,
        secretEnc,
        enabledAt: null,
        recoveryHashes: [],
      });
    }

    return { secret, qrCode };
  }

  /**
   * TOTP MFA Enable (Section 6.8 & 13)
   */
  async enableMfa(userId: string, code: string, meta?: AuthContextMeta): Promise<{ recoveryCodes: string[] }> {
    if (!this.vault) {
      throw new Error('Vault is required for MFA operations');
    }

    const [record] = await this.db.select().from(mfaFactors).where(eq(mfaFactors.userId, userId)).limit(1);
    if (!record) {
      const err: any = new Error('MFA setup must be initiated before enabling');
      err.statusCode = 400;
      err.code = 'MFA_NOT_INITIALIZED';
      throw err;
    }

    const secret = this.vault.decrypt(record.secretEnc, `${userId}:mfa_secret`);
    const valid = authenticator.check(code.trim(), secret);

    if (!valid) {
      const err: any = new Error('Invalid 6-digit authentication code');
      err.statusCode = 400;
      err.code = 'INVALID_MFA_CODE';
      throw err;
    }

    const recoveryCodes = generateRecoveryCodes(10);
    const recoveryHashes = recoveryCodes.map((c) => hashRecoveryCode(c));

    await this.db
      .update(mfaFactors)
      .set({
        enabledAt: new Date(),
        recoveryHashes,
      })
      .where(eq(mfaFactors.userId, userId));

    await this.audit(userId, 'mfa_enabled', {}, meta);

    return { recoveryCodes };
  }

  /**
   * TOTP MFA Disable (Section 6.8 & 13)
   */
  async disableMfa(userId: string, passwordConfirm: string, meta?: AuthContextMeta): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.passwordHash) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const valid = await verifyPassword(user.passwordHash, passwordConfirm);
    if (!valid) {
      const err: any = new Error('Incorrect password');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    await this.db.delete(mfaFactors).where(eq(mfaFactors.userId, userId));
    await this.audit(userId, 'mfa_disabled', {}, meta);
  }
}

