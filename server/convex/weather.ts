import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getWeather = query({
  args: { postalCode: v.string(), country: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("weather")
      .withIndex("by_location", (q) =>
        q.eq("postalCode", args.postalCode).eq("country", args.country)
      )
      .first();
    return row;
  },
});

export const getWeatherBySerial = query({
  args: { serial: v.string() },
  handler: async (ctx, args) => {
    // Get device state to find postal_code
    const deviceState = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", args.serial).eq("object_key", `device.${args.serial}`)
      )
      .first();

    if (!deviceState?.value?.postal_code) {
      return null;
    }

    const postalCode = deviceState.value.postal_code;

    const allWeather = await ctx.db.query("weather").collect();

    for (const weather of allWeather) {
      if (weather.postalCode === postalCode) {
        return weather;
      }
      if (weather.postalCode.startsWith(postalCode + ",")) {
        return weather;
      }
      if (postalCode.startsWith(weather.postalCode + ",")) {
        return weather;
      }
    }

    return null;
  },
});

export const upsertWeather = mutation({
  args: {
    postalCode: v.string(),
    country: v.string(),
    fetchedAt: v.number(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weather")
      .withIndex("by_location", (q) =>
        q.eq("postalCode", args.postalCode).eq("country", args.country)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fetchedAt: args.fetchedAt,
        data: args.data,
      });
      return { updated: true };
    } else {
      await ctx.db.insert("weather", {
        postalCode: args.postalCode,
        country: args.country,
        fetchedAt: args.fetchedAt,
        data: args.data,
      });
      return { inserted: true };
    }
  },
});
