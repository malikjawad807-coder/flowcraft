import { google, Auth } from 'googleapis';

type OAuth2Client = Auth.OAuth2Client;
import { buildRawMimeMessage } from './mime.js';
import { parseGmailMessage, normalizeGmailMessage } from './parser.js';
import type {
  SendEmailOptions,
  SendEmailResult,
  SearchEmailsOptions,
  SearchEmailsResult,
  ReadEmailOptions,
  ReadEmailResult,
  CreateDraftOptions,
  CreateDraftResult,
  ModifyLabelOptions,
  ModifyLabelResult,
  GmailLabel,
  GmailProfile,
  NormalizedEmail,
} from './types.js';

/**
 * Executes a function with exponential backoff and jitter on 429 or 5xx errors (Section 7.9).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 4,
  baseDelayMs = 500
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const status = err.status || err.code || err.response?.status;

      // Only retry on rate limits (429) or server errors (5xx)
      const isRetryable = status === 429 || (typeof status === 'number' && status >= 500 && status < 600);
      if (!isRetryable || attempt > maxRetries) {
        throw err;
      }

      // Check Retry-After header
      const retryAfterHeader = err.response?.headers?.['retry-after'];
      let delayMs = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      if (retryAfterHeader) {
        const parsed = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsed) && parsed > 0) {
          delayMs = parsed * 1000;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * 1. Send Email (RFC 2822 MIME raw dispatch)
 */
export async function sendEmail(
  auth: OAuth2Client,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  return withRetry(async () => {
    const gmail = google.gmail({ version: 'v1', auth });
    const raw = await buildRawMimeMessage(options);

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: options.threadId,
      },
    });

    return {
      messageId: res.data.id || '',
      threadId: res.data.threadId || '',
    };
  });
}

/**
 * 2. Search Emails (List messages matching query)
 */
export async function searchEmails(
  auth: OAuth2Client,
  options: SearchEmailsOptions
): Promise<SearchEmailsResult> {
  return withRetry(async () => {
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: options.query,
      maxResults: options.maxResults || 10,
      pageToken: options.pageToken,
      includeSpamTrash: options.includeSpamTrash || false,
    });

    return {
      messages: (res.data.messages || []).map((m) => ({
        id: m.id || '',
        threadId: m.threadId || '',
      })),
      nextPageToken: res.data.nextPageToken || undefined,
      resultSizeEstimate: res.data.resultSizeEstimate || undefined,
    };
  });
}

/**
 * 3. Read Email (Fetch and parse message details)
 */
export async function readEmail(
  auth: OAuth2Client,
  options: ReadEmailOptions
): Promise<ReadEmailResult> {
  return withRetry(async () => {
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.get({
      userId: 'me',
      id: options.messageId,
      format: options.format || 'full',
    });

    return parseGmailMessage(res.data);
  });
}

/**
 * 4. Create Draft (Compose a draft message without dispatching)
 */
export async function createDraft(
  auth: OAuth2Client,
  options: CreateDraftOptions
): Promise<CreateDraftResult> {
  return withRetry(async () => {
    const gmail = google.gmail({ version: 'v1', auth });
    const raw = await buildRawMimeMessage(options);

    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw,
          threadId: options.threadId,
        },
      },
    });

    return {
      draftId: res.data.id || '',
      message: {
        id: res.data.message?.id || '',
        threadId: res.data.message?.threadId || '',
      },
    };
  });
}

/**
 * 5. Modify Message Labels (Add / Remove Label)
 */
export async function modifyMessage(
  auth: OAuth2Client,
  messageId: string,
  options: { addLabelIds?: string[]; removeLabelIds?: string[] }
): Promise<ModifyLabelResult> {
  return withRetry(async () => {
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: options.addLabelIds || [],
        removeLabelIds: options.removeLabelIds || [],
      },
    });

    return {
      id: res.data.id || '',
      threadId: res.data.threadId || '',
      labelIds: res.data.labelIds || [],
    };
  });
}

export const addLabel = (auth: OAuth2Client, options: ModifyLabelOptions) =>
  modifyMessage(auth, options.messageId, options);

/**
 * 6. Get Labels (List all user and system labels)
 */
export async function getLabels(auth: OAuth2Client): Promise<GmailLabel[]> {
  return withRetry(async () => {
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.labels.list({
      userId: 'me',
    });

    return (res.data.labels || []).map((l) => ({
      id: l.id || '',
      name: l.name || '',
      type: l.type || undefined,
    }));
  });
}

/**
 * 7. Get User Profile (Verify connection and retrieve mailbox historyId)
 */
export async function getProfile(auth: OAuth2Client): Promise<GmailProfile> {
  return withRetry(async () => {
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.getProfile({
      userId: 'me',
    });

    return {
      emailAddress: res.data.emailAddress || '',
      messagesTotal: res.data.messagesTotal || 0,
      threadsTotal: res.data.threadsTotal || 0,
      historyId: res.data.historyId || '',
    };
  });
}

/**
 * 8. List History (Section 7.9 & 7.10)
 * Paginates from startHistoryId to retrieve newly added message IDs.
 */
export async function listHistory(
  auth: OAuth2Client,
  startHistoryId: string
): Promise<{ messageIds: string[]; latestHistoryId: string }> {
  return withRetry(async () => {
    const gmail = google.gmail({ version: 'v1', auth });
    const messageIdSet = new Set<string>();
    let pageToken: string | undefined = undefined;
    let latestHistoryId = startHistoryId;

    do {
      const res: any = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        pageToken,
      });

      if (res.data.historyId) {
        latestHistoryId = res.data.historyId;
      }

      if (res.data.history) {
        for (const h of res.data.history) {
          if (h.messagesAdded) {
            for (const item of h.messagesAdded) {
              if (item.message?.id) {
                messageIdSet.add(item.message.id);
              }
            }
          }
        }
      }

      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return {
      messageIds: Array.from(messageIdSet),
      latestHistoryId,
    };
  });
}

/**
 * 9. Ensure Label exists (find or create)
 */
export async function ensureLabel(auth: OAuth2Client, name: string): Promise<string> {
  return withRetry(async () => {
    const gmail = google.gmail({ version: 'v1', auth });

    const listRes = await gmail.users.labels.list({ userId: 'me' });
    const existing = (listRes.data.labels || []).find(
      (l) => l.name?.toLowerCase() === name.toLowerCase()
    );
    if (existing?.id) {
      return existing.id;
    }

    const createRes = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });

    return createRes.data.id || name;
  });
}

/**
 * GmailClient Class encapsulation per Section 7.9.
 */
export class GmailClient {
  private auth: OAuth2Client;
  private labelCache = new Map<string, string>();

  constructor(auth: OAuth2Client) {
    this.auth = auth;
  }

  async getProfile(): Promise<GmailProfile> {
    return getProfile(this.auth);
  }

  async listHistory(startHistoryId: string) {
    return listHistory(this.auth, startHistoryId);
  }

  async listMessages(query: string, maxResults = 50) {
    return searchEmails(this.auth, { query, maxResults });
  }

  async getMessage(id: string): Promise<NormalizedEmail> {
    return withRetry(async () => {
      const gmail = google.gmail({ version: 'v1', auth: this.auth });
      const res = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });
      return normalizeGmailMessage(res.data);
    });
  }

  async getThread(threadId: string) {
    return withRetry(async () => {
      const gmail = google.gmail({ version: 'v1', auth: this.auth });
      const res = await gmail.users.threads.get({
        userId: 'me',
        id: threadId,
      });
      return {
        id: res.data.id || '',
        historyId: res.data.historyId || '',
        messages: (res.data.messages || []).map((m) => normalizeGmailMessage(m)),
      };
    });
  }

  async createDraft(opts: { threadId?: string; to: string; subject: string; bodyText: string }) {
    return createDraft(this.auth, {
      threadId: opts.threadId,
      to: opts.to,
      subject: opts.subject,
      bodyText: opts.bodyText,
    });
  }

  async sendReply(opts: {
    threadId?: string;
    to: string;
    subject: string;
    bodyText: string;
    inReplyTo?: string;
    references?: string;
  }) {
    return sendEmail(this.auth, {
      threadId: opts.threadId,
      to: opts.to,
      subject: opts.subject,
      bodyText: opts.bodyText,
      inReplyTo: opts.inReplyTo,
      references: opts.references,
    });
  }

  async sendNew(opts: { to: string; subject: string; bodyText: string }) {
    return sendEmail(this.auth, {
      to: opts.to,
      subject: opts.subject,
      bodyText: opts.bodyText,
    });
  }

  async ensureLabel(name: string): Promise<string> {
    const cached = this.labelCache.get(name.toLowerCase());
    if (cached) return cached;

    const id = await ensureLabel(this.auth, name);
    this.labelCache.set(name.toLowerCase(), id);
    return id;
  }

  async modifyMessage(id: string, options: { addLabelIds?: string[]; removeLabelIds?: string[] }) {
    return modifyMessage(this.auth, id, options);
  }

  async searchEmails(query: string, opts?: { maxResults?: number }) {
    return searchEmails(this.auth, { query, maxResults: opts?.maxResults || 10 });
  }

  async readThread(threadId: string) {
    return this.getThread(threadId);
  }

  async readEmail(messageId: string) {
    return this.getMessage(messageId);
  }

  async sendEmail(opts: SendEmailOptions) {
    return sendEmail(this.auth, opts);
  }

  async addLabel(messageId: string, labelName: string) {
    const labelId = await this.ensureLabel(labelName);
    return this.modifyMessage(messageId, { addLabelIds: [labelId] });
  }

  async removeLabel(messageId: string, labelName: string) {
    const labelId = await this.ensureLabel(labelName);
    return this.modifyMessage(messageId, { removeLabelIds: [labelId] });
  }

  async markAsRead(messageId: string) {
    return this.modifyMessage(messageId, { removeLabelIds: ['UNREAD'] });
  }
}

