import nodemailer from 'nodemailer';
import { RecipientRecord } from '@/types/workflow';

export interface EmailDispatchOptions {
  authMethod?: 'app_password' | 'oauth_token' | 'global' | 'sandbox';
  userEmail?: string;
  appPassword?: string;
  oauthToken?: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export interface BulkEmailDispatchOptions {
  authMethod?: 'app_password' | 'oauth_token' | 'global' | 'sandbox';
  userEmail?: string;
  appPassword?: string;
  oauthToken?: string;
  recipients: Array<RecipientRecord & { personalizedSubject?: string; personalizedBody?: string }>;
  defaultSubject: string;
  defaultBody: string;
  isHtml?: boolean;
  delayMs?: number;
}

export interface EmailDispatchResult {
  success: boolean;
  messageId: string;
  threadId: string;
  to: string;
  subject: string;
  sentAt: string;
  previewUrl: string;
  mode: 'real_smtp' | 'real_oauth' | 'sandbox';
  error?: string;
}

export interface BulkEmailDispatchResult {
  success: boolean;
  totalAttempted: number;
  totalSent: number;
  totalFailed: number;
  results: EmailDispatchResult[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

/**
 * Dispatch a single email via Gmail App Password, Gmail OAuth, or Sandbox
 */
export async function dispatchSingleEmail(
  opts: EmailDispatchOptions
): Promise<EmailDispatchResult> {
  const sentAt = new Date().toISOString();
  const rawCleanAppPassword = opts.appPassword ? opts.appPassword.replace(/\s+/g, '') : '';

  // 1. If personal Gmail App Password is provided
  if (opts.authMethod === 'app_password' && opts.userEmail && rawCleanAppPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: opts.userEmail,
          pass: rawCleanAppPassword,
        },
      });

      const info = await transporter.sendMail({
        from: opts.userEmail,
        to: opts.to,
        cc: opts.cc || undefined,
        subject: opts.subject,
        text: !opts.isHtml ? opts.body : undefined,
        html: opts.isHtml ? opts.body : undefined,
      });

      return {
        success: true,
        messageId: info.messageId || `<${Date.now()}@gmail.com>`,
        threadId: `th_${Math.random().toString(36).substring(2, 9)}`,
        to: opts.to,
        subject: opts.subject,
        sentAt,
        previewUrl: `https://mail.google.com/mail/u/0/#sent`,
        mode: 'real_smtp',
      };
    } catch (err: any) {
      console.warn('Gmail SMTP error, falling back to verified sandbox receipt:', err.message);
      // Fallback with diagnostic info
      return {
        success: false,
        messageId: `<err-${Date.now()}@gmail.com>`,
        threadId: '',
        to: opts.to,
        subject: opts.subject,
        sentAt,
        previewUrl: '',
        mode: 'real_smtp',
        error: `Gmail SMTP authentication failed: ${err.message}`,
      };
    }
  }

  // 2. If OAuth Token is provided
  if (opts.authMethod === 'oauth_token' && opts.oauthToken) {
    try {
      const rawMessage = [
        `To: ${opts.to}`,
        opts.cc ? `Cc: ${opts.cc}` : '',
        `Subject: ${opts.subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        opts.body,
      ]
        .filter(Boolean)
        .join('\r\n');

      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.oauthToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encodedMessage }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          messageId: data.id ? `<${data.id}@mail.gmail.com>` : `<msg-${Date.now()}@gmail.com>`,
          threadId: data.threadId || `th_${Math.random().toString(36).substring(2, 8)}`,
          to: opts.to,
          subject: opts.subject,
          sentAt,
          previewUrl: `https://mail.google.com/mail/u/0/#inbox/${data.id}`,
          mode: 'real_oauth',
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Gmail API returned status ${res.status}`);
      }
    } catch (err: any) {
      return {
        success: false,
        messageId: `<err-${Date.now()}@gmail.com>`,
        threadId: '',
        to: opts.to,
        subject: opts.subject,
        sentAt,
        previewUrl: '',
        mode: 'real_oauth',
        error: `Gmail OAuth delivery error: ${err.message}`,
      };
    }
  }

  // 3. Sandbox / Simulation Mode
  const simulatedMsgId = `<msg-${Date.now()}.${Math.random().toString(36).substring(2, 7)}@gmail.com>`;
  return {
    success: true,
    messageId: simulatedMsgId,
    threadId: `th_${Math.random().toString(36).substring(2, 9)}`,
    to: opts.to,
    subject: opts.subject,
    sentAt,
    previewUrl: `https://mail.google.com/mail/u/0/#sent/${simulatedMsgId}`,
    mode: 'sandbox',
  };
}

/**
 * Dispatch bulk emails sequentially with rate-limit pacing
 */
export async function dispatchBulkEmails(
  opts: BulkEmailDispatchOptions
): Promise<BulkEmailDispatchResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const delay = opts.delayMs || 150;

  const results: EmailDispatchResult[] = [];
  let sentCount = 0;
  let failCount = 0;

  for (let i = 0; i < opts.recipients.length; i++) {
    const recipient = opts.recipients[i];
    const targetEmail = recipient.email;

    if (!targetEmail) {
      failCount++;
      continue;
    }

    const subject = recipient.personalizedSubject || opts.defaultSubject;
    const body = recipient.personalizedBody || opts.defaultBody;

    const dispatchRes = await dispatchSingleEmail({
      authMethod: opts.authMethod,
      userEmail: opts.userEmail,
      appPassword: opts.appPassword,
      oauthToken: opts.oauthToken,
      to: targetEmail,
      subject,
      body,
      isHtml: opts.isHtml,
    });

    results.push(dispatchRes);
    if (dispatchRes.success) {
      sentCount++;
    } else {
      failCount++;
    }

    // Rate limiting pacing between requests
    if (i < opts.recipients.length - 1 && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  return {
    success: failCount === 0 || sentCount > 0,
    totalAttempted: opts.recipients.length,
    totalSent: sentCount,
    totalFailed: failCount,
    results,
    startedAt,
    completedAt,
    durationMs,
  };
}
