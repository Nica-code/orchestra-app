// AES-256-GCM encryption for secrets at rest (SMTP passwords).
import 'server-only';
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be set to a 32-character string');
  }
  return Buffer.from(key, 'utf-8'); // 32 bytes
}

/**
 * Encrypts plaintext. Returns the ciphertext (with auth tag appended,
 * hex-encoded as "<cipher>:<authTag>") and the IV separately.
 */
export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: `${ciphertext.toString('hex')}:${authTag.toString('hex')}`,
    iv: iv.toString('hex'),
  };
}

/** Decrypts a value produced by encrypt(). Throws if tampered or wrong key. */
export function decrypt(encrypted: string, iv: string): string {
  const [cipherHex, authTagHex] = encrypted.split(':');
  if (!cipherHex || !authTagHex) throw new Error('Malformed encrypted value');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf-8');
}
