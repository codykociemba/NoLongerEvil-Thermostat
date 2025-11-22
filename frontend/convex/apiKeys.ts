/**
 * API Keys Management
 *
 * Developer API keys for accessing the NoLongerEvil API programmatically.
 * Keys can be used for:
 * - REST API access
 * - MQTT integration
 * - Webhooks
 * - Future integrations
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Generate a new API key
 * Returns the plaintext key ONCE - it won't be stored or shown again
 */
export const generateApiKey = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    permissions: v.optional(v.object({
      serials: v.optional(v.array(v.string())),
      scopes: v.optional(v.array(v.string())),
    })),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;

    const randomBytes = new Uint8Array(32); // 32 bytes = 64 hex chars
    crypto.getRandomValues(randomBytes);
    const randomPart = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const key = `sk-proj-${randomPart}`;

    // Create SHA-256 hash for storage using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const keyPreview = key.substring(0, 16) + "..." + key.substring(key.length - 4);

    const permissions = {
      serials: args.permissions?.serials || [],
      scopes: args.permissions?.scopes || ["read", "write", "control"],
    };

    await ctx.db.insert("apiKeys", {
      keyHash,
      keyPreview,
      userId,
      name: args.name,
      permissions,
      createdAt: Date.now(),
      expiresAt: args.expiresAt,
    });

    // Return the plaintext key (only time it's shown)
    return {
      key, // Full plaintext key
      preview: keyPreview,
      name: args.name,
    };
  },
});

/**
 * Validate an API key and return user context
 * Used by server-side middleware for authentication
 */
export const validateApiKey = mutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    // Hash the provided key using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(args.key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Look up the key
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
      .first();

    if (!apiKey) {
      return null; // Invalid key
    }

    // Check if expired
    if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) {
      return null; // Expired
    }

    // Update last used timestamp
    await ctx.db.patch(apiKey._id, {
      lastUsedAt: Date.now(),
    });

    // Return user context
    return {
      userId: apiKey.userId,
      permissions: apiKey.permissions,
      keyId: apiKey._id,
    };
  },
});

/**
 * List all API keys for the current user
 */
export const listApiKeys = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Return safe representation (no hashes)
    return keys.map((key) => ({
      id: key._id,
      name: key.name,
      preview: key.keyPreview,
      permissions: key.permissions,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
    }));
  },
});

/**
 * Revoke an API key
 */
export const revokeApiKey = mutation({
  args: {
    userId: v.string(),
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;

    // Verify ownership
    const apiKey = await ctx.db.get(args.keyId);
    if (!apiKey || apiKey.userId !== userId) {
      throw new Error("API key not found or access denied");
    }

    // Delete the key
    await ctx.db.delete(args.keyId);

    return { success: true };
  },
});

/**
 * Check if user has permission to access a device via API key
 */
export const checkApiKeyPermission = query({
  args: {
    userId: v.string(),
    serial: v.string(),
    requiredScopes: v.array(v.string()),
    permissions: v.object({
      serials: v.array(v.string()),
      scopes: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Check if device is in allowed serials list (empty = all devices)
    if (args.permissions.serials.length > 0 && !args.permissions.serials.includes(args.serial)) {
      return false;
    }

    // Check if user owns the device
    const ownership = await ctx.db
      .query("deviceOwners")
      .withIndex("by_serial", (q) => q.eq("serial", args.serial))
      .first();

    if (ownership && ownership.userId === args.userId) {
      // User owns the device, check scopes
      return args.requiredScopes.every((scope) => args.permissions.scopes.includes(scope));
    }

    // Check if device is shared with the user
    const share = await ctx.db
      .query("deviceShares")
      .withIndex("by_serial", (q) => q.eq("serial", args.serial))
      .filter((q) => q.eq(q.field("sharedWithUserId"), args.userId))
      .first();

    if (share) {
      // User has shared access, check both share permissions and API key scopes
      const hasSharePermission = args.requiredScopes.every((scope) => {
        if (scope === "read") return true; // All shares have read
        if (scope === "write" || scope === "control") {
          return share.permissions.includes("control");
        }
        return false;
      });

      const hasKeyScope = args.requiredScopes.every((scope) => args.permissions.scopes.includes(scope));

      return hasSharePermission && hasKeyScope;
    }

    return false; // No access
  },
});
