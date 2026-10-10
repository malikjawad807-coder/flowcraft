/**
 * Strips carriage returns and line feeds to prevent SMTP header injection (Section 7.9).
 */
export function sanitizeHeaderValue(val: string | undefined | null): string {
  if (!val) return '';
  return val.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Normalizes email reply subjects by adding 'Re: ' exactly once (Section 7.9).
 */
export function formatReplySubject(originalSubject?: string): string {
  const sanitized = sanitizeHeaderValue(originalSubject || 'No Subject');
  if (/^re:\s*/i.test(sanitized)) {
    return sanitized;
  }
  return `Re: ${sanitized}`;
}

/**
 * Derives reply recipient strictly from Reply-To or From (Section 7.9).
 * The user or model cannot override this value.
 */
export function getReplyRecipient(itemJson: any): string {
  const rawRecipient =
    itemJson?.replyTo ||
    (typeof itemJson?.from === 'object' ? itemJson.from?.address : itemJson?.from) ||
    '';
  return sanitizeHeaderValue(rawRecipient);
}
