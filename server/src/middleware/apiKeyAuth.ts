/**
 * API Key Authentication Middleware
 *
 * Validates API keys for Control API access
 */

import { IncomingMessage, ServerResponse } from 'http';
import { AbstractDeviceStateManager } from '../services/AbstractDeviceStateManager';

export interface ApiKeyContext {
  userId: string;
  permissions: {
    serials: string[];
    scopes: string[];
  };
  keyId: string;
}

/**
 * Extract API key from Authorization header
 */
function extractApiKey(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }

  if (parts.length === 1 && parts[0].startsWith('nlapi_')) {
    return parts[0];
  }

  return null;
}

/**
 * Validate API key and attach user context to request
 * Returns null if authentication fails, context if successful
 */
export async function validateApiKey(
  req: IncomingMessage,
  deviceStateManager: AbstractDeviceStateManager
): Promise<ApiKeyContext | null> {
  const key = extractApiKey(req);

  if (!key) {
    return null;
  }

  // Validate key via Convex
  const context = await deviceStateManager.validateApiKey(key);

  if (!context) {
    return null;
  }

  return context as ApiKeyContext;
}

/**
 * Middleware wrapper that sends 401 if authentication fails
 */
export async function requireApiKey(
  req: IncomingMessage,
  res: ServerResponse,
  deviceStateManager: AbstractDeviceStateManager
): Promise<ApiKeyContext | null> {
  const context = await validateApiKey(req, deviceStateManager);

  if (!context) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or missing API key' }));
    return null;
  }

  return context;
}

/**
 * Check if API key has permission to access a specific device
 */
export async function checkDevicePermission(
  context: ApiKeyContext,
  serial: string,
  requiredScopes: string[],
  deviceStateManager: AbstractDeviceStateManager
): Promise<boolean> {
  // Check permission via Convex (validates ownership + shares)
  const hasPermission = await deviceStateManager.checkApiKeyPermission(
    context.userId,
    serial,
    requiredScopes,
    context.permissions
  );

  return hasPermission;
}
