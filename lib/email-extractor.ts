import * as XLSX from 'xlsx';

export interface ExtractedEmail {
  id: string;
  email: string;
  domain: string;
  provider: 'Gmail' | 'Yahoo' | 'Outlook' | 'Custom';
  sourceFile: string;
  sourceRow?: number;
  selected: boolean;
}

export interface ExtractionResult {
  fileName: string;
  fileSize: number;
  totalFound: number;
  uniqueCount: number;
  emails: ExtractedEmail[];
  domainStats: {
    gmail: number;
    yahoo: number;
    outlook: number;
    custom: number;
  };
  domainBreakdown: Record<string, number>;
}

// Comprehensive Universal Email Regex
export const UNIVERSAL_EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

/**
 * Categorize email provider by domain
 */
export function categorizeEmailProvider(
  domain: string
): 'Gmail' | 'Yahoo' | 'Outlook' | 'Custom' {
  const d = domain.toLowerCase();
  if (d === 'gmail.com' || d.endsWith('.gmail.com') || d === 'googlemail.com') {
    return 'Gmail';
  }
  if (d === 'yahoo.com' || d.endsWith('.yahoo.com') || d === 'ymail.com') {
    return 'Yahoo';
  }
  if (
    d === 'outlook.com' ||
    d === 'hotmail.com' ||
    d === 'live.com' ||
    d === 'msn.com' ||
    d.endsWith('.outlook.com')
  ) {
    return 'Outlook';
  }
  return 'Custom';
}

/**
 * Scan raw text string and extract all valid email addresses
 */
export function extractEmailsFromText(
  text: string,
  fileName = 'file.txt'
): ExtractionResult {
  const matches = text.match(UNIVERSAL_EMAIL_REGEX) || [];
  const seen = new Set<string>();
  const emails: ExtractedEmail[] = [];
  const domainBreakdown: Record<string, number> = {};

  const domainStats = {
    gmail: 0,
    yahoo: 0,
    outlook: 0,
    custom: 0,
  };

  matches.forEach((rawEmail, index) => {
    const cleanEmail = rawEmail.trim().toLowerCase();
    // Exclude invalid file extensions falsely matching like "foo@2x.png"
    if (cleanEmail.endsWith('.png') || cleanEmail.endsWith('.jpg') || cleanEmail.endsWith('.gif')) {
      return;
    }

    if (!seen.has(cleanEmail)) {
      seen.add(cleanEmail);
      const parts = cleanEmail.split('@');
      const domain = parts[1] || 'unknown';
      const provider = categorizeEmailProvider(domain);

      if (provider === 'Gmail') domainStats.gmail++;
      else if (provider === 'Yahoo') domainStats.yahoo++;
      else if (provider === 'Outlook') domainStats.outlook++;
      else domainStats.custom++;

      domainBreakdown[domain] = (domainBreakdown[domain] || 0) + 1;

      emails.push({
        id: `email_${index}_${Math.random().toString(36).substring(2, 7)}`,
        email: cleanEmail,
        domain,
        provider,
        sourceFile: fileName,
        sourceRow: index + 1,
        selected: true,
      });
    }
  });

  return {
    fileName,
    fileSize: text.length,
    totalFound: matches.length,
    uniqueCount: emails.length,
    emails,
    domainStats,
    domainBreakdown,
  };
}

/**
 * Scan any file buffer / array buffer universally
 * Handles Excel (.xlsx, .xls), CSV, JSON, TXT, PDF/DOCX binary text dumps
 */
export async function extractEmailsFromFile(file: File): Promise<ExtractionResult> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. If spreadsheet format (xlsx, xls, ods, csv)
  if (['xlsx', 'xls', 'ods'].includes(extension)) {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      let combinedText = '';

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const csvText = XLSX.utils.sheet_to_csv(sheet);
          combinedText += `\n${csvText}`;
        }
      });

      return extractEmailsFromText(combinedText, file.name);
    } catch (e) {
      console.warn('XLSX parsing failed, falling back to raw buffer scan:', e);
    }
  }

  // 2. Text or JSON/CSV files
  try {
    const text = await file.text();
    if (text && text.length > 0) {
      return extractEmailsFromText(text, file.name);
    }
  } catch (e) {
    // Fall back to binary scan
  }

  // 3. Fallback for any binary file (PDF, docx, bin, logs)
  const arrayBuffer = await file.arrayBuffer();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const rawDecoded = decoder.decode(arrayBuffer);

  return extractEmailsFromText(rawDecoded, file.name);
}
