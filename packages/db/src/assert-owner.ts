export class UnauthorizedResourceAccessError extends Error {
  constructor(message = 'Resource not found or access denied') {
    super(message);
    this.name = 'UnauthorizedResourceAccessError';
  }
}

/**
 * Asserts that a row belonging to a user matches the requested userId.
 * Throws UnauthorizedResourceAccessError if null or user_id mismatch.
 */
export function assertOwner<T extends { userId?: string | null; user_id?: string | null }>(
  userId: string,
  row: T | null | undefined
): T {
  if (!row) {
    throw new UnauthorizedResourceAccessError();
  }

  const rowUserId = row.userId || row.user_id;
  if (!rowUserId || rowUserId !== userId) {
    throw new UnauthorizedResourceAccessError();
  }

  return row;
}
