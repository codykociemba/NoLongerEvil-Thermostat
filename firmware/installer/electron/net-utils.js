const os = require('os');
const net = require('net');

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
  return '192.168.1';
}

/**
 * Probe a single host:port with a timeout.
 * Uses socket.destroy() (not end()) to avoid waiting for FIN on refused/timed-out connections.
 * @returns {Promise<string|null>} ip on success, null on failure/timeout
 */
function probePort(ip, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(null);
    }, timeoutMs);
    socket.connect(port, ip, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(ip);
    });
    socket.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

module.exports = { getLocalSubnet, probePort };
