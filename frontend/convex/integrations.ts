/**
 * Integrations Management
 *
 * Manages integration configurations for MQTT, webhooks, and other services.
 * Passwords are encrypted using AES-256-GCM via crypto_actions.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

/**
 * Upsert integration configuration
 */
export const upsertIntegrationDirect = internalMutation({
  args: {
    userId: v.string(),
    type: v.string(),
    enabled: v.boolean(),
    config: v.object({
      brokerUrl: v.optional(v.string()),
      username: v.optional(v.string()),
      password: v.optional(v.string()), // Already encrypted by action
      clientId: v.optional(v.string()),
      topicPrefix: v.optional(v.string()),
      discoveryPrefix: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Check if integration already exists
    const existing = await ctx.db
      .query("integrations")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        config: args.config,
        updatedAt: now,
      });
      return { _id: existing._id, action: "updated" };
    } else {
      // Create new
      const id = await ctx.db.insert("integrations", {
        userId: args.userId,
        type: args.type,
        enabled: args.enabled,
        config: args.config,
        createdAt: now,
        updatedAt: now,
      });
      return { _id: id, action: "created" };
    }
  },
});

/**
 * Get integration (INTERNAL - returns encrypted password)
 */
export const getIntegrationDirect = internalQuery({
  args: {
    userId: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .first();

    if (!integration) {
      return null;
    }

    return {
      _id: integration._id,
      type: integration.type,
      enabled: integration.enabled,
      config: integration.config, // Password is encrypted
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  },
});

/**
 * Get integration configuration (public - without sensitive data)
 */
export const getIntegration = query({
  args: {
    userId: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .first();

    if (!integration) {
      return null;
    }

    // Return config WITHOUT password
    const { password, ...safeConfig } = integration.config;

    return {
      _id: integration._id,
      type: integration.type,
      enabled: integration.enabled,
      config: safeConfig,
      hasPassword: !!password,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  },
});

/**
 * List all integrations for current user
 */
export const listIntegrations = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // No "by_user" index exists, so we query all and filter
    const allIntegrations = await ctx.db.query("integrations").collect();
    const integrations = allIntegrations.filter((i) => i.userId === args.userId);

    // Return summary without sensitive data
    return integrations.map((integration) => ({
      _id: integration._id,
      type: integration.type,
      enabled: integration.enabled,
      hasConfig: Object.keys(integration.config).length > 0,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    }));
  },
});

/**
 * Delete integration configuration
 */
export const deleteIntegration = mutation({
  args: {
    userId: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the integration
    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .first();

    if (!integration) {
      throw new Error("Integration not found");
    }

    // Verify ownership
    if (integration.userId !== args.userId) {
      throw new Error("Access denied");
    }

    await ctx.db.delete(integration._id);
    return { success: true };
  },
});

/**
 * Toggle integration enabled status
 */
export const toggleIntegration = mutation({
  args: {
    userId: v.string(),
    type: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Find the integration
    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .first();

    if (!integration) {
      throw new Error("Integration not found");
    }

    // Verify ownership
    if (integration.userId !== args.userId) {
      throw new Error("Access denied");
    }

    await ctx.db.patch(integration._id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get all enabled MQTT integrations (INTERNAL - returns encrypted passwords)
 * Called by server to load active integrations
 */
export const getAllEnabledMqttIntegrationsDirect = internalQuery({
  args: {},
  handler: async (ctx) => {
    const integrations = await ctx.db
      .query("integrations")
      .withIndex("by_type", (q) => q.eq("type", "mqtt"))
      .filter((q) => q.eq(q.field("enabled"), true))
      .collect();

    return integrations.map((integration) => ({
      userId: integration.userId,
      config: integration.config, // Password is still encrypted
    }));
  },
});
