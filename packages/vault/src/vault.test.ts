import { describe, it, expect } from 'vitest';
import { Vault } from './vault.js';
import { randomBytes } from 'node:crypto';

describe('Vault (AES-256-GCM)', () => {
  const key1 = randomBytes(32);
  const key2 = randomBytes(32);

  const vault = new Vault({
    activeKeyId: 'k1',
    keys: {
      k1: key1,
      k2: key2,
    },
  });

  const aad = 'usr_123:gmail_refresh_token';
  const secretText = '1//0gRefreshTokenSecureValue1234567890';

  it('performs round-trip encryption and decryption successfully', () => {
    const encrypted = vault.encrypt(secretText, aad);
    expect(typeof encrypted).toBe('string');
    expect(encrypted.startsWith('k1.')).toBe(true);

    const decrypted = vault.decrypt(encrypted, aad);
    expect(decrypted).toBe(secretText);
  });

  it('generates unique ciphertexts and IVs for identical plaintexts', () => {
    const enc1 = vault.encrypt(secretText, aad);
    const enc2 = vault.encrypt(secretText, aad);
    expect(enc1).not.toBe(enc2);

    expect(vault.decrypt(enc1, aad)).toBe(secretText);
    expect(vault.decrypt(enc2, aad)).toBe(secretText);
  });

  it('fails decryption if ciphertext is tampered with', () => {
    const encrypted = vault.encrypt(secretText, aad);
    const parts = encrypted.split('.');
    // Flip characters in the ciphertext part
    const tamperedCipher = parts[3].slice(0, -2) + (parts[3].endsWith('a') ? 'b' : 'a');
    parts[3] = tamperedCipher;
    const tamperedBlob = parts.join('.');

    expect(() => vault.decrypt(tamperedBlob, aad)).toThrow(/Vault decryption failed/);
  });

  it('fails decryption if AAD differs (e.g., mismatched user ID or purpose)', () => {
    const encrypted = vault.encrypt(secretText, 'userA:gmail_token');

    // Attempting to decrypt with userB or different purpose must fail
    expect(() => vault.decrypt(encrypted, 'userB:gmail_token')).toThrow(/Vault decryption failed/);
    expect(() => vault.decrypt(encrypted, 'userA:other_purpose')).toThrow(/Vault decryption failed/);
  });

  it('fails decryption if encrypted with an unknown key', () => {
    const anotherKey = randomBytes(32);
    const separateVault = new Vault({
      activeKeyId: 'k_unknown',
      keys: { k_unknown: anotherKey },
    });

    const encrypted = separateVault.encrypt(secretText, aad);
    expect(() => vault.decrypt(encrypted, aad)).toThrow(/Unknown encryption key ID: "k_unknown"/);
  });

  it('supports key rotation (decrypting older keys while encrypting with new key)', () => {
    // Encrypt with k1
    const blobK1 = vault.encrypt(secretText, aad);

    // Create vault where active key is rotated to k2, but k1 is still present
    const rotatedVault = new Vault({
      activeKeyId: 'k2',
      keys: {
        k1: key1,
        k2: key2,
      },
    });

    // Decrypting k1 blob with rotated vault works
    expect(rotatedVault.decrypt(blobK1, aad)).toBe(secretText);

    // New encryption uses k2
    const blobK2 = rotatedVault.encrypt(secretText, aad);
    expect(blobK2.startsWith('k2.')).toBe(true);
    expect(rotatedVault.decrypt(blobK2, aad)).toBe(secretText);
  });
});
