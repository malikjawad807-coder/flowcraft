// Memory Sensitive Data Filter (Section 11.3)

/**
 * Validates whether a digit string passes the Luhn check (credit/debit cards).
 */
export function passesLuhnCheck(digits: string): boolean {
  const clean = digits.replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

const SENSITIVE_PATTERNS = [
  // Passwords, passcodes & secrets
  /\b(?:password|passcode|secret|pin)\s*(?:is|[:=])\s*\S+/i,

  // API keys and tokens
  /\b(?:api[_-]?key|auth[_-]?token|access[_-]?token)\s*[:=]\s*\S+/i,
  /\bsk-[a-zA-Z0-9_-]{20,}\b/,
  /\bghp_[a-zA-Z0-9]{30,}\b/,
  /\bAIza[0-9A-Za-z-_]{35}\b/,
  /\bbearer\s+[a-zA-Z0-9_\-\.]{20,}\b/i,

  // One-time codes & 2FA
  /\b(?:one-time code|verification code|otp|2fa code)\s*[:=]?\s*\d{4,8}\b/i,

  // Government IDs & SSN
  /\b\d{3}-\d{2}-\d{4}\b/, // US SSN

  // International Bank Account Numbers (IBAN)
  /\b[A-Z]{2}\d{2}[A-Z0-9]{12,30}\b/,

  // Long digit runs (8+ consecutive digits)
  /\b\d{8,}\b/,

  // Raw email headers block (full email bodies)
  /\b(?:From:\s*.+\nSubject:\s*.+\nDate:\s*)/i,

  // Sensitive personal markers
  /\b(?:diagnosed with|medical record|prescription for|religious affiliation|political party)\b/i,
];

export interface SensitiveValidationResult {
  isSafe: boolean;
  reason?: string;
}

export function validateMemoryText(text: string): SensitiveValidationResult {
  if (!text || typeof text !== 'string') {
    return { isSafe: false, reason: 'Memory text is required.' };
  }

  if (text.length > 500) {
    return { isSafe: false, reason: 'Memory text cannot exceed 500 characters.' };
  }

  // Check Luhn credit card numbers in text
  const potentialNumbers = text.match(/\b\d{13,19}\b/g) || [];
  for (const num of potentialNumbers) {
    if (passesLuhnCheck(num)) {
      return { isSafe: false, reason: 'Security Error: Credit or debit card numbers are not allowed.' };
    }
  }

  // Check sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return { isSafe: false, reason: 'Security Error: Secrets, passwords, keys, or sensitive personal data cannot be stored.' };
    }
  }

  return { isSafe: true };
}
