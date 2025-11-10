import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const append = mutation({
  args: {
    route: v.string(),
    serial: v.optional(v.string()),
    req: v.any(),
    res: v.any(),
    ts: v.number(), // epoch ms
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("logs", {
      ts: args.ts,
      route: args.route,
      serial: args.serial,
      req: args.req,
      res: args.res,
    });
    return { ok: true };
  },
});
