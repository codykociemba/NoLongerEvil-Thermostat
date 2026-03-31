const { getLocalSubnet, probePort } = require('./net-utils');
const { ok, err } = require('./ipc-result');

// Time to wait before first scan — device needs to boot, connect to WiFi, start httpd
const BOOT_DELAY_MS = 45000;
const POLL_INTERVAL_MS = 10000;
const MAX_POLL_MS = 3 * 60 * 1000;

let activeController = null;

async function confirmNestDevice(ip) {
  try {
    const res = await fetch(`http://${ip}:8080/cgi-bin/api/settings`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return 'cloudregisterurl' in data;
  } catch {
    return false;
  }
}

async function scanSubnet(subnet, signal, onProgress) {
  if (signal.aborted) return [];

  const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);

  // Fan out all 254 probes simultaneously — kernel handles connection limiting
  const results = await Promise.allSettled(hosts.map(ip => probePort(ip, 8080, 800)));

  const hits = results
    .map((r, i) => (r.status === 'fulfilled' && r.value ? hosts[i] : null))
    .filter(Boolean);

  if (hits.length === 0) return [];

  onProgress({ stage: 'confirming', message: `Found ${hits.length} candidate(s), verifying...` });

  // Confirm all hits in parallel
  const confirmResults = await Promise.allSettled(hits.map(ip => confirmNestDevice(ip)));
  return hits.filter((_, i) => confirmResults[i].status === 'fulfilled' && confirmResults[i].value);
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Cancelled'));
    }, { once: true });
  });
}

async function discoverNest(onProgress) {
  const controller = new AbortController();
  activeController = controller;
  const { signal } = controller;

  try {
    const subnet = getLocalSubnet();

    // Optimistic immediate scan — device may already be on the network
    onProgress({ stage: 'scanning', message: 'Scanning network for Nest devices...' });
    const immediate = await scanSubnet(subnet, signal, onProgress);
    if (immediate.length > 0) return ok({ devices: immediate });

    if (signal.aborted) return err('Cancelled');

    // Nothing found — device is probably still booting after flash
    onProgress({
      stage: 'waiting',
      message: 'Nest not found yet — waiting for device to boot and connect to WiFi...',
      waitMs: BOOT_DELAY_MS,
    });
    await sleep(BOOT_DELAY_MS, signal);

    const startTime = Date.now();
    let attempt = 0;

    while (Date.now() - startTime < MAX_POLL_MS) {
      if (signal.aborted) return err('Cancelled');

      attempt++;
      onProgress({
        stage: 'scanning',
        message: `Scanning network for Nest devices... (attempt ${attempt})`,
      });

      const found = await scanSubnet(subnet, signal, onProgress);

      if (found.length > 0) {
        return ok({ devices: found });
      }

      const elapsed = Date.now() - startTime;
      if (elapsed + POLL_INTERVAL_MS >= MAX_POLL_MS) break;

      onProgress({
        stage: 'retrying',
        message: 'Nest not found yet, retrying shortly...',
        retryIn: POLL_INTERVAL_MS,
      });
      await sleep(POLL_INTERVAL_MS, signal);
    }

    return err(
      'Could not find Nest on the network after 3 minutes. Please enter the IP address manually.'
    );
  } catch (e) {
    if (signal.aborted || e.message === 'Cancelled') return err('Cancelled');
    return err(e.message || 'Discovery failed');
  } finally {
    if (activeController === controller) activeController = null;
  }
}

function cancelNest() {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

module.exports = { discoverNest, cancelNest };
