/**
 * Environment Configuration
 * Validates and exports all environment variables with sensible defaults
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import type { EnvironmentConfig } from '../lib/types';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

/**
 * Parse integer from environment variable with fallback
 */
function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get environment variable with fallback
 */
function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Get nullable environment variable
 */
function getEnvNullable(key: string): string | null {
  return process.env[key] || null;
}

/**
 * Get boolean environment variable with fallback
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Validated environment configuration
 */
export const environment: EnvironmentConfig = {
  CONVEX_URL: getEnvNullable('CONVEX_URL') || getEnvNullable('NEXT_PUBLIC_CONVEX_URL'),
  CONVEX_ADMIN_KEY: getEnvNullable('CONVEX_ADMIN_KEY') || getEnvNullable('CONVEX_SELF_HOSTED_ADMIN_KEY'),

  SQLITE3_ENABLED: getEnvBoolean('SQLITE3_ENABLED', false),
  SQLITE3_DB_PATH: getEnvString('SQLITE3_DB_PATH', './data/database.sqlite'),
  

  API_ORIGIN: getEnvString('API_ORIGIN', 'https://backdoor.nolongerevil.com'),
  PROXY_PORT: getEnvInt('PROXY_PORT', 443),
  CONTROL_PORT: getEnvInt('CONTROL_PORT', 8081),

  CERT_DIR: getEnvNullable('CERT_DIR'),

  ENTRY_KEY_TTL_SECONDS: getEnvInt('ENTRY_KEY_TTL_SECONDS', 3600),
  WEATHER_CACHE_TTL_MS: getEnvInt('WEATHER_CACHE_TTL_MS', 10 * 60 * 1000), // 10 minutes

  SUBSCRIPTION_TIMEOUT_MS: getEnvInt('SUBSCRIPTION_TIMEOUT_MS', 5 * 60 * 1000), // 5 minutes
  MAX_SUBSCRIPTIONS_PER_DEVICE: getEnvInt('MAX_SUBSCRIPTIONS_PER_DEVICE', 100),

  DEBUG_LOGGING: getEnvBoolean('DEBUG_LOGGING', false),
};

/**
 * Validate critical configuration on startup
 */
export function validateEnvironment(): void {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!environment.SQLITE3_ENABLED){
    if (!environment.CONVEX_URL) {
      warnings.push('CONVEX_URL not configured - state will not persist');
    }

    if (!environment.CONVEX_ADMIN_KEY) {
      warnings.push('CONVEX_ADMIN_KEY not configured - some operations may fail');
    }
  } else {
    console.log('[Config] SQLite3 storage enabled');
    if (!environment.SQLITE3_DB_PATH) {
      errors.push('SQLITE3_DB_PATH must be set when SQLITE3_ENABLED is true');
    }
  }
  if (environment.PROXY_PORT < 1 || environment.PROXY_PORT > 65535) {
    errors.push(`Invalid PROXY_PORT: ${environment.PROXY_PORT} (must be 1-65535)`);
  }

  if (environment.CONTROL_PORT < 1 || environment.CONTROL_PORT > 65535) {
    errors.push(`Invalid CONTROL_PORT: ${environment.CONTROL_PORT} (must be 1-65535)`);
  }

  warnings.forEach(warning => {
    console.warn(`[Config Warning] ${warning}`);
  });

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }

  console.log('[Config] Environment validated successfully');
  console.log(`[Config] API Origin: ${environment.API_ORIGIN}`);
  console.log(`[Config] Proxy Port: ${environment.PROXY_PORT}`);
  console.log(`[Config] Control Port: ${environment.CONTROL_PORT}`);
  console.log(`[Config] State manager: ${environment.SQLITE3_ENABLED ? 'SQLite3' : 'Convex'}`);
  if (environment.SQLITE3_ENABLED) {
    console.log(`[Config] SQLite3 DB Path: ${environment.SQLITE3_DB_PATH}`);
  } else {
    console.log(`[Config] Convex URL: ${environment.CONVEX_URL ? 'Configured' : 'Not configured'}`);
  }
  console.log(`[Config] TLS Certificates: ${environment.CERT_DIR || 'Not configured (HTTP only)'}`);
  console.log(`[Config] Debug Logging: ${environment.DEBUG_LOGGING ? 'Enabled' : 'Disabled'}`);
}
