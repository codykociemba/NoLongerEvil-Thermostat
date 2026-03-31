const dns = require('dns').promises;
const { probePort } = require('./net-utils');
const { ok, err } = require('./ipc-result');

const NLE_ADDON_PORT = 9543;
const HA_API_PORT = 8123;
const COMMON_HA_IPS = [
  '192.168.1.2',
  '10.0.0.2',
  '192.168.0.2',
  '192.168.1.100',
  '192.168.2.2',
  '10.0.1.2',
];

let activeController = null;

async function discoverHA(onProgress) {
  const controller = new AbortController();
  activeController = controller;
  const { signal } = controller;

  try {
    onProgress({ stage: 'resolving', message: 'Looking for Home Assistant on your network...' });

    // Stage 1A: Try mDNS/DNS resolution of homeassistant.local
    // Works on: macOS (native mDNS), Windows 10 1703+ (Bonjour), Linux with avahi-daemon
    let haIp = null;
    try {
      const { address } = await Promise.race([
        dns.lookup('homeassistant.local'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DNS timeout')), 3000)
        ),
      ]);
      haIp = address;
      onProgress({ stage: 'found_host', message: `Found Home Assistant at ${haIp}` });
    } catch {
      // DNS resolution failed — try common IPs
    }

    // Stage 1B: Scan common IPs if DNS failed
    if (!haIp && !signal.aborted) {
      onProgress({ stage: 'scanning', message: 'Scanning common network addresses...' });
      for (const ip of COMMON_HA_IPS) {
        if (signal.aborted) break;
        const hit = await probePort(ip, HA_API_PORT, 1500);
        if (hit) {
          haIp = ip;
          onProgress({ stage: 'found_host', message: `Found Home Assistant at ${haIp}` });
          break;
        }
      }
    }

    if (!haIp) {
      return err(
        'Home Assistant not found on your network. Please enter the server URL manually.'
      );
    }

    if (signal.aborted) return err('Cancelled');

    // Stage 2: Probe for NLE add-on on port 9543
    onProgress({ stage: 'probing_addon', message: 'Checking for NoLongerEvil add-on...' });
    try {
      const res = await fetch(`http://${haIp}:${NLE_ADDON_PORT}/info`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
      });
      if (res.ok) {
        const info = await res.json();
        if (info.server === 'nolongerevil' && info.cloudregisterurl) {
          // Use ip field from response if present — the add-on knows its own address
          const confirmedIp = info.ip || haIp;
          onProgress({ stage: 'addon_found', message: `NoLongerEvil add-on found at ${confirmedIp}` });
          return ok({
            haIp: confirmedIp,
            addonFound: true,
            cloudregisterurl: info.cloudregisterurl,
          });
        }
      }
    } catch {
      // 404, connection refused, or timeout — add-on not running
    }

    // HA found but add-on missing or not the NLE server
    onProgress({ stage: 'addon_missing', message: 'NoLongerEvil add-on not found on HA' });
    return ok({
      haIp,
      addonFound: false,
      suggestedUrl: `http://${haIp}:${NLE_ADDON_PORT}/entry`,
    });
  } catch (e) {
    if (signal.aborted) return err('Cancelled');
    return err(e.message || 'Discovery failed');
  } finally {
    if (activeController === controller) activeController = null;
  }
}

function cancelHA() {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

module.exports = { discoverHA, cancelHA };
