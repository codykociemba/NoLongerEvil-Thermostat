import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

function randomEntryKey(): string {
  const digits = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  const letters = Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join("");
  return `${digits}${letters}`;
}

export const ensureUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) {
      if (existing.email !== args.email) {
        await ctx.db.patch(existing._id, { email: args.email });
      }
      return existing;
    }

    const now = Date.now();
    const id = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      createdAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const generateEntryKey = mutation({
  args: {
    serial: v.string(),
    ttlSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ttl = args.ttlSeconds ?? 3600;
    const nowMs = Date.now();
    const nowSeconds = Math.floor(nowMs / 1000);
    const expiresAt = nowSeconds + ttl;

    // Delete all existing entry keys for this serial (both expired and active)
    const existingKeys = await ctx.db
      .query("entryKeys")
      .withIndex("by_serial", (q) => q.eq("serial", args.serial))
      .collect();

    for (const key of existingKeys) {
      await ctx.db.delete(key._id);
    }

    let attempts = 0;
    let codeDoc: any = null;
    let code: string | undefined;

    while (attempts < 20) {
      attempts += 1;
      code = randomEntryKey();
      codeDoc = await ctx.db
        .query("entryKeys")
        .withIndex("by_code", (q) => q.eq("code", code!))
        .first();

      if (!codeDoc) break;

      const expired = codeDoc.expiresAt < nowSeconds;
      if (expired && !codeDoc.claimedBy) {
        break;
      }

      code = undefined;
    }

    if (!code) {
      throw new Error("Unable to allocate entry key");
    }

    if (codeDoc) {
      await ctx.db.patch(codeDoc._id, {
        serial: args.serial,
        createdAt: nowMs,
        expiresAt,
        claimedBy: undefined,
        claimedAt: undefined,
      });
    } else {
      await ctx.db.insert("entryKeys", {
        code,
        serial: args.serial,
        createdAt: nowMs,
        expiresAt,
      });
    }

    return { code, expiresAt };
  },
});

export const claimEntryKey = mutation({
  args: {
    code: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const code = args.code.toUpperCase();
    const nowMs = Date.now();
    const nowSeconds = Math.floor(nowMs / 1000);

    const entry = await ctx.db
      .query("entryKeys")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    if (!entry) {
      throw new Error("Invalid entry key");
    }

    if (entry.claimedBy && entry.claimedBy !== args.userId) {
      throw new Error("Entry key already claimed");
    }

    if (entry.expiresAt < nowSeconds) {
      throw new Error("Entry key expired");
    }

    await ctx.db.patch(entry._id, {
      claimedBy: args.userId,
      claimedAt: nowMs,
    });

    const existingOwner = await ctx.db
      .query("deviceOwners")
      .withIndex("by_serial", (q) => q.eq("serial", entry.serial))
      .first();

    if (existingOwner && existingOwner.userId !== args.userId) {
      throw new Error("Device already linked to another account");
    }

    if (!existingOwner) {
      await ctx.db.insert("deviceOwners", {
        serial: entry.serial,
        userId: args.userId,
        createdAt: nowMs,
      });
    } else if (existingOwner.userId === args.userId) {
      // ensure createdAt is set
      if (!existingOwner.createdAt) {
        await ctx.db.patch(existingOwner._id, { createdAt: nowMs });
      }
    }

    // Get user info for creating user state object
    const userRecord = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.userId))
      .first();

    const userEmail = userRecord?.email ?? "";

    // Strip "user_" prefix from clerkId to get USERID
    const userId = args.userId.replace(/^user_/, "");

    // Initialize device alert dialog state if it doesn't exist
    const alertDialogKey = `device_alert_dialog.${entry.serial}`;
    const existingAlertDialog = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", entry.serial).eq("object_key", alertDialogKey)
      )
      .first();

    if (!existingAlertDialog) {
      await ctx.db.insert("states", {
        serial: entry.serial,
        object_key: alertDialogKey,
        object_revision: 1,
        object_timestamp: nowMs,
        value: {
          dialog_data: "",
          dialog_id: "confirm-pairing"
        },
        updatedAt: nowMs,
      });
    }

    // Initialize user state object if it doesn't exist
    const userStateKey = `user.${userId}`;
    const existingUserState = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", entry.serial).eq("object_key", userStateKey)
      )
      .first();

    if (!existingUserState) {
      await ctx.db.insert("states", {
        serial: entry.serial,
        object_key: userStateKey,
        object_revision: 1,
        object_timestamp: nowMs,
        value: {
          acknowledged_onboarding_screens: ["rcs"],
          email: userEmail,
          name: "",
          obsidian_version: "5.58rc3",
          profile_image_url: "",
          short_name: "",
          structure_memberships: [
            {
              roles: ["owner"],
            },
          ],
        },
        updatedAt: nowMs,
      });
    }

    return { serial: entry.serial };
  },
});

export const listUserDevices = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return rows.map((row) => ({
      serial: row.serial,
      linkedAt: row.createdAt,
    }));
  },
});

// Cron job: Clean up expired entry keys
export const cleanupExpiredKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Get all entry keys
    const allKeys = await ctx.db.query("entryKeys").collect();

    let deletedCount = 0;
    for (const key of allKeys) {
      // Delete if expired (regardless of claimed status)
      if (key.expiresAt <= nowSeconds) {
        await ctx.db.delete(key._id);
        deletedCount++;
      }
    }

    console.log(`[CRON] Cleaned up ${deletedCount} expired entry keys`);
    return { deletedCount };
  },
});

// Ensure device_alert_dialog and user state exists for a specific device
export const ensureDeviceAlertDialog = mutation({
  args: { serial: v.string() },
  handler: async (ctx, args) => {
    const nowMs = Date.now();

    let dialogCreated = false;
    let userCreated = false;

    // Check if alert dialog state already exists
    const alertDialogKey = `device_alert_dialog.${args.serial}`;
    const existingAlertDialog = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", args.serial).eq("object_key", alertDialogKey)
      )
      .first();

    if (!existingAlertDialog) {
      // Create the alert dialog state
      await ctx.db.insert("states", {
        serial: args.serial,
        object_key: alertDialogKey,
        object_revision: 1,
        object_timestamp: nowMs,
        value: {
          dialog_data: "",
          dialog_id: "confirm-pairing"
        },
        updatedAt: nowMs,
      });
      dialogCreated = true;
    }

    // Check if this device has an owner and create user state if needed
    const deviceOwner = await ctx.db
      .query("deviceOwners")
      .withIndex("by_serial", (q) => q.eq("serial", args.serial))
      .first();

    if (deviceOwner) {
      // Get user info
      const userRecord = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", deviceOwner.userId))
        .first();

      const userEmail = userRecord?.email ?? "";
      const userId = deviceOwner.userId.replace(/^user_/, "");
      const userStateKey = `user.${userId}`;

      // Check if user state already exists
      const existingUserState = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", args.serial).eq("object_key", userStateKey)
        )
        .first();

      if (!existingUserState) {
        await ctx.db.insert("states", {
          serial: args.serial,
          object_key: userStateKey,
          object_revision: 1,
          object_timestamp: nowMs,
          value: {
            acknowledged_onboarding_screens: ["rcs"],
            email: userEmail,
            name: "",
            obsidian_version: "5.58rc3",
            profile_image_url: "",
            short_name: "",
            structure_memberships: [
              {
                roles: ["owner"],
              },
            ],
          },
          updatedAt: nowMs,
        });
        userCreated = true;
      }
    }

    return { dialogCreated, userCreated };
  },
});

// Backfill device_alert_dialog and user states for all linked devices
export const backfillDeviceAlertDialogs = mutation({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();

    // Get all device owners
    const allDevices = await ctx.db.query("deviceOwners").collect();

    let dialogsCreated = 0;
    let dialogsSkipped = 0;
    let usersCreated = 0;
    let usersSkipped = 0;

    for (const device of allDevices) {
      // Backfill device_alert_dialog
      const alertDialogKey = `device_alert_dialog.${device.serial}`;
      const existingAlertDialog = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", device.serial).eq("object_key", alertDialogKey)
        )
        .first();

      if (!existingAlertDialog) {
        await ctx.db.insert("states", {
          serial: device.serial,
          object_key: alertDialogKey,
          object_revision: 1,
          object_timestamp: nowMs,
          value: {
            dialog_data: "",
            dialog_id: "confirm-pairing"
          },
          updatedAt: nowMs,
        });
        dialogsCreated++;
      } else {
        dialogsSkipped++;
      }

      // Backfill user state
      // Get user info for this device
      const userRecord = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", device.userId))
        .first();

      const userEmail = userRecord?.email ?? "";
      const userId = device.userId.replace(/^user_/, "");
      const userStateKey = `user.${userId}`;

      const existingUserState = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", device.serial).eq("object_key", userStateKey)
        )
        .first();

      if (!existingUserState) {
        await ctx.db.insert("states", {
          serial: device.serial,
          object_key: userStateKey,
          object_revision: 1,
          object_timestamp: nowMs,
          value: {
            acknowledged_onboarding_screens: ["rcs"],
            email: userEmail,
            name: "",
            obsidian_version: "5.58rc3",
            profile_image_url: "",
            short_name: "",
            structure_memberships: [
              {
                roles: ["owner"],
              },
            ],
          },
          updatedAt: nowMs,
        });
        usersCreated++;
      } else {
        usersSkipped++;
      }
    }

    console.log(`[BACKFILL] Dialogs: created ${dialogsCreated}, skipped ${dialogsSkipped}; Users: created ${usersCreated}, skipped ${usersSkipped}`);
    return {
      dialogsCreated,
      dialogsSkipped,
      usersCreated,
      usersSkipped,
      total: allDevices.length
    };
  },
});
