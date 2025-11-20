/**
 * AbstractDeviceStateManager
 * Abstract base class for managing device states in different store solutions.
 * Currently, Convex is used as the primary store.
 * Provides type-safe methods and error handling for store interactions
 */

import type {
  DeviceObject,
  DeviceOwner,
  StateEntryKey,
  StateWeatherCache,
  WeatherData,
  DeviceStateStore,
} from '../lib/types';

export abstract class AbstractDeviceStateManager {

  /**
   * Upsert a device state object
   * @param serial Device serial number
   * @param objectKey Object key
   * @param revision Object revision number
   * @param timestamp Object timestamp
   * @param value Object value
   */
  abstract upsertState(
    serial: string,
    objectKey: string,
    revision: number,
    timestamp: number,
    value: Record<string, any>
  ): Promise<void>;

  /**
   * Get single device state object
   * @param serial 
   * @param objectKey 
   */
  abstract getState(serial: string, objectKey: string): Promise<DeviceObject | null>;

  /**
   * Get all state for a device
   */
  abstract getAllState(): Promise<DeviceStateStore>;

  /**
   * Generate entry key for device pairing
   */
  abstract generateEntryKey(serial: string, ttlSeconds: number): Promise<StateEntryKey | null>;

  /**
   * Get device owner
   */
  abstract getDeviceOwner(serial: string): Promise<DeviceOwner | null>;

  /**
   * Update user away status based on device state
   */
  abstract updateUserAwayStatus(userId: string): Promise<void>;

  /**
   * Sync user weather from device postal code
   */
  abstract syncUserWeatherFromDevice(userId: string): Promise<void>;

  /**
   * Ensure device alert dialog exists
   */
  abstract ensureDeviceAlertDialog(serial: string): Promise<void>;

  /**
   * Get cached weather data
   */
  abstract getWeather(postalCode: string, country: string): Promise<StateWeatherCache | null>;

  /**
   * Upsert weather cache
   */
  abstract upsertWeather(
    postalCode: string,
    country: string,
    fetchedAt: number,
    data: WeatherData
  ): Promise<void>;

  /**
   * Update weather for all users with postal code
   */
  abstract updateWeatherForPostalCode(
    postalCode: string,
    country: string,
    weatherData: WeatherData
  ): Promise<void>;

  /**
   * Get user's weather data
   */
  abstract getUserWeather(userId: string): Promise<any | null>;

  /**
   * Get all enabled MQTT integrations for loading by IntegrationManager
   * Uses secure action to decrypt passwords
   */
  abstract getAllEnabledMqttIntegrations(): Promise<Array<{ userId: string; config: any }>>;

  /**
   * Validate API key for authentication
   */
  abstract validateApiKey(key: string): Promise<{ userId: string; permissions: any; keyId: string } | null>;

    /**
   * Check if API key has permission to access a device
   */
  abstract checkApiKeyPermission(
    userId: string,
    serial: string,
    requiredScopes: string[],
    permissions: { serials: string[]; scopes: string[] }
  ): Promise<boolean>;


  /**
   * List all devices owned by a user
   */
  abstract listUserDevices(userId: string): Promise<Array<{ serial: string }>>;

    /**
   * Get devices shared with a user
   */
  abstract getSharedWithMe(userId: string): Promise<Array<{ serial: string; permissions: string[] }>>;

}