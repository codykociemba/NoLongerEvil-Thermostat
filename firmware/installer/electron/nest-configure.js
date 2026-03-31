/**
 * Configure the Nest device's cloudregisterurl via the on-device nleapi.
 *
 * API (BusyBox httpd CGI on port 8080):
 *   POST {"initialize":"<serial>"}                   -> {"api_key":"<secret>"}
 *   POST {"setup":"true"}                            -> {"api_key":"<secret>","device_name":"<serial>"}
 *                                                       (first-boot window only: within 30min, default URL, lockfile absent)
 *   POST {"api_key":"<k>","endpoint":"<ip:port>"}    -> {"status":"new","cloudregisterurl":"<url>"}
 *   GET  /cgi-bin/api/settings                       -> {"cloudregisterurl":"<url>"}
 *
 * The endpoint field takes "http://ip:port" — CGI strips scheme, validates IP:port, appends /entry.
 */

const BASE_PATH = '/cgi-bin/api/settings';
const TIMEOUT_MS = 5000;

async function nleapiFetch(nestIp, options) {
  const url = `http://${nestIp}:8080${BASE_PATH}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...options,
  });
  if (!res.ok) throw new Error(`nleapi returned HTTP ${res.status}`);
  return res.json();
}

/**
 * Full configure sequence: initialize → update → verify
 * @param {string} nestIp
 * @param {string} serial  - device hostname (from SSH `hostname` command)
 * @param {string} cloudregisterurl - full URL e.g. "http://192.168.1.100:9543/entry"
 * @returns {{ cloudregisterurl: string, serial: string }}
 */
async function configureNest(nestIp, serial, cloudregisterurl) {
  // Strip trailing /entry if present — the CGI appends it itself
  const endpoint = cloudregisterurl.replace(/\/entry$/, '');

  // Step 1: Initialize — exchange serial for api_key
  const initData = await nleapiFetch(nestIp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initialize: serial }),
  });
  if (!initData.api_key) {
    throw new Error('Initialize failed: no api_key in response');
  }
  const { api_key } = initData;

  // Step 2: Update cloudregisterurl
  const updateData = await nleapiFetch(nestIp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key, endpoint }),
  });
  if (updateData.status !== 'new') {
    throw new Error('Update failed: ' + JSON.stringify(updateData));
  }

  // Step 3: Verify — GET and confirm URL matches
  const verifyData = await nleapiFetch(nestIp);
  if (verifyData.cloudregisterurl !== cloudregisterurl) {
    throw new Error(
      `Verification failed: expected ${cloudregisterurl}, got ${verifyData.cloudregisterurl}`
    );
  }

  return { cloudregisterurl: verifyData.cloudregisterurl, serial };
}

/**
 * Phase 0 first-boot setup window.
 * Works within the first 30 minutes after flashing on an unconfigured device.
 * Returns the serial (device_name) and api_key without needing SSH.
 * Used by the Electron installer as a fallback when SSH is unavailable,
 * and by the Home Assistant add-on to self-configure newly flashed devices.
 *
 * @param {string} nestIp
 * @param {string|null} cloudregisterurl - if provided, update the URL after getting api_key
 * @returns {{ serial: string, cloudregisterurl: string|null }}
 */
async function configureViaSetupWindow(nestIp, cloudregisterurl) {
  // Step 1: POST {"setup":"true"} → get api_key + serial (device_name)
  const setupData = await nleapiFetch(nestIp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setup: 'true' }),
  });
  if (!setupData.api_key || !setupData.device_name) {
    throw new Error('Setup window unavailable — device may be past the 30-minute first-boot window or already configured');
  }
  const { api_key, device_name: serial } = setupData;

  if (!cloudregisterurl) {
    return { serial, cloudregisterurl: null };
  }

  // Steps 2-3: Same as configureNest but we already have api_key (skip initialize)
  const endpoint = cloudregisterurl.replace(/\/entry$/, '');

  const updateData = await nleapiFetch(nestIp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key, endpoint }),
  });
  if (updateData.status !== 'new') {
    throw new Error('URL update failed: ' + JSON.stringify(updateData));
  }

  const verifyData = await nleapiFetch(nestIp);
  if (verifyData.cloudregisterurl !== cloudregisterurl) {
    throw new Error(
      `Verification failed: expected ${cloudregisterurl}, got ${verifyData.cloudregisterurl}`
    );
  }

  return { serial, cloudregisterurl: verifyData.cloudregisterurl };
}

module.exports = { configureNest, configureViaSetupWindow };
