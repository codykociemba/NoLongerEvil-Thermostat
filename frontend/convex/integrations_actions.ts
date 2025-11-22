"use node";

/**
 * Integrations Actions (Node.js runtime)
 *
 * Uses Node.js crypto for proper password encryption.
 * These actions run in a Node.js environment, not the browser runtime.
 */

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import crypto from "crypto";

// Encryption algorithm and configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard IV length

/**
 * Get encryption key from environment variable
 * In production, this should be a proper secret management solution
 */
function getEncryptionKey(): Buffer {
  const key = process.env.MQTT_ENCRYPTION_KEY || process.env.CONVEX_SITE_URL || 'default-encryption-key-change-me';
  // Derive a 32-byte key using SHA-256
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a password using AES-256-GCM
 */
function encryptPassword(password: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv + authTag + encrypted (all in hex)
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a password using AES-256-GCM
 */
function decryptPassword(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted password format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Upsert integration with encrypted password
 */
export const upsertIntegrationSecure = action({
  args: {
    userId: v.string(),
    type: v.string(),
    enabled: v.boolean(),
    config: v.object({
      brokerUrl: v.optional(v.string()),
      username: v.optional(v.string()),
      password: v.optional(v.string()),
      clientId: v.optional(v.string()),
      topicPrefix: v.optional(v.string()),
      discoveryPrefix: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<{ _id: any; action: string }> => {
    // Encrypt password if provided
    const config = { ...args.config };
    if (config.password) {
      config.password = encryptPassword(config.password);
    }

    // Call the internal mutation with encrypted password
    return await ctx.runMutation(internal.integrations.upsertIntegrationDirect as any, {
      userId: args.userId,
      type: args.type,
      enabled: args.enabled,
      config,
    });
  },
});

/**
 * Get integration with decrypted password
 */
export const getIntegrationSecure = action({
  args: {
    userId: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    // Get integration from database
    const integration = await ctx.runQuery(internal.integrations.getIntegrationDirect as any, {
      userId: args.userId,
      type: args.type,
    });

    if (!integration) {
      return null;
    }

    // Decrypt password before returning
    const config = { ...integration.config };
    if (config.password) {
      try {
        config.password = decryptPassword(config.password);
      } catch (error) {
        console.error('Failed to decrypt password:', error);
        config.password = ''; // Return empty if decryption fails
      }
    }

    return {
      ...integration,
      config,
    };
  },
});

/**
 * Get all enabled MQTT integrations with decrypted passwords
 * Used by server at startup
 */
export const getAllEnabledMqttIntegrationsSecure = action({
  args: {},
  handler: async (ctx): Promise<any[]> => {
    // Get all enabled MQTT integrations
    const integrations = await ctx.runQuery(internal.integrations.getAllEnabledMqttIntegrationsDirect as any);

    // Decrypt passwords
    return integrations.map((integration: any) => {
      const config = { ...integration.config };
      if (config.password) {
        try {
          config.password = decryptPassword(config.password);
        } catch (error) {
          console.error(`Failed to decrypt password for user ${integration.userId}:`, error);
          config.password = '';
        }
      }

      return {
        userId: integration.userId,
        config,
      };
    });
  },
});
