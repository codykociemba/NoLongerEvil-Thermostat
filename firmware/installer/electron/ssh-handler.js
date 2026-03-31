/**
 * SSH operations for Nest post-flash configuration.
 * Requires: npm install ssh2
 *
 * SECURITY: Never interpolate passwords into shell command strings.
 * changePassword() writes to chpasswd stdin to avoid shell injection.
 */

let Client;
try {
  ({ Client } = require('ssh2'));
} catch {
  // ssh2 not installed yet — will throw at runtime with a clear message
}

function requireSSH2() {
  if (!Client) {
    throw new Error(
      'ssh2 package is not installed. Run: npm install ssh2 (in firmware/installer/)'
    );
  }
  return Client;
}

async function connectSSH(ip) {
  const SSHClient = requireSSH2();
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    let settled = false;
    const done = (fn, val) => {
      if (settled) return;
      settled = true;
      fn(val);
    };
    conn.connect({
      host: ip,
      port: 22,
      username: 'root',
      password: 'nolongerevil',
      readyTimeout: 20000,
      keepaliveInterval: 5000,
    });
    conn.on('ready', () => done(resolve, conn));
    conn.on('error', (err) => done(reject, err));
    conn.on('timeout', () => done(reject, new Error('SSH connection timed out')));
    conn.on('close', () => done(reject, new Error('SSH connection closed before handshake')));
  });
}

async function runCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let stderr = '';
      stream.on('data', d => (out += d));
      stream.stderr.on('data', d => (stderr += d));
      stream.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Command failed (exit ${code}): ${(stderr || out).trim()}`));
        } else {
          resolve(out.trim());
        }
      });
    });
  });
}

/**
 * Change root password using openssl passwd to generate hash + sed to update /etc/shadow.
 * Password is passed via stdin to openssl — no shell injection possible.
 * The MD5crypt hash only contains [./0-9A-Za-z$] so it's safe to embed in a
 * single-quoted sed pattern ($ is not shell-expanded inside single quotes).
 */
async function changePassword(conn, newPassword) {
  // Step 1: generate MD5crypt hash via openssl, password via stdin
  const hash = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('openssl passwd timed out after 8s')), 8000);
    const done = (fn, val) => { clearTimeout(timer); fn(val); };

    // No algorithm flag = DES crypt — matches what BusyBox `passwd` produces on this device
    conn.exec('openssl passwd -stdin', (err, stream) => {
      if (err) return done(reject, err);
      let out = '';
      let stderr = '';
      stream.on('data', d => (out += d));
      stream.stderr.on('data', d => (stderr += d));
      stream.on('close', (code) => {
        if (code !== 0) done(reject, new Error(`openssl passwd failed (exit ${code}): ${stderr.trim()}`));
        else done(resolve, out.trim());
      });
      // Write password and close stdin atomically
      stream.end(newPassword);
    });
  });

  // Step 2: replace root's hash in /etc/shadow
  // Single-quoted sed pattern — $ in hash is literal, not shell-expanded
  // | is the delimiter; MD5crypt hashes never contain |
  await runCommand(conn, `sed -i 's|^root:[^:]*:|root:${hash}:|' /etc/shadow`);
}

/**
 * Remove dropbear from rcS startup and kill the running process.
 * Dropbear has no PID file — use killall.
 * The rcS entry is: /bin/dropbear
 */
async function disableSSH(conn) {
  // Remove startup entry
  await runCommand(conn, "sed -i '/\\/bin\\/dropbear/d' /etc/init.d/rcS");
  // Kill running process — suppress non-zero exit if already stopped
  await new Promise((resolve) => {
    conn.exec('killall dropbear', (err, stream) => {
      if (err) { resolve(); return; }
      stream.on('close', () => resolve());
      stream.on('data', () => {});
      stream.stderr.on('data', () => {});
    });
  });
}

module.exports = { connectSSH, runCommand, changePassword, disableSSH };
