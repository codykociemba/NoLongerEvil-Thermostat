/**
 * /nest/passphrase Route Handler
 * Entry key generation for device pairing
 */

import { IncomingMessage, ServerResponse } from 'http';
import { environment } from '../../config/environment';
import { AbstractDeviceStateManager } from '@/services/AbstractDeviceStateManager';

/**
 * Handle GET /nest/passphrase
 * Generate entry key for device pairing
 */
export async function handlePassphrase(
  _req: IncomingMessage,
  res: ServerResponse,
  serial: string,
  deviceStateManager: AbstractDeviceStateManager
): Promise<void> {
  const ttl = environment.ENTRY_KEY_TTL_SECONDS;

  const key = await deviceStateManager.generateEntryKey(serial, ttl);

  if (!key) {
    console.error(`[Passphrase] Failed to generate entry key for ${serial} - Convex unavailable`);
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Entry key service unavailable' }));
    return;
  }

  console.log(`[Passphrase] Generated entry key for ${serial}: ${key.code})`);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      value: key.code,
      expires: key.expiresAt,
    })
  );
}
