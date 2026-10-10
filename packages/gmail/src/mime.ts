import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import type { SendEmailOptions, CreateDraftOptions } from './types.js';

/**
 * Builds an RFC 2822 compliant MIME message and encodes it as base64url
 * suitable for the Gmail API raw payload parameter.
 */
export async function buildRawMimeMessage(
  options: SendEmailOptions | CreateDraftOptions
): Promise<string> {
  const mailOptions: any = {
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject: options.subject,
    text: options.bodyText,
    html: options.bodyHtml,
  };

  if (options.cc) {
    mailOptions.cc = Array.isArray(options.cc) ? options.cc.join(', ') : options.cc;
  }
  if (options.bcc) {
    mailOptions.bcc = Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc;
  }
  if ('replyTo' in options && options.replyTo) {
    mailOptions.replyTo = options.replyTo;
  }
  if ('inReplyTo' in options && options.inReplyTo) {
    mailOptions.inReplyTo = options.inReplyTo;
  }
  if ('references' in options && options.references) {
    mailOptions.references = options.references;
  }
  if (options.attachments && options.attachments.length > 0) {
    mailOptions.attachments = options.attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
      cid: att.cid,
    }));
  }

  const composer = new (MailComposer as any)(mailOptions);
  const buffer: Buffer = await new Promise((resolve, reject) => {
    composer.compile().build((err: Error | null, message: Buffer) => {
      if (err) reject(err);
      else resolve(message);
    });
  });

  return buffer.toString('base64url');
}
