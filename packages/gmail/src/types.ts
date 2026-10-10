export interface GmailAttachment {
  filename: string;
  content?: Buffer | string;
  contentType?: string;
  cid?: string;
  size?: number;
  attachmentId?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
  attachments?: GmailAttachment[];
}

export interface SendEmailResult {
  messageId: string;
  threadId: string;
}

export interface SearchEmailsOptions {
  query: string;
  maxResults?: number;
  pageToken?: string;
  includeSpamTrash?: boolean;
}

export interface SearchEmailsResult {
  messages: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface ReadEmailOptions {
  messageId: string;
  format?: 'full' | 'metadata' | 'minimal' | 'raw';
}

export interface ReadEmailResult {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId?: string;
  internalDate: string;
  headers: Record<string, string>;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId?: string;
  }>;
}

export interface CreateDraftOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  threadId?: string;
  attachments?: GmailAttachment[];
}

export interface CreateDraftResult {
  draftId: string;
  message: { id: string; threadId: string };
}

export interface ModifyLabelOptions {
  messageId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export interface ModifyLabelResult {
  id: string;
  threadId: string;
  labelIds: string[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type?: string;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface NormalizedEmail {
  messageId: string;
  threadId: string;
  historyId?: string;
  from: { name: string; address: string };
  replyTo: string | null;
  to: string[];
  cc: string[];
  subject: string;
  date: string;
  snippet: string;
  bodyText: string;
  bodyTextFull: string;
  bodyHtml?: string;
  labels: string[];
  headers: {
    messageIdHeader?: string;
    references?: string;
    inReplyTo?: string;
    listUnsubscribe?: string;
    autoSubmitted?: string;
    precedence?: string;
  };
  rawHeaders?: Record<string, string>;
  attachments: Array<{ filename: string; mimeType: string; size: number }>;
  isBulk: boolean;
}

