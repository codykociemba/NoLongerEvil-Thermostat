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
    createdAt: v.number(), // epoch ms
    expiresAt: v.number(), // epoch ms
    claimedBy: v.optional(v.string()),
    claimedAt: v.optional(v.number()), // epoch ms
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

  deviceShares: defineTable({
    ownerId: v.string(), // Clerk ID of device owner
    sharedWithUserId: v.string(), // Clerk ID of user with access
    serial: v.string(), // Device serial number
    permissions: v.array(v.string()), // ["view", "control"]
    createdAt: v.number(), // When share was accepted
  })
    .index("by_owner", ["ownerId"])
    .index("by_shared_user", ["sharedWithUserId"])
    .index("by_serial", ["serial"])
    .index("by_owner_serial", ["ownerId", "serial"]),

  deviceShareInvites: defineTable({
    ownerId: v.string(), // Clerk ID of inviter
    email: v.string(), // Email address invited
    serial: v.string(), // Device serial
    permissions: v.array(v.string()), // ["view", "control"]
    status: v.string(), // "pending", "accepted", "declined", "expired"
    inviteToken: v.string(), // Unique token for acceptance URL
    invitedAt: v.number(), // epoch ms
    acceptedAt: v.optional(v.number()), // epoch ms when accepted
    expiresAt: v.number(), // epoch ms
    sharedWithUserId: v.optional(v.string()), // Set when accepted
  })
    .index("by_token", ["inviteToken"])
    .index("by_email", ["email"])
    .index("by_owner", ["ownerId"])
    .index("by_serial", ["serial"])
    .index("by_status", ["status"]),

  apiKeys: defineTable({
    keyHash: v.string(), // SHA-256 hash of the full API key
    keyPreview: v.string(), // First 8-12 chars for display (e.g., "nlapi_abc...")
    userId: v.string(), // Clerk ID of the owner
    name: v.string(), // User-friendly name like "Home Assistant", "Node-RED"
    permissions: v.object({
      serials: v.array(v.string()), // Empty array = all owned devices
      scopes: v.array(v.string()), // ["read", "write", "control"]
    }),
    createdAt: v.number(), // epoch ms
    lastUsedAt: v.optional(v.number()), // epoch ms - updated on each use
    expiresAt: v.optional(v.number()), // epoch ms - null = never expires
  })
    .index("by_user", ["userId"])
    .index("by_key_hash", ["keyHash"]),

  integrations: defineTable({
    userId: v.string(), // Clerk ID
    type: v.string(), // "mqtt", "webhook", "websocket", etc.
    enabled: v.boolean(), // User can disable without deleting config
    config: v.object({
      // MQTT-specific fields
      brokerUrl: v.optional(v.string()), // "mqtt://localhost:1883"
      username: v.optional(v.string()),
      password: v.optional(v.string()), // Encrypted
      clientId: v.optional(v.string()), // "nolongerevil-{userId}"
      topicPrefix: v.optional(v.string()), // "nest" (default), base topic for all MQTT messages
      discoveryPrefix: v.optional(v.string()), // "homeassistant" (default), HA discovery prefix
      publishRaw: v.optional(v.boolean()), // true (default), publish raw nest objects to {prefix}/{serial}/{object_key}
      homeAssistantDiscovery: v.optional(v.boolean()), // false (default), publish HA-formatted discovery + state
      // Future: webhook URLs, WebSocket endpoints, etc.
    }),
    createdAt: v.number(), // epoch ms
    updatedAt: v.number(), // epoch ms
  })
    .index("by_user_type", ["userId", "type"])
    .index("by_type", ["type"])
    .index("by_enabled", ["enabled"]),
});
