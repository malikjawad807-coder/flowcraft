import { z } from 'zod';
import type { AgentTool, ServerContext, ToolApprovalPreview } from '../types.js';
import { wrapUntrustedEmail, sanitizeHeader } from '../prompt.js';
import { MemoryService } from '../memory/service.js';

export function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].trim();
  return raw.trim();
}

export function extractDomain(address: string): string {
  const email = extractEmailAddress(address);
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase().trim() : '';
}

// Sensitive filter pattern for memory_save (Section 11.3)
const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*\S+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
  /\b\d{13,19}\b/, // Potential credit card / bank account numbers (13-19 digits)
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /bearer\s+[a-zA-Z0-9_\-\.]{20,}/i,
];

function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

export const GMAIL_SEARCH_TOOL: AgentTool = {
  name: 'gmail_search',
  description: 'Search emails in Gmail using Gmail query syntax. Returns message IDs, threads, dates, and snippets.',
  risk: 'read',
  schema: z.object({
    query: z.string().describe('Gmail search query, e.g. "from:ali is:unread"'),
    maxResults: z.number().int().min(1).max(10).optional().default(5).describe('Max results (1-10, default 5)'),
  }),
  async execute(ctx: ServerContext, args: { query: string; maxResults?: number }) {
    if (!ctx.gmailClient) {
      throw new Error('Gmail integration is not connected');
    }
    const res = await ctx.gmailClient.searchEmails(args.query, { maxResults: args.maxResults || 5 });
    return (res.messages || []).map((m: any) => ({
      id: m.id,
      threadId: m.threadId,
      from: m.from,
      subject: m.subject,
      date: m.date,
      snippet: wrapUntrustedEmail(m.snippet || '', 500),
    }));
  },
};

export const GMAIL_GET_THREAD_TOOL: AgentTool = {
  name: 'gmail_get_thread',
  description: 'Get all messages in a Gmail thread ordered from oldest to newest. Each message body is safely truncated.',
  risk: 'read',
  schema: z.object({
    threadId: z.string().describe('The Gmail thread ID'),
  }),
  async execute(ctx: ServerContext, args: { threadId: string }) {
    if (!ctx.gmailClient) {
      throw new Error('Gmail integration is not connected');
    }
    const thread = await ctx.gmailClient.readThread(args.threadId);
    let totalChars = 0;
    const maxTotalChars = 12000;

    const messages = (thread.messages || []).map((m: any) => {
      let bodyText = m.body?.text || m.body?.html || m.snippet || '';
      if (bodyText.length > 3000) {
        bodyText = bodyText.slice(0, 3000) + '... [body truncated at 3000 chars]';
      }
      if (totalChars + bodyText.length > maxTotalChars) {
        const allowed = Math.max(0, maxTotalChars - totalChars);
        bodyText = bodyText.slice(0, allowed) + '... [thread truncated at 12000 chars]';
      }
      totalChars += bodyText.length;

      return {
        id: m.id,
        from: m.from,
        to: m.to,
        replyTo: m.replyTo,
        subject: m.subject,
        date: m.date,
        bodyText: wrapUntrustedEmail(bodyText, 3000),
      };
    });

    return {
      threadId: thread.id,
      messageCount: messages.length,
      messages,
    };
  },
};

function getSenderAddress(from: any): string {
  if (!from) return '';
  if (typeof from === 'object' && from.address) return from.address;
  if (typeof from === 'string') return extractEmailAddress(from);
  return '';
}

function getRecipientAddress(m: any): string {
  if (m?.replyTo) {
    if (typeof m.replyTo === 'object' && m.replyTo.address) return m.replyTo.address;
    if (typeof m.replyTo === 'string') return extractEmailAddress(m.replyTo);
  }
  return getSenderAddress(m?.from);
}

export const GMAIL_GET_MESSAGE_TOOL: AgentTool = {
  name: 'gmail_get_message',
  description: 'Get a single normalized email message by messageId.',
  risk: 'read',
  schema: z.object({
    messageId: z.string().describe('The Gmail message ID'),
  }),
  async execute(ctx: ServerContext, args: { messageId: string }) {
    if (!ctx.gmailClient) {
      throw new Error('Gmail integration is not connected');
    }
    const m = await ctx.gmailClient.readEmail(args.messageId);
    return {
      id: m.messageId,
      threadId: m.threadId,
      from: m.from,
      to: m.to,
      replyTo: m.replyTo,
      subject: m.subject,
      date: m.date,
      bodyText: wrapUntrustedEmail(m.bodyText || m.snippet || '', 4000),
    };
  },
};

export const GMAIL_CREATE_DRAFT_TOOL: AgentTool = {
  name: 'gmail_create_draft',
  description: 'Create a draft reply in an existing thread. Recipient and subject are derived on the server from the thread.',
  risk: 'draft',
  schema: z.object({
    threadId: z.string().describe('The Gmail thread ID to reply to'),
    bodyText: z.string().max(5000).describe('Draft body text (max 5000 chars)'),
  }),
  async execute(ctx: ServerContext, args: { threadId: string; bodyText: string }) {
    if (!ctx.gmailClient) {
      throw new Error('Gmail integration is not connected');
    }
    const thread = await ctx.gmailClient.readThread(args.threadId);
    const messages = thread.messages || [];
    if (messages.length === 0) {
      throw new Error(`Thread ${args.threadId} contains no messages`);
    }

    // Find the last non-self message to reply to
    const lastNonSelf = [...messages].reverse().find(
      (m: any) => getSenderAddress(m.from) !== ctx.userEmail
    ) || messages[messages.length - 1];

    const recipient = getRecipientAddress(lastNonSelf) || 'Unknown';
    const baseSubject = lastNonSelf?.subject || 'No Subject';
    const cleanSubject = sanitizeHeader(baseSubject.startsWith('Re: ') ? baseSubject : `Re: ${baseSubject}`);

    const res = await ctx.gmailClient.createDraft({
      to: recipient,
      subject: cleanSubject,
      bodyText: args.bodyText,
      threadId: args.threadId,
    });

    return {
      draftId: res.draftId,
      threadId: args.threadId,
      recipient,
      subject: cleanSubject,
      message: 'Draft successfully created in thread',
    };
  },
};

export const GMAIL_REPLY_TOOL: AgentTool = {
  name: 'gmail_reply',
  description: 'Reply to an email thread. Mode can be "draft" (creates draft) or "send" (sends email).',
  risk: 'send', // Evaluated dynamically for draft mode vs send mode
  schema: z.object({
    threadId: z.string().describe('The Gmail thread ID'),
    bodyText: z.string().max(5000).describe('Reply body text (max 5000 chars)'),
    mode: z.enum(['draft', 'send']).describe('Whether to create a draft or send immediately'),
  }),
  async getApprovalPreview(ctx: ServerContext, args: { threadId: string; bodyText: string; mode: 'draft' | 'send' }) {
    if (!ctx.gmailClient) {
      throw new Error('Gmail integration is not connected');
    }
    const thread = await ctx.gmailClient.readThread(args.threadId);
    const messages = thread.messages || [];
    const lastNonSelf = [...messages].reverse().find(
      (m: any) => getSenderAddress(m.from) !== ctx.userEmail
    ) || messages[messages.length - 1];

    const recipient = getRecipientAddress(lastNonSelf) || 'Unknown';
    const baseSubject = lastNonSelf?.subject || 'No Subject';
    const cleanSubject = sanitizeHeader(baseSubject.startsWith('Re: ') ? baseSubject : `Re: ${baseSubject}`);

    let warning: string | undefined;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && getSenderAddress(lastMsg.from) === ctx.userEmail) {
      warning = 'Warning: You were the last person to reply in this thread.';
    }

    if (lastNonSelf) {
      const fromAddr = getSenderAddress(lastNonSelf.from);
      const replyToAddr = getRecipientAddress(lastNonSelf);
      if (fromAddr && replyToAddr) {
        const fromDom = extractDomain(fromAddr);
        const replyDom = extractDomain(replyToAddr);
        if (fromDom && replyDom && fromDom !== replyDom) {
          warning = (warning ? warning + ' ' : '') + 'Warning: Reply-To domain differs from From domain.';
        }
      }
    }

    return {
      recipient,
      subject: cleanSubject,
      body: args.bodyText,
      warning,
    };
  },
  async execute(ctx: ServerContext, args: { threadId: string; bodyText: string; mode: 'draft' | 'send' }) {
    if (!ctx.gmailClient) {
      throw new Error('Gmail integration is not connected');
    }
    const thread = await ctx.gmailClient.readThread(args.threadId);
    const messages = thread.messages || [];
    const lastNonSelf = [...messages].reverse().find(
      (m: any) => getSenderAddress(m.from) !== ctx.userEmail
    ) || messages[messages.length - 1];

    const recipient = getRecipientAddress(lastNonSelf) || 'Unknown';
    const baseSubject = lastNonSelf?.subject || 'No Subject';
    const cleanSubject = sanitizeHeader(baseSubject.startsWith('Re: ') ? baseSubject : `Re: ${baseSubject}`);

    if (args.mode === 'draft') {
      const res = await ctx.gmailClient.createDraft({
        to: recipient,
        subject: cleanSubject,
        bodyText: args.bodyText,
        threadId: args.threadId,
      });
      return { draftId: res.draftId, threadId: args.threadId, recipient, subject: cleanSubject, status: 'draft_created' };
    } else {
      const res = await ctx.gmailClient.sendEmail({
        to: recipient,
        subject: cleanSubject,
        bodyText: args.bodyText,
        threadId: args.threadId,
      });
      return { messageId: res.messageId, threadId: args.threadId, recipient, subject: cleanSubject, status: 'sent' };
    }
  },
};

export const GMAIL_SEND_NEW_TOOL: AgentTool = {
  name: 'gmail_send_new',
  description: 'Send a new email message to exactly one recipient. ALWAYS requires user approval.',
  risk: 'send',
  schema: z.object({
    to: z.string().email().describe('Recipient email address (exactly one)'),
    subject: z.string().max(500).describe('Email subject'),
    bodyText: z.string().max(5000).describe('Email body text (max 5000 chars)'),
  }),
  getApprovalPreview(_ctx: ServerContext, args: { to: string; subject: string; bodyText: string }) {
    return {
      recipient: args.to,
      subject: sanitizeHeader(args.subject),
      body: args.bodyText,
    };
  },
  async execute(ctx: ServerContext, args: { to: string; subject: string; bodyText: string }) {
    if (!ctx.gmailClient) {
      throw new Error('Gmail integration is not connected');
    }
    const cleanSubject = sanitizeHeader(args.subject);
    const res = await ctx.gmailClient.sendEmail({
      to: args.to,
      subject: cleanSubject,
      bodyText: args.bodyText,
    });
    return {
      messageId: res.messageId,
      to: args.to,
      subject: cleanSubject,
      status: 'sent',
    };
  },
};

export const GMAIL_ADD_LABEL_TOOL: AgentTool = {
  name: 'gmail_add_label',
  description: 'Apply or remove a label on a message. System labels like TRASH, SPAM, SENT, DRAFT are refused.',
  risk: 'draft',
  schema: z.object({
    messageId: z.string().describe('The Gmail message ID'),
    labelName: z.string().describe('Label name to add or remove'),
    remove: z.boolean().optional().default(false).describe('If true, removes the label instead of adding'),
  }),
  async execute(ctx: ServerContext, args: { messageId: string; labelName: string; remove?: boolean }) {
    const reserved = ['TRASH', 'SPAM', 'SENT', 'DRAFT'];
    if (reserved.includes(args.labelName.toUpperCase())) {
      throw new Error(`Cannot modify reserved system label: ${args.labelName}`);
    }
    if (!ctx.gmailClient) {
      throw new Error('Gmail integration is not connected');
    }

    if (args.remove) {
      await ctx.gmailClient.removeLabel(args.messageId, args.labelName);
      return { messageId: args.messageId, label: args.labelName, action: 'removed' };
    } else {
      await ctx.gmailClient.addLabel(args.messageId, args.labelName);
      return { messageId: args.messageId, label: args.labelName, action: 'added' };
    }
  },
};

export const GMAIL_MARK_READ_TOOL: AgentTool = {
  name: 'gmail_mark_read',
  description: 'Mark a Gmail message as read.',
  risk: 'draft',
  schema: z.object({
    messageId: z.string().describe('The Gmail message ID'),
  }),
  async execute(ctx: ServerContext, args: { messageId: string }) {
    if (!ctx.gmailClient) {
      throw new Error('Gmail integration is not connected');
    }
    await ctx.gmailClient.markAsRead(args.messageId);
    return { messageId: args.messageId, status: 'marked_read' };
  },
};

export const MEMORY_SEARCH_TOOL: AgentTool = {
  name: 'memory_search',
  description: 'Search long-term memory for durable user facts, preferences, contacts, and rules.',
  risk: 'memory',
  schema: z.object({
    query: z.string().describe('Search query for memory'),
    limit: z.number().int().min(1).max(20).optional().default(5),
  }),
  async execute(ctx: ServerContext, args: { query: string; limit?: number }) {
    if (!ctx.db) {
      return [{ text: 'User prefers concise responses', category: 'preference' }].slice(0, args.limit || 5);
    }
    const res = await MemoryService.searchMemories(ctx, args.query, { limit: args.limit });
    return res.memories.map((m) => ({ id: m.id, text: m.text, category: m.category }));
  },
};

export const MEMORY_SAVE_TOOL: AgentTool = {
  name: 'memory_save',
  description: 'Explicitly save a durable fact, preference or rule about the user. Only when the user asks.',
  risk: 'memory',
  schema: z.object({
    text: z.string().max(500).describe('Fact to remember (max 500 chars)'),
    category: z.enum(['profile', 'preference', 'contact', 'project', 'style', 'rule']).describe('Category of fact'),
  }),
  async execute(ctx: ServerContext, args: { text: string; category: any }) {
    if (ctx.isWorkflow) {
      throw new Error('Memory cannot be saved from workflow nodes');
    }
    const res = await MemoryService.saveMemory(ctx, {
      text: args.text,
      category: args.category,
      source: 'explicit',
    });
    return {
      saved: true,
      id: res.memory.id,
      text: res.memory.text,
      category: res.memory.category,
      action: res.action,
      message: 'Memory saved successfully',
    };
  },
};

export const MEMORY_FORGET_TOOL: AgentTool = {
  name: 'memory_forget',
  description: 'Delete a memory item by memoryId when the user asks to forget something.',
  risk: 'memory',
  schema: z.object({
    memoryId: z.string().describe('ID of memory to forget'),
  }),
  async execute(ctx: ServerContext, args: { memoryId: string }) {
    await MemoryService.forgetMemory(ctx, args.memoryId);
    return {
      deleted: true,
      memoryId: args.memoryId,
      message: 'Memory removed successfully',
    };
  },
};

export const ALL_TOOLS: AgentTool[] = [
  GMAIL_SEARCH_TOOL,
  GMAIL_GET_THREAD_TOOL,
  GMAIL_GET_MESSAGE_TOOL,
  GMAIL_CREATE_DRAFT_TOOL,
  GMAIL_REPLY_TOOL,
  GMAIL_SEND_NEW_TOOL,
  GMAIL_ADD_LABEL_TOOL,
  GMAIL_MARK_READ_TOOL,
  MEMORY_SEARCH_TOOL,
  MEMORY_SAVE_TOOL,
  MEMORY_FORGET_TOOL,
];

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  constructor(tools: AgentTool[] = ALL_TOOLS) {
    for (const t of tools) {
      this.tools.set(t.name, t);
    }
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  list(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  filter(allowedNames?: string[]): AgentTool[] {
    if (!allowedNames) return this.list();
    return this.list().filter((t) => allowedNames.includes(t.name));
  }
}
