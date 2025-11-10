const url = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
let clientPromise = null;

async function getClient() {
  if (!url) {
    console.warn('[Convex] CONVEX_URL not set; running without Convex persistence.');
    return null;
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const mod = await import('convex/browser');
        const { ConvexHttpClient } = mod;
        const client = new ConvexHttpClient(url);
        const adminKey = process.env.CONVEX_ADMIN_KEY;
        if (adminKey) {
          client.setAdminAuth(adminKey);
        }
        console.log('[Convex] Connected to', client.url);
        return client;
      } catch (e) {
        console.error('[Convex] Failed to init Convex client:', e.message);
        return null;
      }
    })();
  }
  return clientPromise;
}

async function call(path, args) {
  const c = await getClient();
  if (!c) return null;
  try {
    return await c.function(path, undefined, args || {});
  } catch (e) {
    console.error('[Convex] Call failed', path, e.message);
    return null;
  }
}

module.exports = {
  async upsertState({ serial, object_key, object_revision, object_timestamp, value }) {
    return call('device:upsertState', { serial, object_key, object_revision, object_timestamp, value });
  },
  async getState({ serial, object_key }) {
    return call('device:getState', { serial, object_key });
  },
  async getAllState() {
    return call('device:getAllState', {});
  },
  async appendLog({ route, serial, req, res, ts }) {
    return call('logs:append', { route, serial, req, res, ts });
  },
  async sessionUpsert({ serial, session, endpoint, startedAt, client, meta }) {
    return call('sessions:upsert', { serial, session, endpoint, startedAt, client, meta });
  },
  async sessionHeartbeat({ serial, session }) {
    return call('sessions:heartbeat', { serial, session });
  },
  async sessionClose({ serial, session }) {
    return call('sessions:close', { serial, session });
  },
  async ensureUser({ clerkId, email }) {
    return call('users:ensureUser', { clerkId, email });
  },
  async listUserDevices({ userId }) {
    return call('users:listUserDevices', { userId });
  },
  async generateEntryKey({ serial, ttlSeconds }) {
    return call('users:generateEntryKey', { serial, ttlSeconds });
  },
  async claimEntryKey({ code, userId }) {
    return call('users:claimEntryKey', { code, userId });
  },
  async getWeather({ postalCode, country }) {
    return call('weather:getWeather', { postalCode, country });
  },
  async ensureDeviceAlertDialog({ serial }) {
    return call('users:ensureDeviceAlertDialog', { serial });
  },
  async upsertWeather({ postalCode, country, fetchedAt, data }) {
    return call('weather:upsertWeather', { postalCode, country, fetchedAt, data });
  }
};
