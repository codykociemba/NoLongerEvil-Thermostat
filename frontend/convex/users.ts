import { mutation, query, internalMutation, action } from "./_generated/server";
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
    const expiresAt = nowMs + (ttl * 1000); // Convert TTL seconds to milliseconds

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

      const expired = codeDoc.expiresAt < nowMs;
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

    if (entry.expiresAt < nowMs) {
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

    // Initialize or update device object with structure_id
    const deviceKey = `device.${entry.serial}`;
    const structureId = `structure.${userId}`;
    const structureKey = structureId; // The object_key for the structure state
    const existingDevice = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", entry.serial).eq("object_key", deviceKey)
      )
      .first();

    if (!existingDevice) {
      // Create new device object with structure_id (just the userId, not "structure.userId")
      await ctx.db.insert("states", {
        serial: entry.serial,
        object_key: deviceKey,
        object_revision: 1,
        object_timestamp: nowMs,
        value: {
          structure_id: userId,
        },
        updatedAt: nowMs,
      });
    } else {
      // Update existing device object with structure_id if not present
      const currentValue = existingDevice.value || {};
      if (!currentValue.structure_id) {
        await ctx.db.patch(existingDevice._id, {
          value: {
            ...currentValue,
            structure_id: userId,
          },
          updatedAt: nowMs,
          object_revision: (existingDevice.object_revision || 0) + 1,
          object_timestamp: nowMs,
        });
      }
    }

    // Initialize or update structure state object
    const existingStructure = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", entry.serial).eq("object_key", structureKey)
      )
      .first();

    if (!existingStructure) {
      // Create new structure object
      await ctx.db.insert("states", {
        serial: entry.serial,
        object_key: structureKey,
        object_revision: 1,
        object_timestamp: nowMs,
        value: {
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          postal_code: "",
          country_code: "US",
          address_lines: [],
          city: "",
          state: "",
          user: `user.${userId}`,
          devices: [deviceKey],
          away: false,
          vacation_mode: false,
          manual_away_timestamp: 0,
          away_timestamp: nowMs,
        },
        updatedAt: nowMs,
      });
    } else {
      // Update existing structure object to include this device if not already present
      const currentValue = existingStructure.value || {};
      const devices = currentValue.devices || [];

      if (!devices.includes(deviceKey)) {
        await ctx.db.patch(existingStructure._id, {
          value: {
            ...currentValue,
            devices: [...devices, deviceKey],
          },
          updatedAt: nowMs,
          object_revision: (existingStructure.object_revision || 0) + 1,
          object_timestamp: nowMs,
        });
      }
    }

    // Initialize link object that connects device to structure
    const linkKey = `link.${entry.serial}`;
    const existingLink = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", entry.serial).eq("object_key", linkKey)
      )
      .first();

    if (!existingLink) {
      await ctx.db.insert("states", {
        serial: entry.serial,
        object_key: linkKey,
        object_revision: 1,
        object_timestamp: nowMs,
        value: {
          structure: structureId,
        },
        updatedAt: nowMs,
      });
    } else {
      // Update existing link if structure has changed
      const currentValue = existingLink.value || {};
      if (currentValue.structure !== structureId) {
        await ctx.db.patch(existingLink._id, {
          value: {
            structure: structureId,
          },
          updatedAt: nowMs,
          object_revision: (existingLink.object_revision || 0) + 1,
          object_timestamp: nowMs,
        });
      }
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
          structures: [structureId],
          structure_memberships: [
            {
              structure: structureId,
              roles: ["owner"],
            },
          ],
          away: false, // Initialize as home
          away_timestamp: nowMs,
          away_setter: 1, // Device sets initial status
          vacation_mode: false,
          manual_away_timestamp: 0,
        },
        updatedAt: nowMs,
      });
    } else {
      // If user state exists, ensure it has the structure reference and away fields
      const currentValue = existingUserState.value || {};
      const structures = currentValue.structures || [];
      const structureMemberships = currentValue.structure_memberships || [];

      // Check if this structure is already in the user's structures
      const hasStructure = structures.includes(structureId);
      const hasMembership = structureMemberships.some((m: any) => m.structure === structureId);

      const needsUpdate = !hasStructure || !hasMembership || !('away' in currentValue);

      if (needsUpdate) {
        await ctx.db.patch(existingUserState._id, {
          value: {
            ...currentValue,
            structures: hasStructure ? structures : [...structures, structureId],
            structure_memberships: hasMembership
              ? structureMemberships
              : [...structureMemberships, { structure: structureId, roles: ["owner"] }],
            away: currentValue.away ?? false,
            away_timestamp: currentValue.away_timestamp ?? nowMs,
            away_setter: currentValue.away_setter ?? 1,
            vacation_mode: currentValue.vacation_mode ?? false,
            manual_away_timestamp: currentValue.manual_away_timestamp ?? 0,
          },
          updatedAt: nowMs,
          object_revision: (existingUserState.object_revision || 0) + 1,
          object_timestamp: nowMs,
        });
      }
    }

    return { serial: entry.serial };
  },
});

// Backfill structure_id for existing devices
export const backfillStructureId = mutation({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    let updatedCount = 0;

    // Get all device owners
    const allOwners = await ctx.db.query("deviceOwners").collect();

    // Group devices by user for structure creation
    const devicesByUser = new Map<string, string[]>();

    for (const owner of allOwners) {
      const userId = owner.userId.replace(/^user_/, "");
      const structureId = `structure.${userId}`;
      const structureKey = structureId;
      const deviceKey = `device.${owner.serial}`;

      // Track devices by user
      if (!devicesByUser.has(userId)) {
        devicesByUser.set(userId, []);
      }
      devicesByUser.get(userId)!.push(deviceKey);

      // Check if device object exists and has structure_id
      const deviceState = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", owner.serial).eq("object_key", deviceKey)
        )
        .first();

      if (!deviceState) {
        // Create device object with structure_id (just userId, not "structure.userId")
        await ctx.db.insert("states", {
          serial: owner.serial,
          object_key: deviceKey,
          object_revision: 1,
          object_timestamp: nowMs,
          value: {
            structure_id: userId,
          },
          updatedAt: nowMs,
        });
        updatedCount++;
        console.log(`Created device object for ${owner.serial} with structure_id: ${userId}`);
      } else if (!deviceState.value?.structure_id) {
        // Update existing device object with structure_id (just userId, not "structure.userId")
        await ctx.db.patch(deviceState._id, {
          value: {
            ...(deviceState.value || {}),
            structure_id: userId,
          },
          updatedAt: nowMs,
          object_revision: (deviceState.object_revision || 0) + 1,
          object_timestamp: nowMs,
        });
        updatedCount++;
        console.log(`Updated device ${owner.serial} with structure_id: ${userId}`);
      }
    }

    // Create structure objects for each user
    let structuresCreated = 0;
    for (const [userId, devices] of devicesByUser.entries()) {
      const structureId = `structure.${userId}`;
      const structureKey = structureId;

      // Use the first device's serial for the structure state
      const firstDeviceSerial = devices[0].replace('device.', '');

      // Check if structure already exists
      const existingStructure = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", firstDeviceSerial).eq("object_key", structureKey)
        )
        .first();

      if (!existingStructure) {
        await ctx.db.insert("states", {
          serial: firstDeviceSerial,
          object_key: structureKey,
          object_revision: 1,
          object_timestamp: nowMs,
          value: {
            time_zone: "America/Phoenix",
            postal_code: "",
            country_code: "US",
            address_lines: [],
            city: "",
            state: "",
            user: `user.${userId}`,
            devices: devices,
            away: false,
            vacation_mode: false,
            manual_away_timestamp: 0,
            away_timestamp: nowMs,
          },
          updatedAt: nowMs,
        });
        structuresCreated++;
        console.log(`Created structure ${structureId} with ${devices.length} devices`);
      }
    }

    return {
      success: true,
      message: `Backfilled structure_id for ${updatedCount} devices and created ${structuresCreated} structures`,
      devicesProcessed: allOwners.length,
      devicesUpdated: updatedCount,
      structuresCreated: structuresCreated,
    };
  },
});

// Update user state with weather data
export const updateUserWeather = mutation({
  args: {
    serial: v.string(),
    userId: v.string(), // clerkId with user_ prefix
    weatherData: v.any(),
  },
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const userId = args.userId.replace(/^user_/, "");
    const userStateKey = `user.${userId}`;

    const existingUserState = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", args.serial).eq("object_key", userStateKey)
      )
      .first();

    if (existingUserState) {
      const currentValue = existingUserState.value || {};
      const updatedValue = {
        ...currentValue,
        weather: {
          ...args.weatherData,
          updatedAt: nowMs,
        },
      };

      await ctx.db.patch(existingUserState._id, {
        value: updatedValue,
        updatedAt: nowMs,
        object_revision: (existingUserState.object_revision || 0) + 1,
        object_timestamp: nowMs,
      });

      return { updated: true };
    }

    return { updated: false, error: "User state not found" };
  },
});

// Sync user weather from weather table using postal code from device
export const syncUserWeatherFromDevice = mutation({
  args: {
    userId: v.string(), // clerkId with user_ prefix
  },
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const userId = args.userId.replace(/^user_/, "");

    // Get all devices owned by this user
    const ownedDevices = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (ownedDevices.length === 0) {
      return { updated: false, error: "No devices found" };
    }

    // Try to get postal_code from any device
    let postalCode = null;
    let country = "US";
    let deviceSerial = null;

    for (const deviceOwner of ownedDevices) {
      const deviceKey = `device.${deviceOwner.serial}`;
      const deviceState = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", deviceOwner.serial).eq("object_key", deviceKey)
        )
        .first();

      if (deviceState && deviceState.value && deviceState.value.postal_code) {
        postalCode = deviceState.value.postal_code;
        deviceSerial = deviceOwner.serial;
        // Country might be in device state too, otherwise default to US
        country = deviceState.value.country || "US";
        break;
      }
    }

    if (!postalCode || !deviceSerial) {
      return { updated: false, error: "No postal code found in device state" };
    }

    // Fetch weather from weather table
    const weather = await ctx.db
      .query("weather")
      .withIndex("by_location", (q) =>
        q.eq("postalCode", postalCode).eq("country", country)
      )
      .first();

    if (!weather || !weather.data) {
      return { updated: false, error: "No weather data found for location" };
    }

    // Extract weather data
    const locationKey = `${postalCode},${country}`;
    const weatherInfo = weather.data[locationKey];

    if (!weatherInfo || !weatherInfo.current) {
      return { updated: false, error: "Invalid weather data format" };
    }

    // Update user state on all devices
    const weatherDataToSave = {
      current: weatherInfo.current,
      location: weatherInfo.location,
      updatedAt: nowMs,
    };

    let updatedCount = 0;
    for (const deviceOwner of ownedDevices) {
      const userStateKey = `user.${userId}`;
      const existingUserState = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", deviceOwner.serial).eq("object_key", userStateKey)
        )
        .first();

      if (existingUserState) {
        const currentValue = existingUserState.value || {};
        const updatedValue = {
          ...currentValue,
          weather: weatherDataToSave,
        };

        await ctx.db.patch(existingUserState._id, {
          value: updatedValue,
          updatedAt: nowMs,
          object_revision: (existingUserState.object_revision || 0) + 1,
          object_timestamp: nowMs,
        });

        updatedCount++;
      }
    }

    return {
      updated: true,
      postalCode,
      country,
      devicesUpdated: updatedCount,
    };
  },
});

// Update user away status based on all devices
export const updateUserAwayStatus = mutation({
  args: {
    userId: v.string(), // clerkId with user_ prefix
  },
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const userId = args.userId.replace(/^user_/, "");

    // Get all devices owned by this user
    const ownedDevices = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (ownedDevices.length === 0) {
      return { updated: false, error: "No devices found" };
    }

    // Check away status for each device and find the most recent away change
    let allAway = true;
    let anyDeviceReported = false;
    let mostRecentAwayTimestamp = 0;
    let mostRecentAwaySetter = null;
    let hasVacationMode = false;
    let mostRecentManualAwayTimestamp = 0;

    for (const deviceOwner of ownedDevices) {
      const deviceKey = `device.${deviceOwner.serial}`;
      const deviceState = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", deviceOwner.serial).eq("object_key", deviceKey)
        )
        .first();

      if (deviceState && deviceState.value) {
        anyDeviceReported = true;
        const away = deviceState.value.away;
        const awayTimestamp = deviceState.value.away_timestamp || 0;
        const awaySetter = deviceState.value.away_setter;
        const vacationMode = deviceState.value.vacation_mode || false;
        const manualAwayTimestamp = deviceState.value.manual_away_timestamp || 0;

        // Track vacation mode
        if (vacationMode) {
          hasVacationMode = true;
        }

        // Track most recent timestamps
        if (awayTimestamp > mostRecentAwayTimestamp) {
          mostRecentAwayTimestamp = awayTimestamp;
        }
        if (manualAwayTimestamp > mostRecentManualAwayTimestamp) {
          mostRecentManualAwayTimestamp = manualAwayTimestamp;
          mostRecentAwaySetter = awaySetter;
        }

        // If any device reports away as false (0 or false), user is not away
        if (away === 0 || away === false) {
          allAway = false;
          break;
        }
      }
    }

    // If no devices reported status, default to not away
    const userAway = anyDeviceReported ? allAway : false;

    // Update user state on each device with full away information
    let updatedCount = 0;
    for (const deviceOwner of ownedDevices) {
      const userStateKey = `user.${userId}`;
      const existingUserState = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", deviceOwner.serial).eq("object_key", userStateKey)
        )
        .first();

      if (existingUserState) {
        const currentValue = existingUserState.value || {};
        const updatedValue: any = {
          ...currentValue,
          away: userAway,
          vacation_mode: hasVacationMode,
        };

        // Only include timestamps if they have valid values
        if (mostRecentAwayTimestamp > 0) {
          updatedValue.away_timestamp = mostRecentAwayTimestamp;
        }
        if (mostRecentAwaySetter !== null) {
          updatedValue.away_setter = mostRecentAwaySetter;
        }
        if (mostRecentManualAwayTimestamp > 0) {
          updatedValue.manual_away_timestamp = mostRecentManualAwayTimestamp;
        }

        await ctx.db.patch(existingUserState._id, {
          value: updatedValue,
          updatedAt: nowMs,
          object_revision: (existingUserState.object_revision || 0) + 1,
          object_timestamp: nowMs,
        });

        updatedCount++;
      }
    }

    return {
      updated: true,
      away: userAway,
      away_timestamp: mostRecentAwayTimestamp,
      away_setter: mostRecentAwaySetter,
      vacation_mode: hasVacationMode,
      manual_away_timestamp: mostRecentManualAwayTimestamp,
      devicesUpdated: updatedCount,
    };
  },
});

// Update weather for all users who have devices with this postal code
export const updateWeatherForPostalCode = mutation({
  args: {
    postalCode: v.string(),
    country: v.string(),
    weatherData: v.any(),
  },
  handler: async (ctx, args) => {
    const nowMs = Date.now();

    // Find all devices with this postal code
    const allStates = await ctx.db.query("states").collect();
    const deviceStates = allStates.filter(
      (state) =>
        state.object_key.startsWith("device.") &&
        state.value?.postal_code === args.postalCode &&
        state.value?.country === args.country
    );

    if (deviceStates.length === 0) {
      return { updated: false, usersUpdated: 0 };
    }

    // Get unique device serials
    const deviceSerials = [...new Set(deviceStates.map((s) => s.serial))];

    // For each device, find its owner and update their weather
    const updatedUsers = new Set<string>();

    for (const serial of deviceSerials) {
      const deviceOwner = await ctx.db
        .query("deviceOwners")
        .withIndex("by_serial", (q) => q.eq("serial", serial))
        .first();

      if (!deviceOwner) continue;

      const userId = deviceOwner.userId.replace(/^user_/, "");
      const userStateKey = `user.${userId}`;

      // Get all devices for this user
      const userDevices = await ctx.db
        .query("deviceOwners")
        .withIndex("by_user", (q) => q.eq("userId", deviceOwner.userId))
        .collect();

      // Update weather on all user's devices
      for (const userDevice of userDevices) {
        const existingUserState = await ctx.db
          .query("states")
          .withIndex("by_key", (q) =>
            q.eq("serial", userDevice.serial).eq("object_key", userStateKey)
          )
          .first();

        if (existingUserState) {
          const currentValue = existingUserState.value || {};
          const updatedValue = {
            ...currentValue,
            weather: {
              ...args.weatherData,
              updatedAt: nowMs,
            },
          };

          await ctx.db.patch(existingUserState._id, {
            value: updatedValue,
            updatedAt: nowMs,
            object_revision: (existingUserState.object_revision || 0) + 1,
            object_timestamp: nowMs,
          });
        }
      }

      updatedUsers.add(deviceOwner.userId);
    }

    return {
      updated: true,
      usersUpdated: updatedUsers.size,
      devicesFound: deviceSerials.length,
    };
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

// Get device owner by serial number
export const getDeviceOwner = query({
  args: {
    serial: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await ctx.db
      .query("deviceOwners")
      .withIndex("by_serial", (q) => q.eq("serial", args.serial))
      .first();

    if (!owner) {
      return null;
    }

    return {
      userId: owner.userId,
      serial: owner.serial,
      linkedAt: owner.createdAt,
    };
  },
});

// Cron job: Clean up expired entry keys
export const cleanupExpiredKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();

    // Get all entry keys
    const allKeys = await ctx.db.query("entryKeys").collect();

    let deletedCount = 0;
    for (const key of allKeys) {
      // Delete if expired (regardless of claimed status)
      if (key.expiresAt <= nowMs) {
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
      const structureId = `structure.${userId}`;

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
            structures: [structureId],
            structure_memberships: [
              {
                structure: structureId,
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
      const structureId = `structure.${userId}`;

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
            structures: [structureId],
            structure_memberships: [
              {
                structure: structureId,
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

// Get user by ID (for server-side use)
export const getUserById = query({
  args: {
    userId: v.string(), // clerkId with user_ prefix
  },
  handler: async (ctx, args) => {
    const userId = args.userId.replace(/^user_/, "");

    // Get user's devices
    const devices = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (devices.length === 0) {
      return null;
    }

    // Get user state from first device
    const userStateKey = `user.${userId}`;
    const userState = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", devices[0].serial).eq("object_key", userStateKey)
      )
      .first();

    return userState?.value || null;
  },
});

// Query to check if weather needs refresh
export const checkWeatherFreshness = query({
  args: {
    userId: v.string(), // clerkId with user_ prefix
  },
  handler: async (ctx, args) => {
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const nowMs = Date.now();
    const userId = args.userId.replace(/^user_/, "");

    // Get user's devices
    const devices = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (devices.length === 0) {
      return { needsRefresh: false, reason: "No devices found" };
    }

    // Get user state from first device
    const userStateKey = `user.${userId}`;
    const userState = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", devices[0].serial).eq("object_key", userStateKey)
      )
      .first();

    const weather = userState?.value?.weather;
    if (!weather || !weather.updatedAt || nowMs - weather.updatedAt > TEN_MINUTES_MS) {
      return {
        needsRefresh: true,
        reason: weather ? "Weather is stale" : "No weather data",
        ageMs: weather?.updatedAt ? nowMs - weather.updatedAt : undefined,
      };
    }

    return {
      needsRefresh: false,
      reason: "Weather is fresh",
      ageMs: nowMs - weather.updatedAt,
    };
  },
});

// Action to refresh weather from Nest API
export const refreshWeatherFromAPI = action({
  args: {
    postalCode: v.string(),
    country: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const nowMs = Date.now();

    try {
      const weatherUrl = `https://weather.nest.com/weather/v1?query=${args.postalCode},${args.country}`;
      const response = await fetch(weatherUrl);

      if (!response.ok) {
        return { success: false, error: "Weather API error" };
      }

      const weatherData = await response.json();
      const locationKey = `${args.postalCode},${args.country}`;
      const weatherInfo = weatherData[locationKey];

      if (weatherInfo && weatherInfo.current) {
        // Update weather in database - need to use internal API
        // For now, return success and let the mutation be called from client
        return { success: true };
      }

      return { success: false, error: "Invalid weather data" };
    } catch (err) {
      const error = err as Error;
      return { success: false, error: error.message };
    }
  },
});

export const getUserStructureAddress = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const devices = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (devices.length === 0) {
      return null;
    }

    const serial = devices[0].serial;
    const userId = args.userId.replace(/^user_/, '');
    const structureKey = `structure.${userId}`;
    const userKey = `user.${userId}`;

    const structure = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", serial).eq("object_key", structureKey)
      )
      .first();

    const userState = await ctx.db
      .query("states")
      .withIndex("by_key", (q) =>
        q.eq("serial", serial).eq("object_key", userKey)
      )
      .first();

    const structureValue = structure?.value || {};
    const userValue = userState?.value || {};

    return {
      address: structureValue.address_lines && structureValue.address_lines.length > 0 ? structureValue.address_lines[0] : "",
      city: structureValue.city || "",
      state: structureValue.state || "",
      country: userValue.country_code || structureValue.country_code || "",
      postalCode: userValue.postal_code || structureValue.postal_code || "",
    };
  },
});

export const updateStructureAddress = mutation({
  args: {
    userId: v.string(),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.string(),
    postalCode: v.string(),
  },
  handler: async (ctx, args) => {
    const devices = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    if (devices.length === 0) {
      throw new Error("No devices found for user");
    }

    const nowMs = Date.now();
    const userId = args.userId.replace(/^user_/, '');
    const structureKey = `structure.${userId}`;
    const userKey = `user.${userId}`;

    for (const device of devices) {
      const structure = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", device.serial).eq("object_key", structureKey)
        )
        .first();

      if (structure) {
        const currentValue = structure.value || {};
        await ctx.db.patch(structure._id, {
          value: {
            ...currentValue,
            address_lines: args.address ? [args.address] : [],
            city: args.city || "",
            state: args.state || "",
            country_code: args.country,
            postal_code: args.postalCode,
          },
          updatedAt: nowMs,
          object_revision: (structure.object_revision || 0) + 1,
          object_timestamp: nowMs,
        });
      }

      const userState = await ctx.db
        .query("states")
        .withIndex("by_key", (q) =>
          q.eq("serial", device.serial).eq("object_key", userKey)
        )
        .first();

      if (userState) {
        const currentUserValue = userState.value || {};
        await ctx.db.patch(userState._id, {
          value: {
            ...currentUserValue,
            country_code: args.country,
            postal_code: args.postalCode,
          },
          updatedAt: nowMs,
          object_revision: (userState.object_revision || 0) + 1,
          object_timestamp: nowMs,
        });
      }
    }

    return { success: true };
  },
});
