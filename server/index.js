require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const convex = require('./lib/convexIntegration');

const PROXY_PORT = Number(process.env.PROXY_PORT || 443);
const CONTROL_PORT = Number(process.env.CONTROL_PORT || 8081);
const ENTRY_KEY_TTL_SECONDS = Number.isFinite(Number(process.env.ENTRY_KEY_TTL_SECONDS))
  ? Number(process.env.ENTRY_KEY_TTL_SECONDS)
  : 3600;
const CERT_DIR = process.env.SSL_CERT_DIR || path.join(__dirname, 'certs');
const DEFAULT_API_ORIGIN = 'https://backdoor.nolongerevil.com';
const API_ORIGIN = (process.env.API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/+$/, '');

global.nestDeviceState = {};
global.activeUsers = {};
global.pendingSubscribes = {};

function extractSerialFromAuthHeader(header) {
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Basic\s+(.+)$/i);
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const username = decoded.split(':')[0] || '';
    const parts = username.split('.');
    if (parts.length > 1) {
      const serial = String(parts[1]).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return serial.length >= 10 ? serial : null;
    }
    const cleaned = String(username).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleaned.length >= 10 ? cleaned : null;
  } catch {
    return null;
  }
}

function resolveDeviceSerial(req) {
  const headers = req.headers || {};

  const authSerial = extractSerialFromAuthHeader(headers.authorization);
  if (authSerial) return authSerial;

  const headerSerial = headers['x-nl-device-serial'];

  if (headerSerial) {
    const cleaned = String(headerSerial).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length >= 10) return cleaned;
  }

  return null;
}

function generateEntryKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 7; i++) {
    key += chars[crypto.randomInt(0, chars.length)];
  }
  return key;
}

function notifyStateChange(serial, changedObjectKey, updatedObject) {
  if (!global.pendingSubscribes[serial] || global.pendingSubscribes[serial].length === 0) {
    return;
  }

  const subscribes = global.pendingSubscribes[serial];
  global.pendingSubscribes[serial] = [];

  for (const subscribe of subscribes) {
    try {
      if (subscribe.res.writableEnded || subscribe.res.destroyed) {
        continue;
      }

      const watchingObject = subscribe.objects.find(obj => obj.object_key === changedObjectKey);

      if (watchingObject) {
        const updateResponse = JSON.stringify({
          objects: [{
            object_revision: updatedObject.object_revision,
            object_timestamp: updatedObject.object_timestamp,
            object_key: updatedObject.object_key,
            value: updatedObject.value
          }]
        }) + '\r\n';

        subscribe.res.write(updateResponse);
        subscribe.res.end();
      } else {
        if (!subscribe.res.writableEnded && !subscribe.res.destroyed) {
          global.pendingSubscribes[serial] = global.pendingSubscribes[serial] || [];
          global.pendingSubscribes[serial].push(subscribe);
        }
      }
    } catch (err) {
      console.error('[NOTIFY] Failed to notify subscriber:', err.message);
    }
  }
}

async function handleTransportSubscribe(req, res, bodyBuffer) {
  const serial = resolveDeviceSerial(req);

  let requestBody;
  try {
    requestBody = JSON.parse(bodyBuffer.toString('utf8'));
  } catch (e) {
    console.error('[TRANSPORT] Failed to parse subscribe body:', e.message);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const sessionId = requestBody.session || `session_${serial}_${Date.now()}`;
  const objects = requestBody.objects || [];
  const timestamp = Date.now();

  if (serial && !global.nestDeviceState[serial]) {
    global.nestDeviceState[serial] = {};
  }

  if (serial) {
    const weaveDeviceId = req.headers['x-nl-weave-device-id'];
    if (weaveDeviceId) {
      const deviceObjectKey = `device.${serial}`;
      const existingDevice = global.nestDeviceState[serial][deviceObjectKey];
      const existingValue = existingDevice?.value || {};

      if (!existingValue.weave_device_id || existingValue.weave_device_id !== weaveDeviceId) {
        const mergedValue = { ...existingValue, weave_device_id: weaveDeviceId };
        const newRevision = (existingDevice?.object_revision || 0) + 1;

        global.nestDeviceState[serial][deviceObjectKey] = {
          object_key: deviceObjectKey,
          object_revision: newRevision,
          object_timestamp: timestamp,
          value: mergedValue
        };

        convex.upsertState({
          serial: serial,
          object_key: deviceObjectKey,
          object_revision: newRevision,
          object_timestamp: timestamp,
          value: mergedValue
        }).catch(err => {
          console.error(`[TRANSPORT] Convex upsert failed for weave_device_id:`, err.message);
        });
      }
    }
  }

  const responseObjects = await Promise.all(objects.map(async obj => {
    const objectKey = obj.object_key;
    const nowMillis = timestamp;

    if (!serial) {
      return {
        object_key: objectKey,
        object_revision: 0,
        object_timestamp: nowMillis,
        value: {}
      };
    }

    let stored = global.nestDeviceState[serial]?.[objectKey];

    if (!stored) {
      try {
        const convexState = await convex.getState({ serial, object_key: objectKey });
        if (convexState && convexState.value) {
          stored = convexState;
          global.nestDeviceState[serial][objectKey] = stored;
        }
      } catch (err) {
        console.error(`[TRANSPORT] Convex getState failed for ${objectKey}:`, err.message);
      }
    }

    const isUpdate = obj.value &&
                     (obj.object_revision === undefined || obj.object_revision === 0) &&
                     (obj.object_timestamp === undefined || obj.object_timestamp === 0);

    if (isUpdate) {
      const existingValue = stored?.value || {};
      const mergedValue = { ...existingValue, ...obj.value };
      const newRevision = (stored?.object_revision || 0) + 1;
      const newTimestamp = nowMillis;

      stored = {
        object_key: objectKey,
        object_revision: newRevision,
        object_timestamp: newTimestamp,
        value: mergedValue
      };

      global.nestDeviceState[serial][objectKey] = stored;

      try {
        await convex.upsertState({
          serial: serial,
          object_key: objectKey,
          object_revision: newRevision,
          object_timestamp: newTimestamp,
          value: mergedValue
        });
      } catch (err) {
        console.error(`[TRANSPORT] Convex upsert failed for ${objectKey}:`, err.message);
      }
    }

    return {
      object_revision: stored?.object_revision || 0,
      object_timestamp: stored?.object_timestamp || nowMillis,
      object_key: objectKey,
      value: stored?.value || {}
    };
  }));

  const outdatedObjects = [];
  const objectsToMerge = [];

  for (let i = 0; i < objects.length; i++) {
    const deviceObj = objects[i];
    const ourObj = responseObjects[i];

    if (deviceObj.object_revision === 0 && deviceObj.object_timestamp === 0) {
      outdatedObjects.push(ourObj);
      continue;
    }

    const ourRevisionHigher = ourObj.object_revision > deviceObj.object_revision;
    const ourTimestampHigher = ourObj.object_timestamp > deviceObj.object_timestamp;

    if (ourRevisionHigher || ourTimestampHigher) {
      outdatedObjects.push(ourObj);
    } else if (deviceObj.object_revision > ourObj.object_revision || deviceObj.object_timestamp > ourObj.object_timestamp) {
      objectsToMerge.push({ deviceObj, ourObj });
    }
  }

  for (const { deviceObj, ourObj } of objectsToMerge) {
    const objectKey = deviceObj.object_key;

    const mergedValue = deviceObj.value ? { ...ourObj.value, ...deviceObj.value } : ourObj.value;

    const updated = {
      object_key: objectKey,
      object_revision: deviceObj.object_revision,
      object_timestamp: deviceObj.object_timestamp,
      value: mergedValue
    };

    global.nestDeviceState[serial][objectKey] = updated;

    try {
      await convex.upsertState({
        serial: serial,
        object_key: objectKey,
        object_revision: deviceObj.object_revision,
        object_timestamp: deviceObj.object_timestamp,
        value: mergedValue
      });
    } catch (err) {
      console.error(`[TRANSPORT] Convex upsert failed for merged ${objectKey}:`, err.message);
    }
  }

  if (outdatedObjects.length > 0) {
    const response = JSON.stringify({
      objects: outdatedObjects
    });

    if (!res.headersSent) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-nl-service-timestamp': Date.now().toString()
      });
    }
    res.end(response);
    return;
  }

  if (!serial) {
    res.end();
    return;
  }

  if (!global.pendingSubscribes[serial]) {
    global.pendingSubscribes[serial] = [];
  }

  const subscribeInfo = {
    res: res,
    objects: objects,
    sessionId: sessionId,
    connectedAt: Date.now()
  };

  global.pendingSubscribes[serial].push(subscribeInfo);

  req.on('close', () => {
    if (global.pendingSubscribes[serial]) {
      global.pendingSubscribes[serial] = global.pendingSubscribes[serial].filter(
        sub => sub.res !== res
      );
    }
  });
}

async function handlePut(req, res, bodyBuffer) {
  const serial = resolveDeviceSerial(req);

  let requestBody;
  try {
    requestBody = JSON.parse(bodyBuffer.toString('utf8'));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const objects = requestBody.objects || [];
  const requestTimestamp = Date.now();

  if (serial) {
    if (!global.nestDeviceState[serial]) {
      global.nestDeviceState[serial] = {};
    }

    const weaveDeviceId = req.headers['x-nl-weave-device-id'];
    if (weaveDeviceId) {
      const deviceObjectKey = `device.${serial}`;
      const existingDevice = global.nestDeviceState[serial][deviceObjectKey];
      const existingValue = existingDevice?.value || {};

      if (!existingValue.weave_device_id || existingValue.weave_device_id !== weaveDeviceId) {
        const mergedValue = { ...existingValue, weave_device_id: weaveDeviceId };
        const newRevision = (existingDevice?.object_revision || 0) + 1;

        global.nestDeviceState[serial][deviceObjectKey] = {
          object_key: deviceObjectKey,
          object_revision: newRevision,
          object_timestamp: requestTimestamp,
          value: mergedValue
        };

        try {
          await convex.upsertState({
            serial: serial,
            object_key: deviceObjectKey,
            object_revision: newRevision,
            object_timestamp: requestTimestamp,
            value: mergedValue
          });
        } catch (err) {
          console.error(`[PUT] Convex upsert failed for weave_device_id:`, err.message);
        }
      }
    }

    for (const obj of objects) {
      if (obj.object_key) {
        const objectKey = obj.object_key;
        const nowMillis = requestTimestamp;

        let existingState = global.nestDeviceState[serial][objectKey];
        let existingValue = existingState?.value || {};

        if (!existingState) {
          try {
            const convexState = await convex.getState({ serial, object_key: objectKey });
            if (convexState && convexState.value) {
              existingState = convexState;
              existingValue = convexState.value;
            }
          } catch (err) {
            console.error(`[PUT] Convex getState failed for ${objectKey}:`, err.message);
          }
        }

        const mergedValue = { ...existingValue, ...(obj.value || {}) };

        if (objectKey === `device.${serial}`) {
          const existingTimeout = existingValue.fan_timer_timeout || 0;
          const nowSeconds = Math.floor(Date.now() / 1000);

          if (existingTimeout > nowSeconds) {
            mergedValue.fan_timer_timeout = existingTimeout;
            mergedValue.fan_control_state = existingValue.fan_control_state;
            mergedValue.fan_timer_duration = existingValue.fan_timer_duration;
            mergedValue.fan_current_speed = existingValue.fan_current_speed;
            mergedValue.fan_mode = existingValue.fan_mode;
          }
        }

        let valuesChanged = false;
        for (const [key, newVal] of Object.entries(obj.value || {})) {
          const oldVal = existingValue[key];
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            valuesChanged = true;
          }
        }

        if (valuesChanged) {
          const newRevision = (existingState?.object_revision || 0) + 1;
          const newTimestamp = nowMillis;

          global.nestDeviceState[serial][objectKey] = {
            object_key: objectKey,
            object_revision: newRevision,
            object_timestamp: newTimestamp,
            value: mergedValue
          };

          const convexData = {
            serial: serial,
            object_key: objectKey,
            object_revision: newRevision,
            object_timestamp: newTimestamp,
            value: mergedValue
          };
          try {
            await convex.upsertState(convexData);
          } catch (err) {
            console.error(`[PUT] Convex upsert failed for ${objectKey}:`, err.message);
          }
        }
      }
    }
  }

  const responseObjects = objects.map(obj => {
    const objectKey = obj.object_key;
    const stored = serial ? global.nestDeviceState[serial]?.[objectKey] : null;

    let valuesChanged = false;
    const existingValue = stored?.value || {};
    for (const [key, newVal] of Object.entries(obj.value || {})) {
      const oldVal = existingValue[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        valuesChanged = true;
        break;
      }
    }

    const response = {
      object_revision: stored?.object_revision || 0,
      object_timestamp: stored?.object_timestamp || Date.now(),
      object_key: objectKey
    };

    if (valuesChanged) {
      response.value = stored?.value || {};
    }

    return response;
  });

  const response = { objects: responseObjects };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));

  if (serial && global.pendingSubscribes[serial] && global.pendingSubscribes[serial].length > 0) {
    const subscribes = global.pendingSubscribes[serial];
    global.pendingSubscribes[serial] = [];

    for (const subscribe of subscribes) {
      try {
        if (subscribe.res.writableEnded || subscribe.res.destroyed) {
          continue;
        }

        const subscribeResponse = JSON.stringify({ objects: responseObjects }) + '\r\n';

        subscribe.res.write(subscribeResponse);
        subscribe.res.end();
      } catch (err) {
        console.error('[PUT] Failed to end subscription:', err.message);
      }
    }
  }
}

const tlsOptions = {
  key: fs.readFileSync(path.join(CERT_DIR, 'nest_server.key')),
  cert: fs.readFileSync(path.join(CERT_DIR, 'nest_server.crt')),
  requestCert: false,
  rejectUnauthorized: false
};

const server = https.createServer(tlsOptions, async (req, res) => {
  const method = req.method;
  const url = req.url;

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    const bodyBuffer = Buffer.concat(chunks);
    const bodyStr = bodyBuffer.toString('utf8');

    try {
      if (url.includes('/entry')) {
        const serial = resolveDeviceSerial(req);
        const baseUrl = API_ORIGIN;

        const response = {
          czfe_url: `${baseUrl}/nest/transport`,
          transport_url: `${baseUrl}/nest/transport`,
          direct_transport_url: `${baseUrl}/nest/transport`,
          passphrase_url: `${baseUrl}/nest/passphrase`,
          ping_url: `${baseUrl}/nest/transport`,
          pro_info_url: `${baseUrl}/nest/pro_info`,
          weather_url: `${baseUrl}/nest/weather/v1?query=`,
          upload_url: `${baseUrl}/nest/upload`,
          software_update_url: '',
          server_version: '1.0.0',
          tier_name: 'local'
        };

        const responseStr = JSON.stringify(response);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(responseStr);
        return;
      }

      if (url.includes('/passphrase')) {
        const serial = resolveDeviceSerial(req);

        let entryKey = null;
        let expiresTimestamp = Math.floor(Date.now() / 1000) + Math.floor(ENTRY_KEY_TTL_SECONDS / 1000);

        if (serial) {
          try {
            const convexResult = await convex.generateEntryKey({
              serial: serial,
              ttlSeconds: Math.floor(ENTRY_KEY_TTL_SECONDS / 1000)
            });

            if (convexResult && convexResult.code) {
              entryKey = String(convexResult.code).toUpperCase();
              if (Number.isFinite(Number(convexResult.expiresAt))) {
                expiresTimestamp = Number(convexResult.expiresAt);
              }
            }
          } catch (err) {
            console.error(`[PASSPHRASE] Convex failed:`, err.message);
          }
        }

        if (!entryKey) {
          entryKey = generateEntryKey();
        }

        const response = {
          value: entryKey,
          expires: expiresTimestamp
        };

        const responseStr = JSON.stringify(response);

        console.log(`[PASSPHRASE] Serial=${serial || 'UNKNOWN'} key=${entryKey.slice(0, 3)}-${entryKey.slice(3)}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(responseStr);
        return;
      }

      if (url.includes('/nest/weather') || url.includes('/weather/v1')) {
        console.log(`[WEATHER] Request: ${url}`);

        const urlObj = new URL(url, `https://${req.headers.host}`);
        const query = urlObj.searchParams.get('query');

        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing query parameter' }));
          return;
        }

        const parts = query.split(',');
        const postalCode = parts[0]?.trim();
        const country = parts[1]?.trim() || 'US';

        if (!postalCode) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid query format' }));
          return;
        }

        console.log(`[WEATHER] Query: ${query}`);

        const isIpQuery = postalCode.toLowerCase() === 'ipv4' || postalCode.toLowerCase() === 'ipv6';

        const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
        let weatherData = null;
        let needsFetch = true;

        if (!isIpQuery) {
          try {
            const cached = await convex.getWeather({ postalCode, country });
            if (cached && cached.data) {
              const age = Date.now() - cached.fetchedAt;
              if (age < THREE_HOURS_MS) {
                console.log(`[WEATHER] Using cached data (age: ${Math.round(age / 1000 / 60)} minutes)`);
                weatherData = cached.data;
                needsFetch = false;
              } else {
                console.log(`[WEATHER] Cache expired (age: ${Math.round(age / 1000 / 60)} minutes)`);
              }
            }
          } catch (err) {
            console.error(`[WEATHER] Cache check failed:`, err.message);
          }
        }

        if (needsFetch) {
          try {
            const weatherUrl = `https://weather.nest.com/weather/v1?query=${encodeURIComponent(query)}`;
            console.log(`[WEATHER] Fetching from: ${weatherUrl}`);

            const https = require('https');
            const fetchWeather = () => new Promise((resolve, reject) => {
              const options = {
                rejectUnauthorized: false
              };
              https.get(weatherUrl, options, (weatherRes) => {
                let data = '';
                weatherRes.on('data', chunk => data += chunk);
                weatherRes.on('end', () => {
                  if (weatherRes.statusCode === 200) {
                    try {
                      const parsed = JSON.parse(data);
                      resolve(parsed);
                    } catch (e) {
                      reject(new Error('Failed to parse weather response'));
                    }
                  } else {
                    reject(new Error(`Weather API returned ${weatherRes.statusCode}`));
                  }
                });
              }).on('error', reject);
            });

            weatherData = await fetchWeather();
            console.log(`[WEATHER] Fetched from API`);

            if (!isIpQuery) {
              try {
                await convex.upsertWeather({
                  postalCode,
                  country,
                  fetchedAt: Date.now(),
                  data: weatherData
                });
                console.log(`[WEATHER] Cached in Convex`);
              } catch (err) {
                console.error(`[WEATHER] Cache failed:`, err.message);
              }
            }
          } catch (err) {
            console.error(`[WEATHER] Failed to fetch from API:`, err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Weather service unavailable' }));
            return;
          }
        }

        const responseStr = JSON.stringify(weatherData);
        logRequest(method, url, 200);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(responseStr);
        return;
      }

      if (url.includes('/transport') || url.includes('/czfe')) {
        if (method === 'GET' && url.includes('/device/')) {
          const serial = resolveDeviceSerial(req);

          const deviceState = serial ? global.nestDeviceState[serial] : {};

          if (serial && (!deviceState || Object.keys(deviceState).length === 0)) {
            try {
              await convex.ensureDeviceAlertDialog({ serial });

              const convexResult = await convex.getAllState();
              if (convexResult && convexResult.deviceState && convexResult.deviceState[serial]) {
                global.nestDeviceState[serial] = convexResult.deviceState[serial];
                console.log(`[DEVICE_LIST] Loaded ${Object.keys(convexResult.deviceState[serial]).length} objects from Convex`);

                for (const [key, obj] of Object.entries(convexResult.deviceState[serial])) {
                  if (!obj.object_key) {
                    console.log(`[DEVICE_LIST] WARNING: Object at key ${key} missing object_key field, adding it`);
                    obj.object_key = key;
                  }
                }
              }
            } catch (err) {
              console.error(`[DEVICE_LIST] Failed to fetch from Convex:`, err.message);
            }
          }

          const objects = Object.values(global.nestDeviceState[serial] || {}).map(obj => ({
            object_revision: obj.object_revision,
            object_timestamp: obj.object_timestamp,
            object_key: obj.object_key
          }));

          const response = { objects };
          const responseStr = JSON.stringify(response);

          const responseHeaders = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(responseStr, 'utf8')
          };

          res.writeHead(200, responseHeaders);
          res.end(responseStr);
          return;
        }

        let isSubscribe = false;
        try {
          const bodyObj = JSON.parse(bodyStr);
          isSubscribe = bodyObj.chunked === true;
        } catch {}

        if (method === 'POST' && isSubscribe) {
          handleTransportSubscribe(req, res, bodyBuffer);
          return;
        }

        if (url.includes('/put') && method === 'POST') {
          await handlePut(req, res, bodyBuffer);
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      if (url.includes('/pro_info') || url.includes('/pro-info')) {
        const urlParts = url.split('?');
        const queryString = urlParts[1] || '';
        const params = new URLSearchParams(queryString);
        const entryCode = params.get('code') || params.get('entry_code') || '';

        if (entryCode) {
          const response = JSON.stringify({
            [entryCode.toUpperCase()]: { pro: 'not found' }
          });
          logRequest(method, url, 200);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(response);
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing entry code' }));
        }
        return;
      }

      if (url.includes('/ping')) {
        const response = JSON.stringify({ status: 'ok', timestamp: Date.now() });
        logRequest(method, url, 200);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(response);
        return;
      }

      if (url.includes('/upload')) {
        logRequest(method, url, 200);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      logRequest(method, url, 404);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));

    } catch (err) {
      console.error('[ERROR]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PROXY_PORT, () => {
  console.log(`\n===========================================`);
  console.log(`No Longer Evil API running on port ${PROXY_PORT}`);
  console.log(`===========================================\n`);
});

server.on('error', (err) => {
  console.error('[SERVER ERROR]', err);
});

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function sendError(res, code, message) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

function sendJson(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleCommand(req, res) {
  try {
    const cmd = await parseJsonBody(req);
    const deviceSerial = cmd.serial?.trim();

    if (!deviceSerial) {
      return sendError(res, 400, 'Missing device serial');
    }

    const action = cmd.action;
    const value = cmd.value;
    const mode = cmd.mode;

    console.log(`[API] Command received: ${action} ${value} for ${deviceSerial}`);

    global.activeUsers[deviceSerial] = Date.now();

    if (!global.nestDeviceState[deviceSerial]) {
      try {
        const convexState = await convex.getAllState();
        if (convexState && convexState.deviceState) {
          for (const serial in convexState.deviceState) {
            if (!global.nestDeviceState[serial]) {
              global.nestDeviceState[serial] = {};
            }
            for (const key in convexState.deviceState[serial]) {
              const entry = convexState.deviceState[serial][key];
              global.nestDeviceState[serial][key] = {
                object_revision: entry.object_revision || 0,
                object_timestamp: entry.object_timestamp || 0,
                value: entry.value || {}
              };
            }
          }
        }
      } catch (err) {
        console.error(`[API] Failed to load state from Convex:`, err);
      }
    }

    if (!global.nestDeviceState[deviceSerial]) {
      global.nestDeviceState[deviceSerial] = {};
    }

    let objectKey = null;
    let valueUpdate = null;

    switch (action) {
      case 'temp':
      case 'temperature': {
        objectKey = `shared.${deviceSerial}`;
        const record = global.nestDeviceState[deviceSerial][objectKey] || { value: {} };
        const tempValue = parseFloat(value);

        if (!isNaN(tempValue)) {
          const lowerSafety = record.value?.lower_safety_temp || 7.222;
          const upperSafety = record.value?.upper_safety_temp || 35.0;
          const clampedTemp = Math.max(lowerSafety, Math.min(upperSafety, tempValue));

          valueUpdate = {
            target_temperature: clampedTemp,
            target_temperature_type: mode,
            touched_by: {
              touched_by: 'nolongerevil',
              touched_where: 'api',
              touched_source: 'web',
              touched_when: Math.floor(Date.now() / 1000),
              touched_tzo: new Date().getTimezoneOffset() * -60,
              touched_id: 1
            }
          };

          if (cmd.target_temperature_low !== undefined) {
            const lowTemp = parseFloat(cmd.target_temperature_low);
            if (!isNaN(lowTemp)) {
              const clampedLow = Math.max(lowerSafety, Math.min(upperSafety, lowTemp));
              valueUpdate.target_temperature_low = clampedLow;
            }
          }

          if (cmd.target_temperature_high !== undefined) {
            const highTemp = parseFloat(cmd.target_temperature_high);
            if (!isNaN(highTemp)) {
              const clampedHigh = Math.max(lowerSafety, Math.min(upperSafety, highTemp));
              valueUpdate.target_temperature_high = clampedHigh;
            }
          }

          if (cmd.target_change_pending !== undefined) {
            valueUpdate.target_change_pending = cmd.target_change_pending;
          }
        } else {
          return sendError(res, 400, 'Invalid temperature value');
        }
        break;
      }

      case 'away':
        objectKey = `shared.${deviceSerial}`;
        valueUpdate = { auto_away: (value === 'true' || value === '1') ? 2 : 0 };
        break;

      case 'set': {
        objectKey = cmd.object || `shared.${deviceSerial}`;
        const field = cmd.field;
        if (!field) {
          return sendError(res, 400, 'Missing field parameter for set action');
        }
        if (typeof cmd.value === 'object' && cmd.value !== null && !Array.isArray(cmd.value)) {
          valueUpdate = cmd.value;
        } else {
          valueUpdate = { [field]: cmd.value };
        }
        break;
      }

      default:
        return sendError(res, 400, `Unknown action: ${action}`);
    }

    if (!objectKey) {
      return sendError(res, 400, 'Missing object key');
    }

    let storedObj = global.nestDeviceState[deviceSerial][objectKey];
    if (!storedObj) {
      try {
        const convexState = await convex.getState({ serial: deviceSerial, object_key: objectKey });
        if (convexState) {
          storedObj = {
            object_revision: convexState.object_revision || 0,
            object_timestamp: convexState.object_timestamp || 0,
            value: convexState.value || {}
          };
          global.nestDeviceState[deviceSerial][objectKey] = storedObj;
        }
      } catch (err) {
        console.error(`[API] Failed to get state from Convex:`, err);
      }
    }

    if (!storedObj) {
      storedObj = {
        object_revision: 0,
        object_timestamp: Date.now(),
        value: {}
      };
      global.nestDeviceState[deviceSerial][objectKey] = storedObj;
    }

    Object.assign(storedObj.value, valueUpdate);

    const nowMs = Date.now();
    storedObj.object_revision = (storedObj.object_revision || 0) + 1;
    storedObj.object_timestamp = nowMs;

    try {
      await convex.upsertState({
        serial: deviceSerial,
        object_key: objectKey,
        object_revision: storedObj.object_revision,
        object_timestamp: storedObj.object_timestamp,
        value: storedObj.value
      });
    } catch (err) {
      console.error(`[API] Convex upsertState failed:`, err);
    }

    notifyStateChange(deviceSerial, objectKey, {
      object_key: objectKey,
      object_revision: storedObj.object_revision,
      object_timestamp: storedObj.object_timestamp,
      value: storedObj.value
    });

    sendJson(res, {
      success: true,
      message: 'Command handled',
      device: deviceSerial,
      object: objectKey,
      revision: storedObj.object_revision,
      timestamp: storedObj.object_timestamp
    });
  } catch (err) {
    console.error('[API] Command error:', err);
    sendError(res, 500, err.message);
  }
}

async function handleStatus(req, res) {
  try {
    const parsedUrl = new URL(req.url, `http://localhost:${CONTROL_PORT}`);
    const serialParam = parsedUrl.searchParams.get('serial');
    const allDevices = Object.keys(global.nestDeviceState);

    if (serialParam) {
      global.activeUsers[serialParam] = Date.now();
      console.log(`[STATUS] User marked active for device ${serialParam}`);
    }

    let devices = allDevices;
    let deviceState = global.nestDeviceState;

    if (serialParam) {
      if (!allDevices.includes(serialParam)) {
        devices = [];
        deviceState = {};
      } else {
        devices = [serialParam];
        deviceState = { [serialParam]: global.nestDeviceState[serialParam] };
      }
    }

    sendJson(res, { devices, deviceState });
  } catch (err) {
    sendError(res, 400, err.message);
  }
}

async function handleDevices(req, res) {
  const devices = Object.keys(global.nestDeviceState).map(serial => ({
    serial,
    objects: Object.keys(global.nestDeviceState[serial])
  }));
  sendJson(res, devices);
}

// Control API server
const controlServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/command') {
    return handleCommand(req, res);
  }

  if (req.method === 'GET' && req.url && req.url.startsWith('/status')) {
    return handleStatus(req, res);
  }

  if (req.url === '/api/devices') {
    return handleDevices(req, res);
  }

  sendError(res, 404, 'Not Found');
});

controlServer.listen(CONTROL_PORT, () => {
  console.log(`Control API running on port ${CONTROL_PORT}`);
});
