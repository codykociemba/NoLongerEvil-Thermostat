import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function mergeValues(current: any, incoming: any): any {
  if (incoming === undefined) {
    return current;
  }
  if (current === undefined) {
    return incoming;
  }
  const isObject = (val: any) => val !== null && typeof val === "object" && !Array.isArray(val);
  if (!isObject(current) || !isObject(incoming)) {
    return incoming;
  }
  const result: Record<string, any> = { ...current };
  for (const key of Object.keys(incoming)) {
    result[key] = mergeValues((current as any)[key], incoming[key]);
  }
  return result;
}


export const upsertState = mutation({
  args: {
    serial: v.string(),
    object_key: v.string(),
    object_revision: v.number(),
    object_timestamp: v.number(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("states")
      .withIndex("by_key", (q) => q.eq("serial", args.serial).eq("object_key", args.object_key))
      .first();
    const updatedAt = Date.now();
    if (existing) {
      const mergedValue = mergeValues(existing.value ?? {}, args.value ?? {});
      await ctx.db.patch(existing._id, {
        object_revision: args.object_revision,
        object_timestamp: args.object_timestamp,
        value: mergedValue,
        updatedAt,
      });
      return { updated: true };
    } else {
      await ctx.db.insert("states", { ...args, value: args.value ?? {}, updatedAt });
      return { inserted: true };
    }
  },
});

export const getState = query({
  args: { serial: v.string(), object_key: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("states")
      .withIndex("by_key", (q) => q.eq("serial", args.serial).eq("object_key", args.object_key))
      .first();
    return row;
  },
});

export const getDeviceState = query({
  args: { serial: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("states")
      .withIndex("by_serial", (q) => q.eq("serial", args.serial))
      .collect();
    return rows;
  },
});

export const getAllState = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("states").collect();
    const deviceState: Record<string, Record<string, any>> = {};
    const devices = new Set<string>();

    for (const row of rows) {
      const serial = row.serial;
      devices.add(serial);
      const bucket = (deviceState[serial] ||= {});
      bucket[row.object_key] = {
        object_revision: row.object_revision,
        object_timestamp: row.object_timestamp,
        value: row.value,
        updatedAt: row.updatedAt,
      };
    }

    return {
      devices: Array.from(devices),
      deviceState,
    };
  },
});
