import { convert } from 'html-to-text';
import type { gmail_v1 } from 'googleapis';
import type { ReadEmailResult, NormalizedEmail } from './types.js';

/**
 * Parses an email address header (e.g. "Alice Doe <alice@example.com>") into name and address.
 */
export function parseEmailAddress(raw: string): { name: string; address: string } {
  if (!raw) return { name: '', address: '' };
  const match = raw.match(/^(?:["']?([^"']+)["']?\s+)?<?([^\s<>]+@[^\s<>]+)>?$/);
  if (match) {
    return {
      name: (match[1] || '').trim(),
      address: (match[2] || '').trim().toLowerCase(),
    };
  }
  return {
    name: '',
    address: raw.trim().toLowerCase(),
  };
}

/**
 * Parses comma-separated recipient addresses into an array of email strings.
 */
export function parseRecipientList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => parseEmailAddress(s.trim()).address)
    .filter((a) => a.length > 0);
}

/**
 * Detects whether an incoming email is bulk or automated (Section 7.9).
 */
export function isBulkEmail(headers: Record<string, string>, fromAddress: string): boolean {
  // 1. List-Unsubscribe header present
  if (headers['list-unsubscribe'] || headers['List-Unsubscribe']) {
    return true;
  }

  // 2. Precedence is bulk, list, or junk
  const precedence = (headers['precedence'] || headers['Precedence'] || '').toLowerCase();
  if (['bulk', 'list', 'junk'].includes(precedence)) {
    return true;
  }

  // 3. Auto-Submitted is anything other than 'no'
  const autoSubmitted = (headers['auto-submitted'] || headers['Auto-Submitted'] || '').toLowerCase();
  if (autoSubmitted && autoSubmitted !== 'no') {
    return true;
  }

  // 4. Sender matches common automated mailboxes
  const senderLower = (fromAddress || '').toLowerCase();
  if (/(noreply|no-reply|donotreply|mailer-daemon|postmaster)/i.test(senderLower)) {
    return true;
  }

  return false;
}

/**
 * Cleans the email body by stripping quoted lines, thread history, and signature footers (Section 7.9).
 */
export function cleanEmailBody(rawText: string, maxChars = 6000): string {
  if (!rawText) return '';

  const lines = rawText.split(/\r?\n/);
  const keptLines: string[] = [];

  for (const line of lines) {
    // 1. Cut at common reply quotation headers
    if (/^On\s+.+wrote:$/i.test(line.trim()) || /^---\s*Original Message\s*---/i.test(line.trim())) {
      break;
    }
    // 2. Cut at email thread separation rule
    if (/^_{10,}/.test(line.trim())) {
      break;
    }
    // 3. Cut at signature delimiter
    if (line.trim() === '--') {
      break;
    }
    // 4. Skip quoted reply lines starting with '>'
    if (line.trim().startsWith('>')) {
      continue;
    }

    keptLines.push(line);
  }

  const cleaned = keptLines.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned.slice(0, maxChars);
}

/**
 * Parses raw Gmail API message into a legacy ReadEmailResult.
 */
export function parseGmailMessage(message: gmail_v1.Schema$Message): ReadEmailResult {
  const norm = normalizeGmailMessage(message);
  const rawHeaders = norm.rawHeaders || {};
  return {
    id: norm.messageId,
    threadId: norm.threadId,
    labelIds: norm.labels,
    snippet: norm.snippet,
    historyId: norm.historyId,
    internalDate: message.internalDate || '',
    headers: rawHeaders,
    from:
      rawHeaders['from'] ||
      rawHeaders['From'] ||
      (norm.from.name ? `${norm.from.name} <${norm.from.address}>` : norm.from.address),
    to: rawHeaders['to'] || rawHeaders['To'] || norm.to.join(', '),
    cc: rawHeaders['cc'] || rawHeaders['Cc'] || (norm.cc.length > 0 ? norm.cc.join(', ') : undefined),
    subject: norm.subject,
    date: rawHeaders['date'] || rawHeaders['Date'] || norm.date,
    bodyText: norm.bodyTextFull || norm.bodyText,
    bodyHtml: norm.bodyHtml || '',
    attachments: norm.attachments,
  };
}

/**
 * Parses a raw Gmail API message resource into the strict normalized email item structure (Section 7.9).
 */
export function normalizeGmailMessage(message: gmail_v1.Schema$Message): NormalizedEmail {
  const headers: Record<string, string> = {};
  if (message.payload?.headers) {
    for (const h of message.payload.headers) {
      if (h.name && h.value) {
        headers[h.name] = h.value;
        headers[h.name.toLowerCase()] = h.value;
      }
    }
  }

  let bodyText = '';
  let bodyHtml = '';
  const attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId?: string;
  }> = [];

  function extractParts(part?: gmail_v1.Schema$MessagePart) {
    if (!part) return;

    const mimeType = part.mimeType || '';

    if (part.filename && (part.body?.attachmentId || part.body?.data)) {
      attachments.push({
        filename: part.filename,
        mimeType: mimeType || 'application/octet-stream',
        size: part.body?.size || 0,
        attachmentId: part.body?.attachmentId || undefined,
      });
    }

    if (part.body?.data) {
      const decoded = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      if (mimeType === 'text/plain') {
        bodyText += (bodyText ? '\n' : '') + decoded;
      } else if (mimeType === 'text/html') {
        bodyHtml += (bodyHtml ? '\n' : '') + decoded;
      }
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        extractParts(subPart);
      }
    }
  }

  extractParts(message.payload);

  if (!bodyText.trim() && bodyHtml.trim()) {
    try {
      bodyText = convert(bodyHtml, {
        wordwrap: 130,
        selectors: [
          { selector: 'img', format: 'skip' },
          { selector: 'script', format: 'skip' },
          { selector: 'style', format: 'skip' },
        ],
      });
    } catch {
      bodyText = '';
    }
  }

  const rawFrom = headers['from'] || headers['From'] || '';
  const from = parseEmailAddress(rawFrom);
  const rawReplyTo = headers['reply-to'] || headers['Reply-To'];
  const replyTo = rawReplyTo ? parseEmailAddress(rawReplyTo).address || null : null;
  const to = parseRecipientList(headers['to'] || headers['To']);
  const cc = parseRecipientList(headers['cc'] || headers['Cc']);
  const subject = headers['subject'] || headers['Subject'] || '';
  const dateHeader = headers['date'] || headers['Date'];
  const date = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();

  const bodyTextFull = bodyText.slice(0, 20000);
  const cleanedBody = cleanEmailBody(bodyText, 6000);
  const isBulk = isBulkEmail(headers, from.address);

  return {
    messageId: message.id || '',
    threadId: message.threadId || '',
    historyId: message.historyId || undefined,
    from,
    replyTo,
    to,
    cc,
    subject,
    date,
    snippet: message.snippet || '',
    bodyText: cleanedBody,
    bodyTextFull,
    bodyHtml,
    rawHeaders: headers,
    labels: message.labelIds || [],
    headers: {
      messageIdHeader: headers['message-id'] || headers['Message-ID'],
      references: headers['references'] || headers['References'],
      inReplyTo: headers['in-reply-to'] || headers['In-Reply-To'],
      listUnsubscribe: headers['list-unsubscribe'] || headers['List-Unsubscribe'],
      autoSubmitted: headers['auto-submitted'] || headers['Auto-Submitted'],
      precedence: headers['precedence'] || headers['Precedence'],
    },
    attachments: attachments.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      attachmentId: a.attachmentId,
    })),
    isBulk,
  };
}
