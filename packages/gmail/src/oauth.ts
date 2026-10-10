import { google, Auth } from 'googleapis';
import { randomBytes, createHash } from 'node:crypto';

export type OAuth2Client = Auth.OAuth2Client;

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function createOAuth2Client(config: GoogleOAuthConfig): OAuth2Client {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

export function generateAuthUrl(
  client: OAuth2Client,
  state: string,
  codeChallenge?: string
): string {
  const options: any = {
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
  };

  if (codeChallenge) {
    options.code_challenge = codeChallenge;
    options.code_challenge_method = 'S256';
  }

  return client.generateAuthUrl(options);
}

export async function exchangeCodeForTokens(
  client: OAuth2Client,
  code: string,
  codeVerifier?: string
) {
  const { tokens } = await client.getToken({
    code,
    codeVerifier,
  });
  return tokens;
}

export async function revokeToken(client: OAuth2Client, token: string): Promise<void> {
  try {
    await client.revokeToken(token);
  } catch {
    // Best-effort revocation
  }
}
