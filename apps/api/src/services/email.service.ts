import nodemailer from 'nodemailer';
import { Env } from '@flowcart/shared';

export interface EmailService {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendAccountExistsEmail(to: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
  sendPasswordChangedNotice(to: string): Promise<void>;
}

export function createEmailService(env: Env): EmailService {
  const hasSmtp = Boolean(env.SMTP_HOST && env.SMTP_HOST.trim().length > 0);

  let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
  if (hasSmtp) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS || '',
          }
        : undefined,
    });
  }

  async function sendMail(opts: { to: string; subject: string; text: string; html?: string }): Promise<void> {
    if (transporter) {
      try {
        await transporter.sendMail({
          from: env.SMTP_FROM,
          to: opts.to,
          subject: opts.subject,
          text: opts.text,
          html: opts.html,
        });
        return;
      } catch (err: any) {
        console.warn(`[SMTP Delivery Warning]: Failed to send to ${opts.to}: ${err.message}`);
      }
    }

    // In development or when SMTP is unavailable, print link to console (Section 4)
    console.log(`\n================== [SYSTEM EMAIL NOTICE] ==================`);
    console.log(`To:      ${opts.to}`);
    console.log(`Subject: ${opts.subject}`);
    console.log(`Body:\n${opts.text}`);
    console.log(`===========================================================\n`);
  }

  return {
    async sendVerificationEmail(to: string, token: string): Promise<void> {
      const verifyUrl = `${env.APP_URL}/verify-email?token=${token}`;
      await sendMail({
        to,
        subject: 'Verify your FlowCart account',
        text: `Welcome to FlowCart!\n\nPlease verify your email by clicking the link below:\n${verifyUrl}\n\nThis link will expire in 24 hours.`,
        html: `<p>Welcome to FlowCart!</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link will expire in 24 hours.</p>`,
      });
    },

    async sendAccountExistsEmail(to: string): Promise<void> {
      const loginUrl = `${env.APP_URL}/login`;
      await sendMail({
        to,
        subject: 'An account already exists on FlowCart',
        text: `Someone attempted to register a new account with your email address (${to}). If you already have an account, you can log in here:\n${loginUrl}`,
        html: `<p>Someone attempted to register a new account with your email address (<strong>${to}</strong>).</p><p>If you already have an account, you can log in here: <a href="${loginUrl}">Log In</a>.</p>`,
      });
    },

    async sendPasswordResetEmail(to: string, token: string): Promise<void> {
      const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
      await sendMail({
        to,
        subject: 'Reset your FlowCart password',
        text: `You requested to reset your password.\n\nPlease click the link below to set a new password:\n${resetUrl}\n\nThis link will expire in 30 minutes. If you did not request this, you can safely ignore this email.`,
        html: `<p>You requested to reset your password.</p><p>Please click the link below to set a new password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link will expire in 30 minutes. If you did not request this, you can safely ignore this email.</p>`,
      });
    },

    async sendPasswordChangedNotice(to: string): Promise<void> {
      await sendMail({
        to,
        subject: 'Your FlowCart password was changed',
        text: `This is a notification that your FlowCart account password was just changed. If you did not make this change, please contact support or reset your password immediately.`,
        html: `<p>This is a notification that your FlowCart account password was just changed.</p><p>If you did not make this change, please reset your password immediately.</p>`,
      });
    },
  };
}
