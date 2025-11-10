import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const upsert = mutation({
  args: {
    serial: v.string(),
    session: v.string(),
    endpoint: v.string(),
    startedAt: v.number(),
    client: v.optional(v.any()),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session", (q) => q.eq("serial", args.serial).eq("session", args.session))
      .first();
    const now = Math.floor(Date.now() / 1000);
    if (existing) {
      await ctx.db.patch(existing._id, { lastActivity: now, open: true });
      return { updated: true };
    } else {
      await ctx.db.insert("sessions", {
        serial: args.serial,
        session: args.session,
        endpoint: args.endpoint,
        startedAt: args.startedAt,
        lastActivity: now,
        open: true,
        client: args.client,
        meta: args.meta,
      });
      return { inserted: true };
    }
  },
});

export const heartbeat = mutation({
  args: { serial: v.string(), session: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session", (q) => q.eq("serial", args.serial).eq("session", args.session))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastActivity: Math.floor(Date.now() / 1000), open: true });
    }
    return { ok: true };
  },
});

export const close = mutation({
  args: { serial: v.string(), session: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session", (q) => q.eq("serial", args.serial).eq("session", args.session))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { open: false, lastActivity: Math.floor(Date.now() / 1000) });
      return { closed: true };
    }
    return { ok: true };
  },
});
