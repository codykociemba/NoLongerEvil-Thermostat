import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  states: defineTable({
    serial: v.string(),
    object_key: v.string(),
    object_revision: v.number(),
    object_timestamp: v.number(),
    value: v.any(),
    updatedAt: v.number(),
  })
    .index("by_serial", ["serial"])
    .index("by_key", ["serial", "object_key"]),

  logs: defineTable({
    ts: v.number(), // epoch ms
    route: v.string(),
    serial: v.optional(v.string()),
    req: v.any(),
    res: v.any(),
  }).index("by_serial_ts", ["serial", "ts"]),

  sessions: defineTable({
    serial: v.string(),
    session: v.string(),
    endpoint: v.string(),
    startedAt: v.number(),
    lastActivity: v.number(),
    open: v.boolean(),
    client: v.optional(v.any()),
    meta: v.optional(v.any()),
  })
    .index("by_serial", ["serial"])
    .index("by_session", ["serial", "session"]),

  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    createdAt: v.number(),
  })
    .index("by_clerk", ["clerkId"])
    .index("by_email", ["email"]),

  entryKeys: defineTable({
    code: v.string(),
    serial: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    claimedBy: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_serial", ["serial"]),

  deviceOwners: defineTable({
    userId: v.string(),
    serial: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_serial", ["serial"]),

  weather: defineTable({
    postalCode: v.string(),
    country: v.string(),
    fetchedAt: v.number(), // epoch ms
    data: v.any(), // weather response JSON
  })
    .index("by_location", ["postalCode", "country"]),
});
