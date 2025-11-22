import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate a random invite token (URL-safe)
 */
function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Create a share invitation
 */
export const createShareInvite = mutation({
  args: {
    ownerId: v.string(),
    email: v.string(),
    serial: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const nowMs = Date.now();
    const expiresAt = nowMs + (7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds

    // Verify owner owns the device
    const ownership = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.ownerId))
      .filter((q) => q.eq(q.field("serial"), args.serial))
      .first();

    if (!ownership) {
      throw new Error("You do not own this device");
    }

    // Check if email is the owner's email
    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.ownerId))
      .first();

    if (owner && owner.email.toLowerCase() === args.email.toLowerCase()) {
      throw new Error("Cannot share device with yourself");
    }

    // Check if already shared with this email
    const existingShare = await ctx.db
      .query("deviceShareInvites")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .filter((q) =>
        q.and(
          q.eq(q.field("serial"), args.serial),
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "accepted")
          )
        )
      )
      .first();

    if (existingShare) {
      if (existingShare.status === "accepted") {
        throw new Error("Device already shared with this user");
      }
      if (existingShare.status === "pending") {
        throw new Error("Invitation already pending for this user");
      }
    }

    // Create invitation
    const inviteToken = generateInviteToken();
    const inviteId = await ctx.db.insert("deviceShareInvites", {
      ownerId: args.ownerId,
      email: args.email.toLowerCase(),
      serial: args.serial,
      permissions: args.permissions,
      status: "pending",
      inviteToken,
      invitedAt: nowMs,
      expiresAt,
    });

    return { inviteId, inviteToken, expiresAt };
  },
});

/**
 * Get active shares for a device (owner only)
 */
export const getDeviceShares = query({
  args: {
    ownerId: v.string(),
    serial: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const ownership = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.ownerId))
      .filter((q) => q.eq(q.field("serial"), args.serial))
      .first();

    if (!ownership) {
      throw new Error("You do not own this device");
    }

    // Get all active shares
    const shares = await ctx.db
      .query("deviceShares")
      .withIndex("by_owner_serial", (q) =>
        q.eq("ownerId", args.ownerId).eq("serial", args.serial)
      )
      .collect();

    // Enrich with user info
    const enrichedShares = await Promise.all(
      shares.map(async (share) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk", (q) => q.eq("clerkId", share.sharedWithUserId))
          .first();

        return {
          ...share,
          sharedWithEmail: user?.email || "Unknown",
        };
      })
    );

    return enrichedShares;
  },
});

/**
 * Get pending/expired invites for a device (owner only)
 */
export const getDeviceInvites = query({
  args: {
    ownerId: v.string(),
    serial: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const ownership = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.ownerId))
      .filter((q) => q.eq(q.field("serial"), args.serial))
      .first();

    if (!ownership) {
      throw new Error("You do not own this device");
    }

    // Get invites
    const invites = await ctx.db
      .query("deviceShareInvites")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .filter((q) => q.eq(q.field("serial"), args.serial))
      .collect();

    return invites;
  },
});

/**
 * Get devices shared with current user
 */
export const getSharedWithMe = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const shares = await ctx.db
      .query("deviceShares")
      .withIndex("by_shared_user", (q) => q.eq("sharedWithUserId", args.userId))
      .collect();

    // Enrich with owner info
    const enrichedShares = await Promise.all(
      shares.map(async (share) => {
        const owner = await ctx.db
          .query("users")
          .withIndex("by_clerk", (q) => q.eq("clerkId", share.ownerId))
          .first();

        return {
          ...share,
          ownerEmail: owner?.email || "Unknown",
        };
      })
    );

    return enrichedShares;
  },
});

/**
 * Accept share invitation
 */
export const acceptShareInvite = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const nowMs = Date.now();

    // Find invitation
    const invite = await ctx.db
      .query("deviceShareInvites")
      .withIndex("by_token", (q) => q.eq("inviteToken", args.token))
      .first();

    if (!invite) {
      throw new Error("Invalid invitation token");
    }

    if (invite.status !== "pending") {
      throw new Error("Invitation already processed");
    }

    if (invite.expiresAt < nowMs) {
      // Mark as expired
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("Invitation has expired");
    }

    // Verify user email matches invite
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("Email mismatch - please log in with the invited email");
    }

    // Create deviceShares record
    await ctx.db.insert("deviceShares", {
      ownerId: invite.ownerId,
      sharedWithUserId: args.userId,
      serial: invite.serial,
      permissions: invite.permissions,
      createdAt: nowMs,
    });

    // Update invite status
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: nowMs,
      sharedWithUserId: args.userId,
    });

    return { success: true, serial: invite.serial };
  },
});

/**
 * Revoke access (remove share)
 */
export const revokeShare = mutation({
  args: {
    ownerId: v.string(),
    shareId: v.id("deviceShares"),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db.get(args.shareId);
    if (!share) {
      throw new Error("Share not found");
    }

    if (share.ownerId !== args.ownerId) {
      throw new Error("Only the owner can revoke access");
    }

    await ctx.db.delete(args.shareId);
    return { success: true };
  },
});

/**
 * Update share permissions
 */
export const updateSharePermissions = mutation({
  args: {
    ownerId: v.string(),
    shareId: v.id("deviceShares"),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db.get(args.shareId);
    if (!share) {
      throw new Error("Share not found");
    }

    if (share.ownerId !== args.ownerId) {
      throw new Error("Only the owner can update permissions");
    }

    await ctx.db.patch(args.shareId, {
      permissions: args.permissions,
    });

    return { success: true };
  },
});

/**
 * Resend expired invitation
 */
export const resendInvite = mutation({
  args: {
    ownerId: v.string(),
    inviteId: v.id("deviceShareInvites"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Invitation not found");
    }

    if (invite.ownerId !== args.ownerId) {
      throw new Error("Only the owner can resend invitations");
    }

    if (invite.status !== "expired") {
      throw new Error("Can only resend expired invitations");
    }

    const nowMs = Date.now();
    const newExpiresAt = nowMs + (7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds
    const newToken = generateInviteToken();

    await ctx.db.patch(args.inviteId, {
      status: "pending",
      inviteToken: newToken,
      invitedAt: nowMs,
      expiresAt: newExpiresAt,
    });

    return { inviteToken: newToken, expiresAt: newExpiresAt };
  },
});

/**
 * Check if user has access to device
 */
export const checkDeviceAccess = query({
  args: {
    userId: v.string(),
    serial: v.string(),
    requiredPermission: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check ownership
    const ownership = await ctx.db
      .query("deviceOwners")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("serial"), args.serial))
      .first();

    if (ownership) {
      return {
        hasAccess: true,
        isOwner: true,
        permissions: ["view", "control", "manage", "share"],
      };
    }

    // Check shared access
    const share = await ctx.db
      .query("deviceShares")
      .withIndex("by_shared_user", (q) => q.eq("sharedWithUserId", args.userId))
      .filter((q) => q.eq(q.field("serial"), args.serial))
      .first();

    if (!share) {
      return {
        hasAccess: false,
        isOwner: false,
        permissions: [],
      };
    }

    const hasPermission = args.requiredPermission
      ? share.permissions.includes(args.requiredPermission)
      : true;

    return {
      hasAccess: hasPermission,
      isOwner: false,
      permissions: share.permissions,
      sharedBy: share.ownerId,
    };
  },
});

/**
 * Expire old invitations (cron job)
 */
export const expireInvites = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    const pendingInvites = await ctx.db
      .query("deviceShareInvites")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    let expiredCount = 0;
    for (const invite of pendingInvites) {
      if (invite.expiresAt <= nowSeconds) {
        await ctx.db.patch(invite._id, { status: "expired" });
        expiredCount++;
      }
    }

    console.log(`[CRON] Expired ${expiredCount} share invitations`);
    return { expiredCount };
  },
});
