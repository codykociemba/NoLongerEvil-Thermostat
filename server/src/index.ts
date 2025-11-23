import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import { environment, validateEnvironment } from './config/environment';
import { initializeFileLogging } from './lib/logger';
import { DeviceStateService } from './services/DeviceStateService';
import { SubscriptionManager } from './services/SubscriptionManager';
import { WeatherService } from './services/WeatherService';
import { resolveDeviceSerial } from './lib/serialParser';
import { handleTransportGet, handleTransportSubscribe, handlePut } from './routes/nest/transport';
import { handleEntry } from './routes/nest/entry';
import { handlePassphrase } from './routes/nest/passphrase';
import { handleProInfo } from './routes/nest/proInfo';
import { handlePing } from './routes/nest/ping';
import { handleUpload } from './routes/nest/upload';
import { handleWeather } from './routes/nest/weather';
import { handleCommand } from './routes/control/command';
import { handleStatus, handleDevices, handleNotifyDevice } from './routes/control/status';
import { normalizeUrl } from './middleware/urlNormalizer';
import { logRequest, createResponseLogger } from './middleware/debugLogger';
import { IntegrationManager } from './integrations/IntegrationManager';
import { AbstractDeviceStateManager } from './services/AbstractDeviceStateManager';
import { SQLite3Service } from './services/SQLite3Service';
import { ConvexService } from './services/ConvexService';

validateEnvironment();

initializeFileLogging();


const deviceStateManager: AbstractDeviceStateManager = environment.SQLITE3_ENABLED ? new SQLite3Service() : new ConvexService();
const deviceStateService = new DeviceStateService(deviceStateManager);
const subscriptionManager = new SubscriptionManager();
const weatherService = new WeatherService(deviceStateManager);
const integrationManager = new IntegrationManager();

/**
 * Parse JSON request body
 */
function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: http.ServerResponse, statusCode: number, data: any): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
function sendError(res: http.ServerResponse, statusCode: number, message: string): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
}

/**
 * Main request handler for device API (PROXY_PORT)
 */
async function handleDeviceRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  normalizeUrl(req);

  const parsedUrl = url.parse(req.url || '', true);
  const pathname = parsedUrl.pathname || '/';
  const method = req.method || 'GET';

  console.log(`[Device API] ${method} ${pathname}`);

  if (environment.DEBUG_LOGGING) {
    createResponseLogger(req, res);
  }

  try {
    if (pathname === '/nest/entry') {
      if (environment.DEBUG_LOGGING) {
        logRequest(req);
      }
      handleEntry(req, res);
      return;
    }

    if (pathname === '/nest/ping') {
      handlePing(req, res);
      return;
    }

    if (pathname === '/nest/upload' && method === 'POST') {
      handleUpload(req, res);
      return;
    }

    if ((pathname.startsWith('/nest/pro_info') || pathname.startsWith('/nest/pro-info')) && method === 'GET') {
      handleProInfo(req, res);
      return;
    }

    if (pathname.startsWith('/nest/weather') && method === 'GET') {
      if (environment.DEBUG_LOGGING) {
        logRequest(req);
      }
      await handleWeather(req, res, weatherService);
      return;
    }

    const serial = resolveDeviceSerial(req);

    if (!serial) {
      sendError(res, 401, 'Unauthorized: Device serial required');
      return;
    }

    if (pathname === '/nest/passphrase' && method === 'GET') {
      if (environment.DEBUG_LOGGING) {
        logRequest(req);
      }
      await handlePassphrase(req, res, serial, deviceStateManager);
      return;
    }

    if (pathname.includes('/device/') && method === 'GET') {
      if (environment.DEBUG_LOGGING) {
        logRequest(req);
      }
      await handleTransportGet(req, res, serial, deviceStateService, deviceStateManager);
      return;
    }

    if ((pathname.includes('/subscribe') || pathname === '/nest/transport') && method === 'POST' && !pathname.includes('/put')) {
      const body = await parseJsonBody(req);
      if (environment.DEBUG_LOGGING) {
        logRequest(req, body);
      }
      await handleTransportSubscribe(req, res, serial, body, deviceStateService, subscriptionManager, deviceStateManager);
      return;
    }

    if (pathname.includes('/put') && method === 'POST') {
      const body = await parseJsonBody(req);
      if (environment.DEBUG_LOGGING) {
        logRequest(req, body);
      }
      await handlePut(req, res, serial, body, deviceStateService, subscriptionManager, deviceStateManager);
      return;
    }

    sendError(res, 404, 'Not Found');
  } catch (error) {
    console.error('[Device API] Error:', error);
    sendError(res, 500, error instanceof Error ? error.message : 'Internal Server Error');
  }
}

/**
 * Main request handler for control API (CONTROL_PORT)
 */
async function handleControlRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const parsedUrl = url.parse(req.url || '', true);
  const pathname = parsedUrl.pathname || '/';
  const method = req.method || 'GET';

  console.log(`[Control API] ${method} ${pathname}`);

  if (environment.DEBUG_LOGGING) {
    createResponseLogger(req, res);
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    if (pathname === '/command' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (environment.DEBUG_LOGGING) {
        logRequest(req, body);
      }
      const result = await handleCommand(body, deviceStateService, subscriptionManager);
      sendJson(res, 200, result);
      return;
    }

    if (pathname === '/status' && method === 'GET') {
      if (environment.DEBUG_LOGGING) {
        logRequest(req);
      }
      handleStatus(req, res, deviceStateService);
      return;
    }

    if (pathname === '/api/devices' && method === 'GET') {
      if (environment.DEBUG_LOGGING) {
        logRequest(req);
      }
      handleDevices(req, res, deviceStateService);
      return;
    }

    if (pathname === '/notify-device' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (environment.DEBUG_LOGGING) {
        logRequest(req, body);
      }
      const result = await handleNotifyDevice(body, deviceStateService, subscriptionManager);
      sendJson(res, 200, result);
      return;
    }

    sendError(res, 404, 'Not Found');
  } catch (error) {
    console.error('[Control API] Error:', error);
    sendError(res, 500, error instanceof Error ? error.message : 'Internal Server Error');
  }
}

/**
 * Create HTTPS server if certificates are available
 */
function createHttpsServer(): https.Server | null {
  if (!environment.CERT_DIR) {
    return null;
  }

  try {
    const certPath = path.join(environment.CERT_DIR, 'cert.pem');
    const keyPath = path.join(environment.CERT_DIR, 'key.pem');

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.warn(`[HTTPS] Certificates not found in ${environment.CERT_DIR}`);
      return null;
    }

    const options = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      rejectUnauthorized: false, // Required for Nest devices
    };

    const server = https.createServer(options, handleDeviceRequest);
    console.log('[HTTPS] Server created with TLS certificates');
    return server;
  } catch (error) {
    console.error('[HTTPS] Failed to create HTTPS server:', error);
    return null;
  }
}

/**
 * Start servers
 */
async function startServers(): Promise<void> {
  const httpsServer = createHttpsServer();
  if (httpsServer) {
    httpsServer.listen(environment.PROXY_PORT, () => {
      console.log(`[Device API] HTTPS server listening on port ${environment.PROXY_PORT}`);
    });
  } else {
    const httpServer = http.createServer(handleDeviceRequest);
    httpServer.listen(environment.PROXY_PORT, () => {
      console.log(`[Device API] HTTP server listening on port ${environment.PROXY_PORT}`);
    });
  }

  const controlServer = http.createServer(handleControlRequest);
  controlServer.listen(environment.CONTROL_PORT, () => {
    console.log(`[Control API] HTTP server listening on port ${environment.CONTROL_PORT}`);
  });

  console.log('[Integrations] Loading enabled integrations...');
  await integrationManager.initialize(deviceStateManager, deviceStateService, subscriptionManager);

  deviceStateService.setIntegrationManager(integrationManager);

  console.log(`[Integrations] ${integrationManager.getActiveCount()} integration(s) loaded`);
}

/**
 * Graceful shutdown
 */
function setupGracefulShutdown(): void {
  const shutdown = async () => {
    console.log('\n[Shutdown] Received shutdown signal');
    console.log('[Shutdown] Closing integrations...');
    await integrationManager.shutdown();
    console.log('[Shutdown] Closing subscriptions...');
    await subscriptionManager.shutdown();
    console.log('[Shutdown] Complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

console.log('='.repeat(60));
console.log('NoLongerEvil Thermostat API Server (TypeScript)');
console.log('='.repeat(60));

(async () => {
  await startServers();
  setupGracefulShutdown();

  console.log('\n[Server] Initialization complete');
  console.log('[Server] Press Ctrl+C to stop\n');
})();
