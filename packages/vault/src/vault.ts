import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface VaultOptions {
  activeKeyId: string;
  keys: Record<string, Buffer>;
}

export class Vault {
  private activeKeyId: string;
  private keys: Map<string, Buffer>;

  constructor(options?: Partial<VaultOptions>) {
    this.keys = new Map();

    if (options?.keys) {
      for (const [keyId, keyBuf] of Object.entries(options.keys)) {
        if (keyBuf.length !== 32) {
          throw new Error(`Key ${keyId} must be exactly 32 bytes`);
        }
        this.keys.set(keyId, keyBuf);
      }
    } else {
      // Default from environment variables
      const envKeyB64 = process.env.APP_ENCRYPTION_KEY;
      const envKeyId = process.env.APP_ENCRYPTION_KEY_ID || 'k1';
      if (envKeyB64) {
        const keyBuf = Buffer.from(envKeyB64, 'base64');
        if (keyBuf.length !== 32) {
          throw new Error('APP_ENCRYPTION_KEY must be exactly 32 bytes');
        }
        this.keys.set(envKeyId, keyBuf);
      }
    }

    this.activeKeyId = options?.activeKeyId || process.env.APP_ENCRYPTION_KEY_ID || 'k1';

    if (this.keys.size > 0 && !this.keys.has(this.activeKeyId)) {
      throw new Error(`Active key ID "${this.activeKeyId}" not found in available keys`);
    }
  }

  /**
   * Encrypts plaintext using AES-256-GCM with Additional Authenticated Data (AAD)
   * Stored format: keyId.iv.authTag.ciphertext (base64url encoded parts)
   */
  public encrypt(plaintext: string, aad: string): string {
    const key = this.keys.get(this.activeKeyId);
    if (!key) {
      throw new Error(`Encryption failed: active key "${this.activeKeyId}" is not loaded`);
    }

    if (!aad || typeof aad !== 'string') {
      throw new Error('AAD (userId:purpose) is mandatory for vault encryption');
    }

    const iv = randomBytes(12); // 12-byte random IV for GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));

    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      this.activeKeyId,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  /**
   * Decrypts blob using AES-256-GCM verifying AAD and auth tag
   */
  public decrypt(blob: string, aad: string): string {
    if (!blob || typeof blob !== 'string') {
      throw new Error('Invalid vault blob');
    }

    if (!aad || typeof aad !== 'string') {
      throw new Error('AAD (userId:purpose) is mandatory for vault decryption');
    }

    const parts = blob.split('.');
    if (parts.length !== 4) {
      throw new Error('Malformed vault blob format');
    }

    const [keyId, ivB64, authTagB64, cipherB64] = parts;
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Unknown encryption key ID: "${keyId}"`);
    }

    try {
      const iv = Buffer.from(ivB64, 'base64url');
      const authTag = Buffer.from(authTagB64, 'base64url');
      const ciphertext = Buffer.from(cipherB64, 'base64url');

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      throw new Error('Vault decryption failed (tampered data, invalid key, or mismatched AAD)');
    }
  }

  public getActiveKeyId(): string {
    return this.activeKeyId;
  }

  /**
   * Re-encrypts ciphertext with the current active key if it was encrypted with an older key.
   */
  public reencrypt(blob: string, aad: string): string {
    const parts = blob.split('.');
    if (parts.length === 4 && parts[0] === this.activeKeyId) {
      return blob; // Already encrypted with current active key
    }
    const plaintext = this.decrypt(blob, aad);
    return this.encrypt(plaintext, aad);
  }
}


// Global default singleton helper
let defaultVault: Vault | null = null;

export function getVault(): Vault {
  if (!defaultVault) {
    defaultVault = new Vault();
  }
  return defaultVault;
}

export function encrypt(plaintext: string, aad: string): string {
  return getVault().encrypt(plaintext, aad);
}

export function decrypt(blob: string, aad: string): string {
  return getVault().decrypt(blob, aad);
}
