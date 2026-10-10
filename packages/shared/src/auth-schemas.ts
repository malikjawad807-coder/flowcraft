import { z } from 'zod';

// Common weak passwords to reject
export const COMMON_PASSWORDS = new Set([
  '1234567890',
  'password123',
  'qwertyuiop',
  'admin12345',
  'welcome123',
  'flowcart123',
  'iloveyou123',
  'changeme123',
  'password1234',
  '12345678901',
]);

/**
 * Normalizes email: trims and converts to lowercase
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Password validation rule: min 10 chars, max 128 chars, rejected if on common password list
 */
export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine(
    (pwd) => !COMMON_PASSWORDS.has(pwd.toLowerCase()),
    'Password is too common and easily guessed'
  );

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .transform(normalizeEmail);

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(100).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  totp: z.string().optional(),
  recoveryCode: z.string().optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  current: z.string().min(1, 'Current password is required'),
  new: passwordSchema,
});

export const profileSchema = z.object({
  name: z.string().trim().max(100).optional(),
  timezone: z.string().trim().default('UTC'),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Current password is required to delete account'),
});

export const mfaEnableSchema = z.object({
  code: z.string().trim().min(6, '6-digit code is required').max(12),
});

export const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Current password is required to disable 2FA'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type MfaEnableInput = z.infer<typeof mfaEnableSchema>;
export type MfaDisableInput = z.infer<typeof mfaDisableSchema>;

/**
 * Friendly Error Mapping (Section 16)
 * Never show raw technical codes to end-users.
 */
export const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  GMAIL_RECONNECT_REQUIRED: 'Your Gmail connection has expired. Please reconnect in Settings > Connections.',
  LLM_UNAVAILABLE: 'The AI provider is not responding. Please try again in a few moments.',
  LLM_BAD_KEY: 'Invalid AI API key. Please check your API key in Settings.',
  RATE_LIMITED: 'Rate limit reached. Please wait a moment before trying again.',
  APPROVAL_EXPIRED: 'This approval request has timed out after 24 hours.',
  MFA_REQUIRED: 'Two-factor authentication code required to complete sign in.',
  INVALID_MFA_CODE: 'The authentication or recovery code entered is invalid.',
  ACCOUNT_LOCKED: 'Account temporarily locked due to multiple failed login attempts.',
  ACCOUNT_DISABLED: 'This account has been disabled by an administrator.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before signing in.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  SIGNUPS_DISABLED: 'Signups are currently disabled by the administrator.',
  UNAUTHENTICATED: 'Your session has expired. Please log in again.',
  CSRF_INVALID_ORIGIN: 'Security validation failed: invalid request origin.',
  CSRF_INVALID_TOKEN: 'Security validation failed: invalid CSRF token. Please refresh the page.',
};

export function getFriendlyErrorMessage(code?: string, defaultMsg?: string): string {
  if (code && FRIENDLY_ERROR_MESSAGES[code]) {
    return FRIENDLY_ERROR_MESSAGES[code];
  }
  return defaultMsg || 'An unexpected error occurred. Please try again.';
}

