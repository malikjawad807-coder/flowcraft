import { z } from 'zod';

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccessPayload<T = unknown> {
  ok?: boolean;
  data?: T;
}

export type UserRole = 'admin' | 'user';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  timezone: string;
}


export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
