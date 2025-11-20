/**
 * ConvexService
 * Centralized wrapper for all Convex database operations
 * Provides type-safe methods and error handling for Convex interactions
 */

import { ConvexHttpClient } from 'convex/browser';
import type {
  DeviceObject,
  DeviceOwner,
  StateEntryKey,
  StateWeatherCache,
  WeatherData,
  DeviceStateStore,
} from '../lib/types';
import { environment } from '../config/environment';
import { AbstractDeviceStateManager } from './AbstractDeviceStateManager';

export class ConvexService extends AbstractDeviceStateManager {
  private client: ConvexHttpClient | null = null;
  private initPromise: Promise<ConvexHttpClient | null> | null = null;

  /**
   * Initialize Convex client (lazy, cached)
   */
  private async getClient(): Promise<ConvexHttpClient | null> {
    if (this.client) {
      return this.client;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const CONVEX_URL = environment.CONVEX_URL;
        const CONVEX_ADMIN_KEY = environment.CONVEX_ADMIN_KEY;

        if (!CONVEX_URL) {
          console.warn('[Convex] No CONVEX_URL configured, database operations will fail');
          return null;
        }

        const client = new ConvexHttpClient(CONVEX_URL);

        if (CONVEX_ADMIN_KEY) {
          (client as any).setAdminAuth(CONVEX_ADMIN_KEY);
        }

        this.client = client;
        console.log('[Convex] Client initialized successfully');
        return client;
      } catch (error) {
        console.error('[Convex] Failed to initialize client:', error);
        return null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Upsert device state object
   */
  async upsertState(
    serial: string,
    objectKey: string,
    revision: number,
    timestamp: number,
    value: Record<string, any>
  ): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      console.warn('[Convex] Cannot upsert state: client not available');
      return;
    }

    try {
      await client.mutation('device:upsertState' as any, {
        serial,
        object_key: objectKey,
        object_revision: revision,
        object_timestamp: timestamp,
        value,
      });
    } catch (error) {
      console.error(`[Convex] Failed to upsert state for ${serial}/${objectKey}:`, error);
      throw error;
    }
  }

  /**
   * Get single device state object
   */
  async getState(serial: string, objectKey: string): Promise<DeviceObject | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    try {
      const result = await client.query('device:getState' as any, { serial, object_key: objectKey });
      return result || null;
    } catch (error) {
      console.error(`[Convex] Failed to get state for ${serial}/${objectKey}:`, error);
      return null;
    }
  }

  /**
   * Get all state for a device
   */
  async getAllState(): Promise<DeviceStateStore> {
    const client = await this.getClient();
    if (!client) {
      return {};
    }

    try {
      const result = await client.query('device:getAllState' as any);
      return result?.deviceState || {};
    } catch (error) {
      console.error('[Convex] Failed to get all state:', error);
      return {};
    }
  }

  /**
   * Generate entry key for device pairing
   */
  async generateEntryKey(serial: string, ttlSeconds: number): Promise<StateEntryKey | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    try {
      const result = await client.mutation('users:generateEntryKey' as any, {
        serial,
        ttlSeconds,
      });
      return result;
    } catch (error) {
      console.error(`[Convex] Failed to generate entry key for ${serial}:`, error);
      return null;
    }
  }

  /**
   * Get device owner
   */
  async getDeviceOwner(serial: string): Promise<DeviceOwner | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    try {
      const result = await client.query('users:getDeviceOwner' as any, { serial });
      return result;
    } catch (error) {
      console.error(`[Convex] Failed to get device owner for ${serial}:`, error);
      return null;
    }
  }

  /**
   * Update user away status based on device state
   */
  async updateUserAwayStatus(userId: string): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    try {
      await client.mutation('users:updateUserAwayStatus' as any, { userId });
    } catch (error) {
      console.error(`[Convex] Failed to update away status for user ${userId}:`, error);
    }
  }

  /**
   * Sync user weather from device postal code
   */
  async syncUserWeatherFromDevice(userId: string): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    try {
      await client.mutation('users:syncUserWeatherFromDevice' as any, { userId });
    } catch (error) {
      console.error(`[Convex] Failed to sync weather for user ${userId}:`, error);
    }
  }

  /**
   * Ensure device alert dialog exists
   */
  async ensureDeviceAlertDialog(serial: string): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    try {
      await client.mutation('users:ensureDeviceAlertDialog' as any, { serial });
    } catch (error) {
      console.error(`[Convex] Failed to ensure alert dialog for ${serial}:`, error);
    }
  }

  /**
   * Get cached weather data
   */
  async getWeather(postalCode: string, country: string): Promise<StateWeatherCache | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    try {
      const result = await client.query('weather:getWeather' as any, { postalCode, country });
      return result;
    } catch (error) {
      console.error(`[Convex] Failed to get weather for ${postalCode}, ${country}:`, error);
      return null;
    }
  }

  /**
   * Upsert weather cache
   */
  async upsertWeather(
    postalCode: string,
    country: string,
    fetchedAt: number,
    data: WeatherData
  ): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    try {
      await client.mutation('weather:upsertWeather' as any, {
        postalCode,
        country,
        fetchedAt,
        data,
      });
    } catch (error) {
      console.error(`[Convex] Failed to upsert weather for ${postalCode}, ${country}:`, error);
    }
  }

  /**
   * Update weather for all users with postal code
   */
  async updateWeatherForPostalCode(
    postalCode: string,
    country: string,
    weatherData: WeatherData
  ): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    try {
      await client.mutation('users:updateWeatherForPostalCode' as any, {
        postalCode,
        country,
        weatherData,
      });
    } catch (error) {
      console.error(
        `[Convex] Failed to update weather for postal code ${postalCode}, ${country}:`,
        error
      );
    }
  }

  /**
   * Get user's weather data
   */
  async getUserWeather(userId: string): Promise<any | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    try {
      const result = await client.query('users:getUserById' as any, { userId });
      return result?.weather || null;
    } catch (error) {
      console.error(`[Convex] Failed to get user weather for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get all enabled MQTT integrations for loading by IntegrationManager
   * Uses secure action to decrypt passwords
   */
  async getAllEnabledMqttIntegrations(): Promise<Array<{ userId: string; config: any }>> {
    const client = await this.getClient();
    if (!client) {
      return [];
    }

    try {
      const integrations = await client.action('integrations_actions:getAllEnabledMqttIntegrationsSecure' as any, {});
      return integrations || [];
    } catch (error) {
      console.error('[Convex] Failed to fetch enabled MQTT integrations:', error);
      return [];
    }
  }

  /**
   * Validate API key for authentication
   */
  async validateApiKey(key: string): Promise<{ userId: string; permissions: any; keyId: string } | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    try {
      const result = await client.mutation('apiKeys:validateApiKey' as any, { key });
      return result;
    } catch (error) {
      console.error('[Convex] Failed to validate API key:', error);
      return null;
    }
  }

  /**
   * Check if API key has permission to access a device
   */
  async checkApiKeyPermission(
    userId: string,
    serial: string,
    requiredScopes: string[],
    permissions: { serials: string[]; scopes: string[] }
  ): Promise<boolean> {
    const client = await this.getClient();
    if (!client) {
      return false;
    }

    try {
      const result = await client.query('apiKeys:checkApiKeyPermission' as any, {
        userId,
        serial,
        requiredScopes,
        permissions,
      });
      return result || false;
    } catch (error) {
      console.error('[Convex] Failed to check API key permission:', error);
      return false;
    }
  }

  /**
   * List all devices owned by a user
   */
  async listUserDevices(userId: string): Promise<Array<{ serial: string }>> {
    const client = await this.getClient();
    if (!client) {
      return [];
    }

    try {
      const devices = await client.query('users:listUserDevices' as any, { userId });
      return devices || [];
    } catch (error) {
      console.error('[Convex] Failed to list user devices:', error);
      return [];
    }
  }

  /**
   * Get devices shared with a user
   */
  async getSharedWithMe(userId: string): Promise<Array<{ serial: string; permissions: string[] }>> {
    const client = await this.getClient();
    if (!client) {
      return [];
    }

    try {
      const shares = await client.query('shares:getSharedWithMe' as any, { userId });
      return shares || [];
    } catch (error) {
      console.error('[Convex] Failed to get shared devices:', error);
      return [];
    }
  }
}
