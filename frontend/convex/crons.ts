import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired entry keys every hour
crons.interval(
  "cleanup expired entry keys",
  { hours: 1 }, // Run every hour
  internal.users.cleanupExpiredKeys
);

// Expire old share invitations every day
crons.interval(
  "expire share invitations",
  { hours: 24 },
  internal.shares.expireInvites
);

export default crons;
