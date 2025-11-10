const CONVEX_URL = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const CONVEX_ADMIN_KEY = process.env.CONVEX_ADMIN_KEY;

type ConvexHttp = {
  query: (path: string, args?: Record<string, any>) => Promise<any>;
  mutation: (path: string, args?: Record<string, any>) => Promise<any>;
  action: (path: string, args?: Record<string, any>) => Promise<any>;
  setAdminAuth?: (key: string) => void;
};

let clientPromise: Promise<ConvexHttp | null> | null = null;

async function getClient(): Promise<ConvexHttp | null> {
  if (!CONVEX_URL) {
    return null;
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const { ConvexHttpClient } = await import("convex/browser");
        const client = new ConvexHttpClient(CONVEX_URL) as ConvexHttp;
        if (CONVEX_ADMIN_KEY && typeof client.setAdminAuth === "function") {
          client.setAdminAuth(CONVEX_ADMIN_KEY);
        }
        return client;
      } catch (error) {
        console.error(
          "[Convex] Failed to initialize Convex client:",
          error instanceof Error ? error.message : error
        );
        return null;
      }
    })();
  }
  return clientPromise;
}

async function callMutation(path: string, args: Record<string, any>) {
  const client = await getClient();
  if (!client) {
    throw new Error("Convex URL is not configured");
  }
  return client.mutation(path, args);
}

async function callQuery(path: string, args: Record<string, any>) {
  const client = await getClient();
  if (!client) {
    throw new Error("Convex URL is not configured");
  }
  return client.query(path, args);
}

async function tryMutation(path: string, args: Record<string, any>) {
  try {
    return await callMutation(path, args);
  } catch (error) {
    console.error(
      `[Convex] ${path} failed:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

async function tryQuery(path: string, args: Record<string, any>) {
  try {
    return await callQuery(path, args);
  } catch (error) {
    console.error(
      `[Convex] ${path} failed:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function ensureConvexUser(
  clerkId: string,
  email?: string | null
): Promise<any | null> {
  if (!clerkId) return null;
  return tryMutation("users:ensureUser", { clerkId, email: email ?? "" });
}

export async function listConvexUserDevices(
  userId: string
): Promise<Array<{ serial: string; linkedAt?: number }>> {
  if (!userId) return [];
  const result = await tryQuery("users:listUserDevices", { userId });
  return Array.isArray(result) ? result : [];
}

export async function fetchConvexState(): Promise<any | null> {
  return tryQuery("device:getAllState", {});
}

export async function claimConvexEntryKey(code: string, userId: string) {
  return callMutation("users:claimEntryKey", { code, userId });
}

export async function getScheduleBySerial(serial: string): Promise<any | null> {
  if (!serial) return null;

  // Get all states and filter for schedule on the client side
  const allStates = await tryQuery("device:getAllState", {});
  if (!allStates || !allStates.deviceState) return null;

  const deviceStates = allStates.deviceState[serial];
  if (!deviceStates) return null;

  // Look for the schedule object key
  const scheduleKey = `schedule.${serial}`;
  const scheduleState = deviceStates[scheduleKey];

  if (!scheduleState) return null;

  return {
    serial,
    object_key: scheduleKey,
    object_revision: scheduleState.object_revision,
    object_timestamp: scheduleState.object_timestamp,
    value: scheduleState.value,
    updatedAt: scheduleState.updatedAt,
  };
}

export async function getWeatherBySerial(serial: string): Promise<any | null> {
  if (!serial) return null;
  return tryQuery("weather:getWeatherBySerial", { serial });
}

export async function backfillDeviceAlertDialogs(): Promise<any> {
  return tryMutation("users:backfillDeviceAlertDialogs", {});
}

export async function ensureDeviceAlertDialog(serial: string): Promise<any> {
  if (!serial) return null;
  return tryMutation("users:ensureDeviceAlertDialog", { serial });
}
