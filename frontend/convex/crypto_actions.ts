"use node";

/**
 * Cryptography Actions (Node.js runtime)
 *
 * All encryption/decryption operations using AES-256-GCM.
 * This runs in Node.js environment for proper crypto support.
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import crypto from "crypto";

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment
 * In production, use a proper secrets manager
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.ENCRYPTION_KEY || 'CHANGE-THIS-KEY-IN-PRODUCTION';

  if (keyString === 'CHANGE-THIS-KEY-IN-PRODUCTION') {
    console.warn('[SECURITY WARNING] Using default encryption key! Set ENCRYPTION_KEY environment variable.');
  }

  // Derive 256-bit key using PBKDF2
  return crypto.pbkdf2Sync(keyString, 'nolongerevil-salt', 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt data using AES-256-GCM
 * Returns: base64(iv:authTag:encrypted)
 */
export const encrypt = action({
  args: {
    plaintext: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(args.plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Combine: iv + authTag + encrypted (all base64 encoded)
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'base64')
    ]);

    return combined.toString('base64');
  },
});

/**
 * Decrypt data using AES-256-GCM
 */
export const decrypt = action({
  args: {
    ciphertext: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const key = getEncryptionKey();
    const combined = Buffer.from(args.ciphertext, 'base64');

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  },
});

/**
 * Generate cryptographically secure API key
 * Format: sk-proj-{64 hex chars}
 */
export const generateSecureApiKey = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    const randomBytes = crypto.randomBytes(32); // 256 bits
    const randomHex = randomBytes.toString('hex');
    return `sk-proj-${randomHex}`;
  },
});

/**
 * Hash data using SHA-256 (for API key lookup)
 */
export const hashSHA256 = action({
  args: {
    data: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    return crypto.createHash('sha256').update(args.data).digest('hex');
  },
});
