import { describe, it, expect, vi, beforeEach } from 'vitest';
import { google, Auth } from 'googleapis';
type OAuth2Client = Auth.OAuth2Client;
import {
  sendEmail,
  searchEmails,
  readEmail,
  createDraft,
  addLabel,
  getLabels,
  getProfile,
} from './client.js';

vi.mock('googleapis', () => {
  const sendMock = vi.fn();
  const listMock = vi.fn();
  const getMock = vi.fn();
  const modifyMock = vi.fn();
  const draftCreateMock = vi.fn();
  const labelsListMock = vi.fn();
  const profileMock = vi.fn();

  return {
    google: {
      gmail: vi.fn(() => ({
        users: {
          messages: {
            send: sendMock,
            list: listMock,
            get: getMock,
            modify: modifyMock,
          },
          drafts: {
            create: draftCreateMock,
          },
          labels: {
            list: labelsListMock,
          },
          getProfile: profileMock,
        },
      })),
    },
  };
});

describe('Gmail Client Subsystem (Section 7.4)', () => {
  const dummyAuth = {} as OAuth2Client;
  let gmailMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    gmailMock = (google.gmail as any)();
  });

  it('1. sendEmail: compiles MIME and invokes messages.send with raw base64url', async () => {
    gmailMock.users.messages.send.mockResolvedValueOnce({
      data: { id: 'msg_123', threadId: 'th_456' },
    });

    const res = await sendEmail(dummyAuth, {
      to: 'recipient@example.com',
      cc: 'cc@example.com',
      subject: 'Test Subject',
      bodyText: 'Hello world plain text',
      bodyHtml: '<p>Hello world HTML</p>',
    });

    expect(gmailMock.users.messages.send).toHaveBeenCalledTimes(1);
    const callArgs = gmailMock.users.messages.send.mock.calls[0][0];
    expect(callArgs.userId).toBe('me');
    expect(callArgs.requestBody.raw).toBeDefined();
    // Raw must be a non-empty base64url string
    expect(typeof callArgs.requestBody.raw).toBe('string');
    expect(callArgs.requestBody.raw.length).toBeGreaterThan(20);

    expect(res).toEqual({
      messageId: 'msg_123',
      threadId: 'th_456',
    });
  });

  it('2. searchEmails: queries messages with query filters and returns results', async () => {
    gmailMock.users.messages.list.mockResolvedValueOnce({
      data: {
        messages: [
          { id: 'msg_1', threadId: 'th_1' },
          { id: 'msg_2', threadId: 'th_2' },
        ],
        nextPageToken: 'next_page_123',
        resultSizeEstimate: 2,
      },
    });

    const res = await searchEmails(dummyAuth, {
      query: 'is:unread from:boss@company.com',
      maxResults: 5,
    });

    expect(gmailMock.users.messages.list).toHaveBeenCalledWith({
      userId: 'me',
      q: 'is:unread from:boss@company.com',
      maxResults: 5,
      pageToken: undefined,
      includeSpamTrash: false,
    });

    expect(res.messages.length).toBe(2);
    expect(res.messages[0]).toEqual({ id: 'msg_1', threadId: 'th_1' });
    expect(res.nextPageToken).toBe('next_page_123');
  });

  it('3. readEmail: extracts headers, decodes multipart bodies and detects attachments', async () => {
    const rawPlain = Buffer.from('Plain text content').toString('base64url');
    const rawHtml = Buffer.from('<b>HTML content</b>').toString('base64url');

    gmailMock.users.messages.get.mockResolvedValueOnce({
      data: {
        id: 'msg_999',
        threadId: 'th_999',
        labelIds: ['INBOX', 'UNREAD'],
        snippet: 'Plain text content',
        internalDate: '1700000000000',
        payload: {
          headers: [
            { name: 'Subject', value: 'Project Update' },
            { name: 'From', value: 'Alice <alice@example.com>' },
            { name: 'To', value: 'Bob <bob@example.com>' },
            { name: 'Date', value: 'Mon, 1 Jan 2026 10:00:00 GMT' },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: rawPlain },
            },
            {
              mimeType: 'text/html',
              body: { data: rawHtml },
            },
            {
              filename: 'report.pdf',
              mimeType: 'application/pdf',
              body: { size: 1024, attachmentId: 'att_pdf_1' },
            },
          ],
        },
      },
    });

    const res = await readEmail(dummyAuth, { messageId: 'msg_999' });

    expect(res.id).toBe('msg_999');
    expect(res.subject).toBe('Project Update');
    expect(res.from).toBe('Alice <alice@example.com>');
    expect(res.to).toBe('Bob <bob@example.com>');
    expect(res.bodyText).toContain('Plain text content');
    expect(res.bodyHtml).toContain('<b>HTML content</b>');
    expect(res.attachments.length).toBe(1);
    expect(res.attachments[0]).toEqual({
      filename: 'report.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      attachmentId: 'att_pdf_1',
    });
  });

  it('4. createDraft: prepares RFC 2822 payload and saves to Gmail drafts', async () => {
    gmailMock.users.drafts.create.mockResolvedValueOnce({
      data: {
        id: 'draft_456',
        message: { id: 'msg_draft_1', threadId: 'th_draft_1' },
      },
    });

    const res = await createDraft(dummyAuth, {
      to: 'client@example.com',
      subject: 'Draft Proposal',
      bodyText: 'Here is the preliminary quote.',
      threadId: 'th_existing',
    });

    expect(gmailMock.users.drafts.create).toHaveBeenCalledTimes(1);
    const callArgs = gmailMock.users.drafts.create.mock.calls[0][0];
    expect(callArgs.userId).toBe('me');
    expect(callArgs.requestBody.message.raw).toBeDefined();
    expect(callArgs.requestBody.message.threadId).toBe('th_existing');

    expect(res).toEqual({
      draftId: 'draft_456',
      message: { id: 'msg_draft_1', threadId: 'th_draft_1' },
    });
  });

  it('5. addLabel: modifies message labels with add and remove IDs', async () => {
    gmailMock.users.messages.modify.mockResolvedValueOnce({
      data: {
        id: 'msg_10',
        threadId: 'th_10',
        labelIds: ['PROCESSED'],
      },
    });

    const res = await addLabel(dummyAuth, {
      messageId: 'msg_10',
      addLabelIds: ['PROCESSED'],
      removeLabelIds: ['UNREAD'],
    });

    expect(gmailMock.users.messages.modify).toHaveBeenCalledWith({
      userId: 'me',
      id: 'msg_10',
      requestBody: {
        addLabelIds: ['PROCESSED'],
        removeLabelIds: ['UNREAD'],
      },
    });
    expect(res.labelIds).toContain('PROCESSED');
  });

  it('6. getLabels: lists user and system mail labels', async () => {
    gmailMock.users.labels.list.mockResolvedValueOnce({
      data: {
        labels: [
          { id: 'INBOX', name: 'INBOX', type: 'system' },
          { id: 'SENT', name: 'SENT', type: 'system' },
          { id: 'Label_1', name: 'Urgent', type: 'user' },
        ],
      },
    });

    const labels = await getLabels(dummyAuth);

    expect(labels.length).toBe(3);
    expect(labels[2]).toEqual({ id: 'Label_1', name: 'Urgent', type: 'user' });
  });

  it('Helper getProfile: fetches authenticated user profile and message metrics', async () => {
    gmailMock.users.getProfile.mockResolvedValueOnce({
      data: {
        emailAddress: 'user@company.com',
        messagesTotal: 15420,
        threadsTotal: 8421,
        historyId: '987654321',
      },
    });

    const profile = await getProfile(dummyAuth);

    expect(profile.emailAddress).toBe('user@company.com');
    expect(profile.messagesTotal).toBe(15420);
    expect(profile.threadsTotal).toBe(8421);
  });
});
