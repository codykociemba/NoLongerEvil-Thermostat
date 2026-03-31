---
title: "feat: Auto-configure Nest URL via Network Discovery in Electron Installer"
type: feat
status: active
date: 2026-03-30
---

# feat: Post-Flash Setup Wizard in Electron Installer

---

## ⚠ Working Constraints

- **Do NOT switch branches, commit, or push anything to git.** Make all modifications locally, verify they work, then leave it for the developer to review and commit.
- **Do NOT modify git history or staging area** in any way.
- **Build and test focus**: after making changes, build the firmware and installer and verify the new wizard steps work correctly end-to-end. The Electron installer and its new post-flash steps are the primary focus.
- If something is broken or unclear, stop and surface it rather than guessing.

---

## Enhancement Summary

**Deepened on:** 2026-03-30  
**Research agents run:** security-sentinel, architecture-strategist, code-simplicity-reviewer, julik-frontend-races-reviewer, kieran-typescript-reviewer, best-practices-researcher, spec-flow-analyzer, repo-research-analyst, performance-oracle, UX/design review

### Critical Findings (blocking)

1. ~~**Shell injection vulnerability** in `firmware/builder/deps/settings:121`~~ **FIXED** — `ESCAPED_URL` escape + double-quoted `sed -i` at `deps/settings:121–122`.
2. **`chpasswd` via template literal is insecure** — password must be written to stdin of an SSH exec stream, never interpolated into a shell command string.
3. **SSH operation order is wrong** in the original plan — disabling SSH before setting the URL means we lose the connection before verification. Correct order: serial → write URL → verify URL → disable SSH last.
4. **`preload.js` was never mentioned** — every new `ipcMain.handle` in `main.js` requires a matching `contextBridge.exposeInMainWorld` entry in `preload.js`. Without this the renderer cannot call the IPC channels. This is a hard blocker.
5. **`SuccessScreen` has zero props** — it cannot accept wizard data as-is. The new wizard screens must splice between INSTALL and SUCCESS, not chain off SUCCESS.
6. **HTTP timeouts are missing** on all `fetch()` calls to the nleapi — a non-responsive device will hang the installer forever.

### Key Improvements
1. SSH operation order corrected: serial → URL update → verify → SSH config last
2. `preload.js` update path documented explicitly for every new IPC channel
3. Shared `net-utils.js` / `ipc-result.js` modules replace copy-pasted patterns
4. `ssh2` native build artifacts require `asarUnpack` additions to `package.json`
5. `AbortController` propagation enables clean wizard cancellation at every step
6. Phase 0 (first-boot window) may be deleted — SSH covers every case it handles and the window adds firmware complexity for a failure mode we control

### Simplicity Recommendations (consider)
- **Delete Phase 0** — SSH gives us the serial directly; the 30-minute window is a fallback for a failure mode we control (firmware with `--enable-root-access`). Removing it simplifies both firmware and installer.
- **Drop `multicast-dns`** — `dns.lookup('homeassistant.local')` works on every target platform (macOS, Win 10+, Linux+avahi). The npm dependency costs more than it saves.
- **Remove ARP OUI pre-filter** — more maintenance surface; the port scan is fast enough on its own (all 254 hosts simultaneously, 800ms timeout ≈ <2s wall time).
- **Merge `HADiscoveryStep` + `NestDiscoveryStep`** into `DiscoveryStep` — they share the same spinner/retry/manual-input pattern.
- **Merge `configure-nest-ssh` + `configure-nest-url`** IPC handlers — single round-trip for the SSH session.

---

## Overview

After flashing, users must manually SSH into the Nest and edit `cloudregisterurl` to point at their Home Assistant server. This plan replaces that with a guided post-flash wizard in the Electron installer that:

1. Asks whether the user is staying on the cloud (hosted) or self-hosting on Home Assistant
2. Asks about SSH access — disable it (secure default) or set a custom password
3. SSHs into the device using the default credentials to apply SSH changes and capture the device serial (hostname)
4. For self-hosted users: discovers Home Assistant on the network, then uses the on-device `nleapi` HTTP API to update `cloudregisterurl` — no manual editing required
5. Verifies the configuration completed successfully

---

## Current Architecture

### Post-flash state of the device

- SSH (dropbear) is running on port 22
- Default credentials: `root` / `nolongerevil`
- `nleapi` (BusyBox httpd) is running on port 8080
- `cloudregisterurl` in `/etc/nestlabs/client.config` points at `http://backdoor.nolongerevil.com/entry`
- Device hostname = device serial number (e.g., `02AAXXXXXXXX`)

### On-device `nleapi` (PR #116, Dec 2025)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `GET` | `/cgi-bin/api/settings` | — | `{"cloudregisterurl":"<url>"}` |
| `POST` | `/cgi-bin/api/settings` | `{"initialize":"<serial>"}` | `{"api_key":"<secret>"}` |
| `POST` | `/cgi-bin/api/settings` | `{"api_key":"<k>","endpoint":"<ip:port>"}` | `{"status":"new","cloudregisterurl":"<url>"}` |

**Note on `endpoint`**: takes `http://<ip>:<port>` format — CGI strips scheme, validates IP:port, appends `/entry`.

### Electron Installer (current state)

- `firmware/installer/electron/main.js` — IPC handler hub
- `firmware/installer/electron/preload.js` — `contextBridge` surface (must be updated for every new IPC channel)
- `firmware/installer/electron/usb-handler.js` — USB flash logic
- React + Tailwind frontend, Vite build
- Screen state machine: `WELCOME → SYSTEM_CHECK → GENERATION_SELECT → INSTALL → SUCCESS / ERROR`
- No React Router, no context/providers — screen state is flat `useState` + `handleNext(screen, data)` in `App.jsx`
- Dependencies: `react`, `react-dom`, `sudo-prompt`, `usb`
- No SSH, no HTTP client, no network discovery currently

**Known pre-existing issues in the codebase** (do not introduce more):
- `InstallScreen.jsx` — `hasStartedRef` destroyed on unmount; Back+Forward causes duplicate flash sessions
- `InstallScreen.jsx` — `setTimeout(() => onSuccess(), 2000)` untracked; leaks on unmount
- `preload.js` — `removeInstallationProgressListener` calls `removeAllListeners` (too broad); fix by returning a specific cleanup function from listener registration
- `main.js:91` — `mainWindow.webContents.send(...)` has no null-check; window closed mid-flash = crash. Fix: `if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(...)`

---

## Full Post-Flash Wizard Flow

```
USB Flash Complete
       │
       ▼
┌─────────────────────────────┐
│  Step 1: Hosting Mode       │
│  ○ Cloud hosted             │
│  ○ Self-hosted (Home Asst.) │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Step 2: SSH Access         │
│  ○ Disable SSH (recommended)│
│  ○ Enable with new password │
│    [Password] [Confirm]     │
│    [strength bar]           │
└─────────────────────────────┘
       │
       ▼ (self-hosted only)
┌─────────────────────────────┐
│  Step 3: Home Assistant     │
│  Auto-discovering...        │
│  ✓ HA found: 192.168.1.100  │
│  ✓ NLE add-on running       │
│    URL: ...:9543/entry      │
│  [Use this] [Enter manually]│
│                             │
│  — or if add-on not found —  │
│  HA found but NLE add-on    │
│  isn't running yet.         │
│  [Retry] [Enter URL]        │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Step 4: Finding your Nest  │
│  Plug Nest into power now.  │
│  Scanning network... (45s)  │
│  ✓ Found: 192.168.1.251     │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Step 5: Configuring...     │
│  ✓ Connected via SSH        │
│  ✓ Serial: 02AAXXXXXXXX     │
│  ✓ cloudregisterurl updated │  ← URL update BEFORE SSH config
│  ✓ Verified                 │  ← Verify BEFORE disabling SSH
│  ✓ SSH disabled / password  │  ← SSH config LAST
│    changed                  │
└─────────────────────────────┘
```

**Critical**: SSH operation order must be: connect → get serial → update URL → verify URL → configure SSH (change password / disable). Disabling SSH before verifying the URL leaves the device misconfigured with no recovery path.

---

## Technical Approach

### Phase 0: Firmware Patch — First-Boot Setup Window (Optional / Consider Deleting)

> **Simplicity note**: Phase 0 adds firmware complexity as a fallback for SSH failures. Since SSH gives us everything Phase 0 provides (serial + api_key path), and SSH failures are a failure mode we control (firmware must be built with `--enable-root-access`), the security-simplicity reviewers recommend **deleting Phase 0 entirely**. If SSH is available (it always is on our firmware), this window is never needed. Only keep if there's a known use case where SSH won't be available.

If retained: modifies the `settings` CGI to allow `initialize` without a serial if the device is unconfigured AND was recently booted.

**File**: `firmware/builder/deps/settings`

```diff
 check_for_api_key
 log_writer "Received a $REQUEST_METHOD request."
 RAW_BODY="$(cat)"

+UPTIME=$(awk '{print int($1)}' /proc/uptime)
+IS_DEFAULT=$(echo "$CURRENT_URL" | grep -c "backdoor.nolongerevil.com")
+SETUP_LOCK="$NEST_CONFIG_DIR/.setup_done"
+
 if [[ "$REQUEST_METHOD" == "POST" ]]; then
   INITIALIZEID=$(printf '%s\n' "$RAW_BODY" | busybox2 sed -n 's/.*"initialize":"\([^"]*\)".*/\1/p')
   if [[ -n "$INITIALIZEID" ]]; then
     if [[ "$DEVICE_NAME" == "$INITIALIZEID" ]]; then
       HTTP_OUTPUT=`printf '{"api_key":"%s"}' "$API_KEY"`
       return_response "200" "$HTTP_OUTPUT"
     fi
   fi

+  # First-boot setup window: unconfigured + booted within 30 minutes + not already used
+  SETUP_REQUEST=$(printf '%s\n' "$RAW_BODY" | busybox2 sed -n 's/.*"setup":"\([^"]*\)".*/\1/p')
+  if [[ "$SETUP_REQUEST" == "true" && "$IS_DEFAULT" -eq 1 && "$UPTIME" -lt 1800 && ! -f "$SETUP_LOCK" ]]; then
+    log_writer "First-boot setup window active. Granting api_key."
+    touch "$SETUP_LOCK"   # one-shot: prevent replay within the window
+    HTTP_OUTPUT=`printf '{"api_key":"%s","device_name":"%s"}' "$API_KEY" "$DEVICE_NAME"`
+    return_response "200" "$HTTP_OUTPUT"
+  fi
```

This also adds `device_name` to the response so the installer captures the serial even via this path. The lockfile prevents replay attacks within the 30-minute window.

**Also fix the shell injection on line 121** (exists today, unrelated to Phase 0):
```diff
-      busybox2 sed -i 's|<a key="cloudregisterurl" value="[^"]*"|<a key="cloudregisterurl" value="'$NEW_URL'"|g' $TARGET_FILE
+      ESCAPED_URL=$(printf '%s' "$NEW_URL" | busybox2 sed 's/[&/\]/\\&/g')
+      busybox2 sed -i "s|<a key=\"cloudregisterurl\" value=\"[^\"]*\"|<a key=\"cloudregisterurl\" value=\"${ESCAPED_URL}\"|g" $TARGET_FILE
```

---

### Phase 1: Home Assistant Discovery

**New file**: `firmware/installer/electron/ha-discovery.js`

Two-stage process: first find the HA host on the network, then probe for the NLE add-on.

#### Stage 1A: Locate HA host (tried in order, first success wins)

**DNS resolution** (works on macOS/Win10+/Linux with avahi — covers all production targets):
```javascript
const dns = require('dns').promises;

async function resolveHAHost(signal) {
  const { address } = await dns.lookup('homeassistant.local');
  return address;
}
```

**Common IP scan** (fallback — Linux without avahi):  
Try `192.168.1.2`, `10.0.0.2`, `192.168.0.2` — verify each with `GET :<port>/api/` using a short timeout.

> **Simplicity note**: Drop `multicast-dns` as a dependency. `dns.lookup('homeassistant.local')` works on every production target platform (macOS uses mDNS natively, Windows 10+ 1703+ has Bonjour built in, Linux deployments with HA almost always have avahi). The npm package adds ~150KB and a native C extension for marginal gain on an edge case.

#### Stage 1B: Probe for NLE Home Assistant Add-on

Once the HA host IP is known, try the NLE add-on `/info` endpoint:

```javascript
async function probeNLEAddon(haIp, signal) {
  const controller = signal ? undefined : new AbortController();
  const fetchSignal = signal ?? controller.signal;
  
  try {
    const res = await fetch(`http://${haIp}:9543/info`, {
      signal: AbortSignal.any([fetchSignal, AbortSignal.timeout(3000)]),
    });
    if (res.ok) {
      const info = await res.json();
      if (info.server === 'nolongerevil' && info.cloudregisterurl) {
        return { found: true, ...info };
      }
    }
  } catch {}
  return { found: false };
}
```

**Example request** (from within HA or when testing locally):
```
GET http://localhost:9543/info
```

**Response shape** (when add-on is running):
```json
{
  "server": "nolongerevil",
  "version": "1.0.1",
  "api_origin": "http://192.168.1.201:9543",
  "cloudregisterurl": "http://192.168.1.201:9543/entry",
  "ip": "192.168.1.201",
  "port": 9543,
  "ssl": false,
  "require_device_pairing": false,
  "entry_key_ttl_seconds": 3600
}
```

**If add-on returns 200**: Use `cloudregisterurl` from the response directly. No user input needed.

**If add-on returns 404 / connection refused**: Add-on not running yet. Show the user:
> "Home Assistant found at 192.168.1.100, but the NoLongerEvil add-on isn't running yet.  
> Install and start the add-on in HA, then click Retry — or enter the URL manually."

Pre-fill the manual input with the constructed default: `http://<ha-ip>:9543/entry` so the user only needs to confirm rather than type from scratch.

**Manual fallback**: Full URL input field, pre-filled with best guess. Always visible as escape hatch.

#### Research Insights

**Timeout handling:**  
All `fetch()` calls must use `AbortSignal.timeout(N)`. Without it, a device that accepts the TCP connection but never responds will hang the installer indefinitely. Use `AbortSignal.any([cancelSignal, AbortSignal.timeout(3000)])` to combine cancellation with timeout.

**`dns.lookup` behavior on Windows:**  
On Windows, `dns.lookup('homeassistant.local')` uses the system resolver which calls mDNS if the `.local` name isn't in hosts. This works on Win 10 1703+ without additional software. On older Win 10, the mDNS fallback should advise the user to install iTunes or Bonjour Print Services.

---

### Phase 2: Nest Discovery

**New file**: `firmware/installer/electron/nest-discovery.js`

After the USB flash, prompt user to plug in the Nest. Wait 45 seconds before first scan (device boot + DHCP + httpd startup takes ~60–90 seconds; starting the scan too early means the first pass always misses and wastes a polling slot).

**2A — Subnet port scan port 8080** (~1–2 seconds):
```javascript
const net = require('net');

async function scanSubnet(subnet, signal) {
  // Get local /24 subnet from os.networkInterfaces()
  const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
  
  // All 254 hosts simultaneously — TCP connect is kernel-limited, not CPU-bound
  const results = await Promise.allSettled(
    hosts.map(ip => probePort8080(ip, signal))
  );
  
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

async function probePort8080(ip, signal) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(null);
    }, 800); // 800ms per host — fast enough for LAN, not so fast it drops valid slow hosts
    
    socket.connect(8080, ip, () => {
      clearTimeout(timeout);
      socket.destroy(); // use destroy(), not end() — end() waits for FIN
      resolve(ip);
    });
    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}
```

**Confirm it's a Nest** — for each port-8080 hit, `GET /cgi-bin/api/settings` and confirm response has `cloudregisterurl` key:
```javascript
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
```

**2B — Retry loop**: After the initial 45s boot delay, poll every 10 seconds for up to 3 minutes total. Show countdown in UI. Each iteration rescans the full subnet.

**Manual fallback**: User enters Nest IP directly. Always available.

> **Simplicity note**: Drop the ARP OUI pre-filter. It adds platform-specific `arp -a` parsing (macOS/Linux use colons in MACs, Windows uses dashes), requires shell exec permission, and saves at most 1–2 seconds over the all-254 simultaneous scan which completes in ~800ms on a typical home LAN. The port scan is both simpler and more reliable.

#### Research Insights

**`socket.destroy()` vs `socket.end()`:**  
Use `socket.destroy()` to abort TCP connections. `socket.end()` sends FIN and waits for the peer to respond — for refused/timed-out connections this doubles the wait time.

**`Promise.allSettled` for all 254:**  
Use `allSettled` (not `all`) so a single timeout doesn't abort the entire scan. All sockets fan out simultaneously; the kernel handles the connection limiting.

**Multiple devices:**  
If the scan finds more than one candidate, show a selection list with the device IP and the `cloudregisterurl` value from each (to help the user identify theirs). Do not auto-select when multiple are found.

**Cancellation:**  
Pass an `AbortController` signal through from the wizard. When the user navigates Back or closes the wizard, call `controller.abort()` to cancel all in-flight sockets and fetch calls.

---

### Phase 3: SSH Configuration

**New file**: `firmware/installer/electron/ssh-handler.js`

**New npm dependency**: `ssh2`

> **`ssh2` native build note**: The `ssh2` package includes `cpu-features`, a C++ addon. It must be added to `asarUnpack` in `package.json` or it will fail to load from the asar archive. See the Dependencies section for the exact config.
>
> **Alternative**: `@electerm/ssh2` is a maintained fork with the same API and fewer native-build issues on Windows. Consider it if `ssh2` native build causes CI problems on Windows builds.

#### CRITICAL: SSH Operation Order

**Wrong order (as originally planned):**
```
connect → serial → disable SSH → update URL → verify
                        ↑
         disabling SSH first kills the connection before we can
         set or verify the URL — device is now misconfigured
         with no recovery path
```

**Correct order:**
```
connect → serial → update URL → verify URL → configure SSH last
```

If the user chose to disable SSH: disconnect from SSH session, then the device will lose connectivity to port 22. The URL has already been verified at this point, so the device is correctly configured.

#### CRITICAL: Password Security

**Never use template literals for passwords in shell commands.** A password containing `'`, `"`, `$`, `` ` ``, or `\` will either break the command or execute arbitrary shell code.

**Wrong** (shell injection):
```javascript
// DO NOT DO THIS
await runCommand(conn, `echo 'root:${opts.newPassword}' | chpasswd`);
```

**Correct** (write to stdin):
```javascript
async function changePassword(conn, newPassword) {
  return new Promise((resolve, reject) => {
    conn.exec('chpasswd', (err, stream) => {
      if (err) return reject(err);
      let stderr = '';
      stream.stderr.on('data', d => stderr += d);
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`chpasswd failed: ${stderr}`));
        else resolve();
      });
      // Write "root:newpassword\n" to stdin then close
      stream.write(`root:${newPassword}\n`);
      stream.end();
    });
  });
}
```

#### SSH Implementation

```javascript
const { Client } = require('ssh2');

async function connectSSH(ip) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.connect({
      host: ip,
      port: 22,
      username: 'root',
      password: 'nolongerevil',
      readyTimeout: 10000,
      keepaliveInterval: 5000,
    });
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
  });
}

async function runCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let stderr = '';
      stream.on('data', d => out += d);
      stream.stderr.on('data', d => stderr += d);
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`Command failed (${code}): ${stderr.trim()}`));
        else resolve(out.trim());
      });
    });
  });
}

async function configureViaSSH(ip, opts) {
  const conn = await connectSSH(ip);

  try {
    // 1. Get serial (hostname = device serial) — FIRST
    const serial = await runCommand(conn, 'hostname');

    // 2. Return serial immediately — caller uses it for nleapi (Phase 4)
    // URL update and verification happen in Phase 4 before we come back here

    return { serial, conn }; // caller holds conn open for SSH config in step 4
  } catch (err) {
    conn.end();
    throw err;
  }
}

async function finalizeSSHConfig(conn, opts) {
  // Called AFTER URL update and verification (Phase 4)
  try {
    if (opts.disableSSH) {
      // Remove dropbear from startup — no PID file exists, use killall
      await runCommand(conn, "sed -i '/\\/bin\\/dropbear/d' /etc/init.d/rcS");
      await runCommand(conn, 'killall dropbear || true');
      // Note: 'killall' succeeds even if no process found when '|| true' is appended
    } else if (opts.newPassword) {
      await changePassword(conn, opts.newPassword);
    }
  } finally {
    conn.end();
  }
}
```

**Dropbear disable**: The rcS entry is `/bin/dropbear` (no PID file). Use `sed -i '/\/bin\/dropbear/d' /etc/init.d/rcS` to remove the startup entry and `killall dropbear` to stop the running process. The `|| true` prevents error propagation if dropbear is already stopped.

---

### Phase 4: Nest Configuration via nleapi

**New file**: `firmware/installer/electron/nest-configure.js`

Uses the serial obtained from SSH (Phase 3). All `fetch()` calls include explicit timeouts.

```javascript
async function configureNest(nestIp, serial, cloudregisterurl) {
  const baseUrl = `http://${nestIp}:8080/cgi-bin/api/settings`;

  // Strip trailing /entry if present — the CGI appends it
  const endpoint = cloudregisterurl.replace(/\/entry$/, '');

  // Step 1: Get api_key using serial from SSH
  const initRes = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initialize: serial }),
    signal: AbortSignal.timeout(5000),
  });
  if (!initRes.ok) throw new Error(`Initialize failed: HTTP ${initRes.status}`);
  const { api_key } = await initRes.json();

  // Step 2: Update cloudregisterurl
  const updateRes = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key, endpoint }),
    signal: AbortSignal.timeout(5000),
  });
  if (!updateRes.ok) throw new Error(`Update failed: HTTP ${updateRes.status}`);
  const result = await updateRes.json();
  if (result.status !== 'new') throw new Error('Update failed: ' + JSON.stringify(result));

  // Step 3: Verify — GET settings and confirm the URL matches
  const verifyRes = await fetch(baseUrl, {
    signal: AbortSignal.timeout(5000),
  });
  if (!verifyRes.ok) throw new Error(`Verify failed: HTTP ${verifyRes.status}`);
  const { cloudregisterurl: confirmed } = await verifyRes.json();
  if (confirmed !== cloudregisterurl) throw new Error('Verification failed: URL mismatch');

  return { cloudregisterurl: confirmed, serial };
}
```

**Phase 0 fallback** (only if Phase 0 firmware patch is included):
```javascript
// Fallback: first-boot setup window when SSH was unavailable
const setupRes = await fetch(baseUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ setup: 'true' }),
  signal: AbortSignal.timeout(5000),
});
const data = await setupRes.json();
api_key = data.api_key;
if (!serial) serial = data.device_name;
```

---

### Phase 5: Installer UI

New wizard steps added **between** `INSTALL` and `SUCCESS` in the React frontend. The `SuccessScreen` currently accepts zero props — do not extend it. The new `SetupCompleteStep` serves as the wizard's terminal screen and carries all configuration data.

#### Critical: App.jsx Screen Splice

The current screen machine ends at `SUCCESS` after `INSTALL`. The wizard steps splice in as:

```
INSTALL → HOSTING_MODE → SSH_CONFIG → [HA_DISCOVERY] → NEST_DISCOVERY → CONFIGURING → SETUP_COMPLETE
```

The existing `SUCCESS` / `ERROR` screens are for flash-only outcomes. The new `SETUP_COMPLETE` screen is the wizard's success terminal.

**Add to `SCREENS` const in `App.jsx`:**
```javascript
const SCREENS = {
  // ... existing screens ...
  HOSTING_MODE: 'HOSTING_MODE',
  SSH_CONFIG: 'SSH_CONFIG',
  HA_DISCOVERY: 'HA_DISCOVERY',
  NEST_DISCOVERY: 'NEST_DISCOVERY',
  CONFIGURING: 'CONFIGURING',
  SETUP_COMPLETE: 'SETUP_COMPLETE',
};
```

Wire `handleNext('HOSTING_MODE', data)` at the end of the `INSTALL` screen's success path instead of `handleNext('SUCCESS', data)`.

#### Critical: preload.js Must Be Updated

**Every** new `ipcMain.handle(channel, ...)` in `main.js` requires a matching entry in `preload.js`'s `contextBridge.exposeInMainWorld`. Without this, `window.electronAPI.<method>` is `undefined` in the renderer and the IPC call silently does nothing.

**Additions needed in `preload.js`:**
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing entries ...

  // New wizard channels
  discoverHomeAssistant: () => ipcRenderer.invoke('discover-home-assistant'),
  discoverNest: () => ipcRenderer.invoke('discover-nest'),
  cancelDiscovery: () => ipcRenderer.invoke('cancel-discovery'),
  configureNestSSH: (opts) => ipcRenderer.invoke('configure-nest-ssh', opts),
  configureNestUrl: (opts) => ipcRenderer.invoke('configure-nest-url', opts),

  // Push-based progress events — return cleanup function (not removeAllListeners)
  onDiscoveryProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('discovery-progress', handler);
    return () => ipcRenderer.removeListener('discovery-progress', handler);
  },
  onConfigProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('config-progress', handler);
    return () => ipcRenderer.removeListener('config-progress', handler);
  },
});
```

Note the pattern: `on*` listeners return a cleanup function. The renderer calls the cleanup in a `useEffect` return. This avoids the too-broad `removeAllListeners` pattern already present in the codebase.

#### State Management: useReducer

The wizard carries state across 5+ screens. `useState` per-screen causes prop drilling and makes Back navigation awkward. Use `useReducer` with a `WizardContext`:

```typescript
// firmware/installer/src/wizard/WizardContext.tsx

interface WizardState {
  hostingMode: 'hosted' | 'selfhosted' | null;
  sshMode: 'disable' | 'password' | null;
  sshPassword: string;        // CLEAR immediately after SSH call
  haAddress: string | null;
  cloudregisterurl: string | null;
  nestIp: string | null;
  serial: string | null;
  configSteps: ConfigStep[];
}

type WizardAction =
  | { type: 'SET_HOSTING_MODE'; mode: WizardState['hostingMode'] }
  | { type: 'SET_SSH_CONFIG'; sshMode: WizardState['sshMode']; sshPassword?: string }
  | { type: 'SET_HA_ADDRESS'; address: string; cloudregisterurl: string }
  | { type: 'SET_NEST_IP'; ip: string }
  | { type: 'SET_SERIAL'; serial: string }
  | { type: 'ADD_CONFIG_STEP'; step: ConfigStep }
  | { type: 'CLEAR_PASSWORD' };  // call immediately after SSH session
```

Key: `CLEAR_PASSWORD` action zeroes the password from state the moment SSH configuration is complete. Never persist the password to disk, localStorage, or IPC messages beyond what's needed for the SSH call itself.

#### New IPC Handlers in `main.js`

```javascript
// Null-check pattern — fix pre-existing issue too
function sendProgress(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

ipcMain.handle('discover-home-assistant', async () => {
  const { discoverHA } = require('./ha-discovery');
  return discoverHA((progress) => sendProgress('discovery-progress', progress));
});

ipcMain.handle('discover-nest', async () => {
  const { discoverNest } = require('./nest-discovery');
  return discoverNest((progress) => sendProgress('discovery-progress', progress));
});

ipcMain.handle('cancel-discovery', async () => {
  // Signal cancellation to in-progress discovery via module-level AbortController
  cancelActiveDiscovery();
  return { success: true };
});

ipcMain.handle('configure-nest-ssh', async (event, opts) => {
  // opts: { nestIp }
  // Returns { serial, conn } — conn held in module scope for finalizeSSHConfig
  const { configureViaSSH } = require('./ssh-handler');
  return configureViaSSH(opts.nestIp, opts);
});

ipcMain.handle('configure-nest-url', async (event, opts) => {
  // opts: { nestIp, serial, cloudregisterurl }
  const { configureNest } = require('./nest-configure');
  return configureNest(opts.nestIp, opts.serial, opts.cloudregisterurl);
});

ipcMain.handle('finalize-ssh-config', async (event, opts) => {
  // opts: { disableSSH, newPassword }
  // Called AFTER URL is verified
  const { finalizeSSHConfig } = require('./ssh-handler');
  return finalizeSSHConfig(opts);
});
```

> **Note on conn lifecycle**: The SSH connection is opened in `configure-nest-ssh`, used for serial retrieval, held open while nleapi operations run (`configure-nest-url`), then closed in `finalize-ssh-config`. The main process holds the `Client` instance in module scope between IPC calls. Clean up on error with `try/finally`.

#### Wizard Step Components

**`firmware/installer/src/components/`:**
- `HostingModeStep.tsx` — hosted vs self-hosted selection
- `SSHConfigStep.tsx` — disable vs enable with password inputs + confirm + zxcvbn-ts strength indicator
- `HADiscoveryStep.tsx` — auto-discovery spinner + found/manual override (self-hosted only)
- `NestDiscoveryStep.tsx` — "Plug in your Nest" + 45s initial delay + scan progress + countdown
- `ConfiguringStep.tsx` — step-by-step progress list (SSH connect, serial, URL update, verify, SSH config)
- `SetupCompleteStep.tsx` — success summary with copy buttons for serial and URL

**UX details:**
- Vertical step sidebar (like a progress tracker) showing all 5 steps, current step highlighted
- Each discovery step has inline "Enter manually" link that replaces the spinner with an input without navigating away
- `SetupCompleteStep`: one-click copy buttons for serial number and `cloudregisterurl`
- "Configure later" available on `NestDiscoveryStep` and `SSHConfigStep` — exits wizard with a "You can re-run setup from the ..." message
- Back navigation: `HostingModeStep` → `SSHConfigStep` → `HADiscoveryStep` (if shown) — but NOT from `ConfiguringStep` (once SSH has started, can't undo)

---

## Shared Infrastructure Modules

### `firmware/installer/electron/net-utils.js`

Shared networking primitives used by both `ha-discovery.js` and `nest-discovery.js`:

```javascript
const os = require('os');

function getLocalSubnet() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const parts = addr.address.split('.');
        return parts.slice(0, 3).join('.');
      }
    }
  }
  return '192.168.1'; // fallback
}

function probePort(ip, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new (require('net').Socket)();
    const timer = setTimeout(() => { socket.destroy(); resolve(null); }, timeoutMs);
    socket.connect(port, ip, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(ip);
    });
    socket.on('error', () => { clearTimeout(timer); resolve(null); });
  });
}

module.exports = { getLocalSubnet, probePort };
```

### `firmware/installer/electron/ipc-result.js`

Consistent IPC response shape — avoids the inconsistent `{ success, error }` vs raw value pattern scattered across existing handlers:

```javascript
function ok(data) { return { success: true, ...data }; }
function err(message, detail) { return { success: false, error: message, detail }; }

module.exports = { ok, err };
```

---

## Implementation Phases (Checklist)

> **Legend**: `[x]` = done · `[-]` = partial/deviated (functional but differs from plan spec) · `[ ]` = not yet done
> File references point to verified implementation location.

### Phase 0: Firmware Patch — First-Boot Setup Window
- [x] Modify `firmware/builder/deps/settings`
  - [x] ⚠️ **Fix shell injection on line 121 first** — *Fixed: `firmware/builder/deps/settings:123–124`*
  - [x] Add uptime + default URL check — *`firmware/builder/deps/settings:90–92`: `UPTIME`, `IS_DEFAULT`, `SETUP_LOCK` vars*
  - [x] Add lockfile (`$SETUP_LOCK`) to prevent replay within window — *`firmware/builder/deps/settings:108`: `touch "$SETUP_LOCK"`*
  - [x] Accept `{"setup":"true"}` within 30-minute window — *`firmware/builder/deps/settings:105–111`: `SETUP_REQUEST` check with all guards*
  - [x] Return `device_name` alongside `api_key` in setup response — *`firmware/builder/deps/settings:109`: `{"api_key":"%s","device_name":"%s"}`*
- [x] Add `configureViaSetupWindow` to `firmware/installer/electron/nest-configure.js` — *nest-configure.js:70–113: skips initialize step, uses api_key from window response directly*
- [x] Wire setup window fallback in `configure-nest` IPC handler — *main.js: SSH connect wrapped in inner try/catch; on failure calls `configureViaSetupWindow`; SSH config steps skipped with `status: 'skipped'` if SSH was unavailable*

### Phase 1: HA Discovery
- [x] Create `firmware/installer/electron/net-utils.js`
  - *`getLocalSubnet()`: net-utils.js:4–15 · `probePort()`: net-utils.js:22–39*
- [x] Create `firmware/installer/electron/ha-discovery.js`
  - [x] `dns.lookup('homeassistant.local')` with 3s timeout — *ha-discovery.js:29–38 (Promise.race 3000ms)*
  - [x] Common IP scan fallback (no multicast-dns) — *ha-discovery.js:43–54*
  - [-] Verification `GET :<port>/api/` to confirm HA — *PARTIAL: common-IP scan uses TCP probe only (probePort), no HTTP GET confirmation of HA host*
  - [x] `GET :9543/info` → parse NLE add-on response — *ha-discovery.js:67–85, validates `info.server === 'nolongerevil' && info.cloudregisterurl`, uses `info.ip` from response*
  - [x] All fetch calls have `AbortSignal.timeout` + cancellation support — *ha-discovery.js:69 (`AbortSignal.any`), cancelHA() at ha-discovery.js:102–107*
- [x] Add IPC handler `discover-home-assistant` in `main.js` — *main.js:246–254*
- [x] Add `discoverHomeAssistant` entry in `preload.js` — *preload.js:23*

### Phase 2: Nest Discovery
- [x] Create `firmware/installer/electron/nest-discovery.js`
  - [x] /24 subnet port scan port 8080 (all 254 hosts simultaneously, 800ms timeout each) — *nest-discovery.js:27–30*
  - [x] Use `socket.destroy()` not `socket.end()` — *net-utils.js:27 (via probePort)*
  - [x] Confirm NLE Nest via `GET /cgi-bin/api/settings` with 2s timeout — *nest-discovery.js:11–22 (confirmNestDevice)*
  - [x] 45-second initial boot delay before first scan — *nest-discovery.js:5 (BOOT_DELAY_MS=45000), lines 71–73*
  - [x] 3-minute polling loop with 10s intervals — *nest-discovery.js:6–7 (POLL_INTERVAL_MS=10000, MAX_POLL_MS=180000), lines 77–101*
  - [x] Multiple-device list if >1 found — *nest-discovery.js returns `ok({ devices: found })` array; NestDiscoveryStep.jsx:108–123 renders selection list*
  - [x] AbortController cancellation support — *nest-discovery.js:59–61, cancelNest() at lines 114–120*
- [x] Add IPC handler `discover-nest` in `main.js` — *main.js:258–266*
- [x] Add IPC handler `cancel-discovery` in `main.js` — *main.js:268–278 (cancels both HA and Nest)*
- [x] Add `discoverNest` and `cancelDiscovery` entries in `preload.js` — *preload.js:24–25*

### Phase 3: SSH Handler
- [x] Create `firmware/installer/electron/ssh-handler.js`
  - [x] `connectSSH(ip)` — connect with default credentials, 10s timeout — *ssh-handler.js:25–39*
  - [x] `runCommand(conn, cmd)` — execute and capture stdout + stderr separately — *ssh-handler.js:42–58*
  - [x] `changePassword(conn, newPassword)` — write to stdin, never template literal — *ssh-handler.js:65–80*
  - [-] `configureViaSSH(ip, opts)` returning `{ serial, conn }` — *DEVIATED (intentional simplification): SSH orchestration merged into single `configure-nest` IPC handler in main.js:285–335. Behavior equivalent; plan's own simplicity recommendations endorsed this merge.*
  - [-] `finalizeSSHConfig(conn, opts)` export — *DEVIATED (intentional): finalization logic is inline in main.js:315–325. No separate exported function.*
  - [x] Dropbear disable: `disableSSH()` — *ssh-handler.js:87–98: `sed -i '/\/bin\/dropbear/d' /etc/init.d/rcS` + `killall dropbear` (fire-and-forget pattern)*
- [x] Add `ssh2` to `package.json` dependencies — *package.json:81 `"ssh2": "^1.16.0"`*
- [x] Add `asarUnpack` entries for `ssh2` native modules — *package.json:37–41: `**/node_modules/cpu-features/**` + `**/node_modules/ssh2/lib/protocol/crypto/build/**`*
- [-] Add IPC handlers `configure-nest-ssh`, `finalize-ssh-config` in `main.js` — *DEVIATED (intentional): merged into single `configure-nest` handler at main.js:285. Covers all SSH + nleapi operations in one call.*
- [-] Add `configureNestSSH`, `finalizeSSHConfig` entries in `preload.js` — *DEVIATED (intentional): preload.js exposes `configureNest` (line 29) which maps to the merged handler.*

### Phase 4: nleapi Configuration
- [x] Create `firmware/installer/electron/nest-configure.js`
  - [x] `configureNest(nestIp, serial, cloudregisterurl)` — initialize, update, verify — *nest-configure.js:32–66*
  - [x] All `fetch()` calls use `AbortSignal.timeout(5000)` — *nest-configure.js:15–23 (via `nleapiFetch` wrapper with `TIMEOUT_MS = 5000`)*
  - [x] Verify response URL matches exactly before returning — *nest-configure.js:57–63*
- [x] Create `firmware/installer/electron/ipc-result.js` — *ipc-result.js:1–11, exports `ok()` and `err()`*
- [-] Add IPC handler `configure-nest-url` in `main.js` — *DEVIATED: merged into `configure-nest` handler at main.js:285*
- [-] Add `configureNestUrl` entry in `preload.js` — *DEVIATED: covered by `configureNest` at preload.js:29*

### Phase 5: Wizard UI
- [ ] Create `firmware/installer/src/wizard/WizardContext.tsx`
  - [ ] `WizardState` interface with all wizard fields
  - [ ] `WizardAction` union with `CLEAR_PASSWORD` action
  - [ ] `useWizard()` hook for consuming wizard context
  - *Status: NOT DONE. App.jsx uses flat `useState` instead (App.jsx:41–45). Password is cleared inline at App.jsx:187. Functionally equivalent but lacks the formal reducer/context architecture. Low risk in practice.*
- [x] Add wizard screen constants to `App.jsx` SCREENS — *App.jsx:21–26: `HOSTING_MODE`, `SSH_CONFIG`, `HA_DISCOVERY`, `NEST_DISCOVERY`, `CONFIGURING`, `SETUP_COMPLETE`*
- [x] Wire `INSTALL` success path to `HOSTING_MODE` (not `SUCCESS`) — *App.jsx:124: `onSuccess={() => handleNext(SCREENS.HOSTING_MODE)}`*
- [x] Add `HostingModeStep.jsx` — *src/components/HostingModeStep.jsx: cloud/self-hosted selection + Skip button*
- [x] Add `SSHConfigStep.jsx` — *src/components/SSHConfigStep.jsx*
  - [x] Disable option (recommended) vs enable option — *SSHConfigStep.jsx:52–99*
  - [x] Password + confirm fields (show/hide toggle) — *SSHConfigStep.jsx:106–166*
  - [-] Password strength via `zxcvbn-ts` — *PARTIAL: uses custom `quickStrength()` (SSHConfigStep.jsx:5–14) instead of `zxcvbn-ts`. Gating logic at line 33 (`strength >= 2`) is correct. `zxcvbn-ts` was not imported.*
  - [x] Disable Next until passwords match (when enabling) — *SSHConfigStep.jsx:31–33*
- [x] Add `HADiscoveryStep.jsx` — *src/components/HADiscoveryStep.jsx*
  - [x] Auto-starts discovery on mount — *HADiscoveryStep.jsx:53–62 (useEffect)*
  - [x] Inline "Enter manually" escape hatch — *HADiscoveryStep.jsx: manual URL input in `addon_missing` and `not_found` states*
  - [x] Retry button when add-on not found but HA found — *HADiscoveryStep.jsx:140*
- [x] Add `NestDiscoveryStep.jsx` — *src/components/NestDiscoveryStep.jsx*
  - [x] 45s countdown before first scan — *handled in backend (nest-discovery.js:71–73); UI shows boot message from progress events*
  - [ ] Progress bar during scan — *NOT DONE: shows spinner + text message only. No visual progress bar was implemented.*
  - [x] Multi-device selection list — *NestDiscoveryStep.jsx:108–123*
  - [x] Manual IP entry inline — *NestDiscoveryStep.jsx:144–166*
- [x] Add `ConfiguringStep.jsx` — *src/components/ConfiguringStep.jsx*
  - [x] Step list with live check marks — *ConfiguringStep.jsx: `StepRow` component with done/active/pending/error/skipped states*
  - [x] Error state with specific failure message + retry — *ConfiguringStep.jsx:151–211*
- [x] Add `SetupCompleteStep.jsx` — *src/components/SetupCompleteStep.jsx*
  - [x] Serial number display with copy button — *SetupCompleteStep.jsx:73 (`CopyField` component)*
  - [x] cloudregisterurl display with copy button — *SetupCompleteStep.jsx:77*
  - [x] SSH status summary — *SetupCompleteStep.jsx:47–51, 81–85*
- [x] Fix `main.js` null-check: guard `webContents.send` — *main.js:91–95: `sendToWindow()` helper used throughout, guards with `!mainWindow.isDestroyed()`*
- [-] Add `zxcvbn-ts` to `package.json` dependencies — *PARTIAL: package.json:83 has `"zxcvbn": "^4.4.2"` (older package, not `zxcvbn-ts`). Neither package is actually imported in SSHConfigStep.jsx — quickStrength() used instead.*

### Cleanup: Remove Server, Certs, Build Scripts
- [x] Delete `server/` directory — *deleted*
- [x] Delete `certs/` directory — *deleted*
- [x] Delete `install.sh` — *deleted*
- [x] Audit and clean `firmware/builder/build.sh`: remove `--hosted` flag — *DONE: removed `--hosted` case + `HOSTED_MODE` var; cert block now unconditionally embeds NLE CA cert; removed `server/certs` success message*
- [x] Audit `firmware/builder/docker-build.sh`: remove server volume mount — *DONE: removed `-v .../server:/server` line*
- [x] Delete `firmware/builder/scripts/generate-certs.sh` — *deleted*
- [x] Update `README.md`: removed "Self-Hosted Install" option; replaced two-path install section with unified Electron installer flow description — *README.md:23–38*

---

## Fallback Strategy

### SSH Fallbacks (in order)
| # | Scenario | Action |
|---|----------|--------|
| 1 | SSH connects, serial obtained | Proceed normally |
| 2 | SSH times out (port 22 not open) | Warn user; if Phase 0 exists, try first-boot window; otherwise show error |
| 3 | Wrong password (user previously changed it) | Prompt user for current SSH password |
| 4 | SSH not compiled into firmware | Skip SSH steps; if Phase 0 exists, use first-boot window; otherwise manual serial entry |

### HA Discovery Fallbacks
| # | Method | Notes |
|---|--------|-------|
| 1 | `dns.lookup('homeassistant.local')` + `GET :9543/info` | Works macOS/Win10+/Linux+avahi; full URL from add-on |
| 2 | Common IP scan + `GET :9543/info` | Last resort auto (no multicast-dns dependency) |
| 3 | HA found but add-on 404 → pre-filled URL + Retry | User starts add-on then retries |
| 4 | Full manual URL entry | Always available, pre-filled with best guess |

### Nest Discovery Fallbacks
| # | Method | Notes |
|---|--------|-------|
| 1 | Subnet port 8080 scan (all 254 simultaneous, 800ms) | ~1–2s for /24 |
| 2 | Retry loop (3 min total, 10s intervals) | Device may still be booting |
| 3 | Manual IP entry | Always available inline |

### cloudregisterurl Update Fallbacks
| # | Method | Serial Source |
|---|--------|---------------|
| 1 | nleapi `initialize` with serial from `hostname` | SSH |
| 2 | nleapi first-boot window `{"setup":"true"}` (Phase 0 only) | Returned in API response |
| 3 | nleapi `initialize` with manually entered serial | User reads from thermostat label |

---

## Acceptance Criteria

### Hosted Flow
- [ ] User can select cloud hosted and wizard completes without HA discovery
- [ ] User can disable SSH — dropbear rcS entry removed, process killed, connection closes cleanly
- [ ] User can set a custom SSH password — `chpasswd` applies it via stdin, old password no longer works
- [ ] Password strength indicator shown; Next disabled until strength meets minimum (zxcvbn score ≥ 2)
- [ ] Setup complete screen shows serial and SSH status with copy button

### Self-Hosted Flow
- [ ] `homeassistant.local` resolves on macOS, Windows 10+, Linux with avahi
- [ ] `GET :9543/info` returns `cloudregisterurl` when NLE add-on is running — that URL is used directly
- [ ] When add-on returns 404, installer shows "add-on not running" message with Retry button and pre-filled manual URL
- [ ] Subnet scan finds a freshly-booted Nest within 2 minutes (after 45s initial boot delay)
- [ ] SSH connects with default credentials and returns correct serial
- [ ] `cloudregisterurl` is updated via nleapi BEFORE SSH is disabled/reconfigured
- [ ] Final GET to `/cgi-bin/api/settings` confirms the URL matches what was set
- [ ] Nest reconnects to HA server within 15 seconds of update

### Security
- [ ] Password never appears in a shell command string (always written to stdin)
- [ ] `CLEAR_PASSWORD` action fired immediately after SSH session completes
- [ ] Password not logged, not stored in wizard state after use, not sent in IPC result
- [ ] If Phase 0 retained: first-boot window lockfile prevents replay; window only active for 30 minutes; window only when default URL still set
- [ ] `open-external` IPC handler should validate URL protocol (existing issue, note only)

### Stability
- [ ] `webContents.send` guarded with null-check (pre-existing crash fixed)
- [ ] Push-event listeners return cleanup functions and are removed on component unmount
- [ ] AbortController cancels all in-flight discovery operations when user navigates Back

### Edge Cases
- [ ] Multiple Nest devices on network — selection list shown, user picks theirs
- [ ] HA on non-standard port — user can change port in manual input
- [ ] Nest hasn't connected to WiFi yet — polling loop retries for up to 3 minutes
- [ ] User selects "Configure later" — exits wizard without making any changes
- [ ] Discovery scan runs on Windows — no `/proc/net/arp` access needed (ARP filter removed)
- [ ] `NLE_DEBUG_SKIP_FLASH=true` — flash step mocked, all post-flash steps run for real

---

## Remove Server, Certs, and Self-Hosted Build Scripts

The server has moved to its own repo. The self-hosted setup flow (prompting users to run their own server, building Docker images, generating certs) is no longer part of this repo. The new model is:

- **Default firmware build** = hosted mode (points at `backdoor.nolongerevil.com`)
- **Self-hosted configuration** = handled entirely by the Electron installer post-flash wizard (SSH + nleapi)
- **The firmware builder** still builds firmware, but with no hosted/self-hosted selection — it always builds hosted firmware

### What to delete entirely
- [ ] `server/` — entire directory (server is now in a separate repo)
- [ ] `certs/` — cert generation was only needed for the self-hosted server; no longer relevant here
- [ ] `install.sh` — the entire top-level orchestration script. It exists solely to build and deploy the server + firmware together. With the server gone and the Electron installer handling post-flash setup, this script has no remaining purpose.

### Firmware builder cleanup (`firmware/builder/`)

The builder itself stays, but remove anything related to hosted/self-hosted mode selection, server URL prompting, and cert embedding for a custom server:

- [ ] `build.sh` — remove `--hosted` / `--selfhosted` flags and the branching logic around them. The builder always produces hosted firmware (default `cloudregisterurl` pointing at `backdoor.nolongerevil.com`). Remove any `--api-url` prompting or server cert embedding steps.
- [ ] `docker-build.sh` — audit for any server-related flags passed through to `build.sh`; remove them
- [ ] `scripts/generate-certs.sh` — remove entirely (certs were for the self-hosted server)
- [ ] Any other scripts under `firmware/builder/scripts/` that exist solely to support server cert generation or self-hosted URL injection at build time

**What the builder keeps**: everything needed to produce a working hosted firmware binary — kernel build, initramfs assembly, nleapi staging, bootloader binaries.

---

## Debug / Development Mode

### Skip-Flash Flag

A `.env` variable that bypasses the physical USB flashing step so the post-flash wizard can be developed and tested without hardware attached.

**`.env` / `.env.development`** (in `firmware/installer/`):
```env
# Skip USB firmware flashing — jumps straight to the post-flash wizard
# with a mock success. Everything after (SSH, HA discovery, nleapi) runs for real.
NLE_DEBUG_SKIP_FLASH=true
```

**Main process** (`main.js`) — load with `dotenv` at startup and check in the IPC handler:
```javascript
// At top of main.js (dev only — dotenv is a devDependency)
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

ipcMain.handle('install-firmware', async (event, options) => {
  if (process.env.NLE_DEBUG_SKIP_FLASH === 'true') {
    const steps = [
      { message: 'Detecting device...', percent: 0 },
      { message: 'Sending bootloader...', percent: 33 },
      { message: 'Flashing firmware...', percent: 66 },
      { message: 'Complete', percent: 100 },
    ];
    for (const step of steps) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('installation-progress', step);
      }
      await new Promise(r => setTimeout(r, 600));
    }
    return { success: true, debug: true };
  }
  // ... real flash logic
});
```

**Renderer** — Vite also loads `.env` so a `VITE_` prefixed copy can show a debug banner:
```env
VITE_DEBUG_SKIP_FLASH=true
```
```tsx
{import.meta.env.VITE_DEBUG_SKIP_FLASH === 'true' && (
  <div className="text-xs text-yellow-400 text-center">⚠ Debug: flash step mocked</div>
)}
```

**What is mocked**: Only the `install-firmware` IPC call — the progress events and success response are faked.

**What is NOT mocked**: HA discovery, Nest discovery, SSH, nleapi configuration — all run for real against actual hardware.

**`.gitignore`**: Add to `firmware/installer/.gitignore`:
```
.env
.env.development
.env.local
```

---

## Dependencies

### New npm packages (`firmware/installer/package.json`)
- `ssh2` — SSH client (has native C++ addon `cpu-features`)
- `zxcvbn-ts` — password strength estimation (pure JS)
- `dotenv` (devDependency) — load `.env` in Electron main process during development

> **Not adding**: `multicast-dns` — `dns.lookup('homeassistant.local')` covers all production targets.

### `asarUnpack` additions for `ssh2`

The `cpu-features` native addon bundled with `ssh2` must be unpacked from the asar archive:

```json
"asarUnpack": [
  "node_modules/usb/**/*",
  "resources/firmware/**/*",
  "**/node_modules/cpu-features/**",
  "**/node_modules/ssh2/lib/protocol/crypto/build/**"
]
```

> If `ssh2` native build causes problems (especially on Windows CI), evaluate `@electerm/ssh2` as a drop-in replacement with fewer native-build issues.

### Build targets

The `package.json` build config currently only targets `--mac` and `--linux`. There is **no Windows build target** defined. If Windows support is added, it will need:
- `electron-builder` target `nsis` or `portable`
- Windows code signing config
- `install-windows-driver` IPC (already exists in `main.js`) wired into the installer flow

This is out of scope for this plan but worth noting for future.

### Firmware changes
- `firmware/builder/deps/settings` — shell injection fix (line 121, required); Phase 0 first-boot window (optional)

### Files to create
- `firmware/installer/electron/net-utils.js`
- `firmware/installer/electron/ipc-result.js`
- `firmware/installer/electron/ha-discovery.js`
- `firmware/installer/electron/nest-discovery.js`
- `firmware/installer/electron/ssh-handler.js`
- `firmware/installer/electron/nest-configure.js`
- `firmware/installer/src/wizard/WizardContext.tsx`
- `firmware/installer/src/components/HostingModeStep.tsx`
- `firmware/installer/src/components/SSHConfigStep.tsx`
- `firmware/installer/src/components/HADiscoveryStep.tsx`
- `firmware/installer/src/components/NestDiscoveryStep.tsx`
- `firmware/installer/src/components/ConfiguringStep.tsx`
- `firmware/installer/src/components/SetupCompleteStep.tsx`

### Files to modify
- `firmware/installer/electron/main.js` — 5 new IPC handlers + null-check fix
- `firmware/installer/electron/preload.js` — matching entries for all 5 new channels + listener cleanup pattern
- `firmware/installer/package.json` — add `ssh2`, `zxcvbn-ts`; add asarUnpack entries; add `dotenv` devDependency
- `firmware/installer/src/App.jsx` — wire wizard steps, add SCREENS constants, splice between INSTALL and SETUP_COMPLETE
- `firmware/builder/deps/settings` — shell injection fix (line 121); Phase 0 patch (optional)

### Files to delete
- `server/` (entire directory)
- `certs/` (entire directory)
- `install.sh`
- `firmware/builder/scripts/generate-certs.sh`

---

## Known Bugs in Existing Firmware (Do Not Ship As-Is)

- ~~**`firmware/builder/deps/settings:121`** — shell injection via unquoted `$NEW_URL` in `sed -i`.~~ **FIXED** — `ESCAPED_URL` intermediate + double-quoted `sed -i` pattern at `firmware/builder/deps/settings:121–122`.
- **`firmware/builder/deps/nleapi` (`httpd.monitrc`)** — monit watches `/usr/sbin/httpd` but the binary lives at `/bin/httpd` (busybox2 symlink). Monit will never successfully restart httpd. Fix: update the monitrc path to `/bin/httpd`.

---

## References

### Internal
- On-device settings CGI: `firmware/builder/deps/settings:132` (GET/POST handler)
- **Shell injection bug**: `firmware/builder/deps/settings:121` (unquoted `$NEW_URL`)
- nleapi init script (httpd on port 8080): `firmware/builder/deps/nleapi`
- **httpd.monitrc bug**: `firmware/builder/deps/nleapi` (monit path mismatch)
- SSH/dropbear setup in rootme: `firmware/builder/build.sh:541-578`
- Dropbear rcS entry pattern: `firmware/builder/build.sh:584` (rcS cleanup idiom)
- Installer IPC hub: `firmware/installer/electron/main.js:63`
- preload.js contextBridge: `firmware/installer/electron/preload.js`
- App screen machine: `firmware/installer/src/App.jsx` (SCREENS const + handleNext)
- SuccessScreen (zero props): `firmware/installer/src/components/` (do not extend)

### Related PRs
- PR #116 — nleapi on-device API (Dec 2025, commit `e796765`)
- PR #131 — Server-side DeviceInitialization (Dec 2025, commit `30cbce3`)
- PR #164 — Fix Nest card for heat/cool mode (Feb 2026, current HEAD)
