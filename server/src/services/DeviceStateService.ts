/**
 * DeviceStateService
 *
 * Replaces global.nestDeviceState with a proper service that treats Convex as source of truth.
 * In-memory cache is used only for:
 * - Low-latency reads
 * - Quick merge operations
 * - Subscription notifications
 */

import type { DeviceObject, DeviceStateStore, DeviceOwner } from '../lib/types';
import { ConvexService } from './ConvexService';
import type { IntegrationManager } from '../integrations/IntegrationManager';

export class DeviceStateService {
  private cache: DeviceStateStore = {};
  private convex: ConvexService;
  private integrationManager: IntegrationManager | null = null;

  constructor(convex: ConvexService) {
    this.convex = convex;
  }

  /**
   * Set integration manager for broadcasting state changes
   */
  setIntegrationManager(integrationManager: IntegrationManager): void {
    this.integrationManager = integrationManager;
  }

  /**
   * Get a single object for a device
   * - Checks memory cache first
   * - Falls back to Convex if not in cache
   * - Updates cache on Convex hit
   */
  async get(serial: string, objectKey: string): Promise<DeviceObject | null> {
    if (this.cache[serial]?.[objectKey]) {
      return this.cache[serial][objectKey];
    }

    const convexObject = await this.convex.getState(serial, objectKey);
    if (convexObject) {
      this.cacheObject(serial, convexObject);
      return convexObject;
    }

    return null;
  }

  /**
   * Get all objects for a device
   * Returns cached objects if available, otherwise loads from Convex
   */
  async getAllForDevice(serial: string): Promise<Record<string, DeviceObject>> {
    if (this.cache[serial] && Object.keys(this.cache[serial]).length > 0) {
      return this.cache[serial];
    }

    const allState = await this.convex.getAllState();

    this.cache = { ...this.cache, ...allState };

    return this.cache[serial] || {};
  }

  /**
   * Upsert an object (from device or control command)
   * - Updates memory cache immediately
   * - Persists to Convex asynchronously
   * - Notifies integrations of state change
   * - Returns the updated object
   */
  async upsert(
    serial: string,
    objectKey: string,
    revision: number,
    timestamp: number,
    value: Record<string, any>
  ): Promise<DeviceObject> {
    const deviceObject: DeviceObject = {
      object_key: objectKey,
      object_revision: revision,
      object_timestamp: timestamp,
      value,
    };

    this.cacheObject(serial, deviceObject);

    this.convex.upsertState(serial, objectKey, revision, timestamp, value).catch(error => {
      console.error(`[DeviceStateService] Failed to persist ${serial}/${objectKey} to Convex:`, error);
    });

    if (this.integrationManager) {
      this.integrationManager.notifyStateChange(serial, objectKey, revision, timestamp, value).catch(error => {
        console.error(`[DeviceStateService] Failed to notify integrations for ${serial}/${objectKey}:`, error);
      });
    }

    return deviceObject;
  }

  /**
   * Batch upsert multiple objects
   * Used when handling device PUT with multiple objects
   */
  async upsertBatch(
    serial: string,
    objects: Array<{ objectKey: string; revision: number; timestamp: number; value: Record<string, any> }>
  ): Promise<DeviceObject[]> {
    const results: DeviceObject[] = [];

    for (const obj of objects) {
      const result = await this.upsert(serial, obj.objectKey, obj.revision, obj.timestamp, obj.value);
      results.push(result);
    }

    return results;
  }

  /**
   * Get all objects matching a partial key
   * Used for finding shared.*, device.*, etc.
   */
  getObjectsByPrefix(serial: string, prefix: string): DeviceObject[] {
    const deviceObjects = this.cache[serial];
    if (!deviceObjects) {
      return [];
    }

    return Object.values(deviceObjects).filter(obj => obj.object_key.startsWith(prefix));
  }

  /**
   * Check if device has any cached state
   */
  hasDevice(serial: string): boolean {
    return !!this.cache[serial] && Object.keys(this.cache[serial]).length > 0;
  }

  /**
   * Hydrate cache from Convex for a specific device
   * Used when device first connects
   */
  async hydrateFromConvex(serial: string): Promise<void> {
    const allState = await this.convex.getAllState();

    if (allState[serial]) {
      for (const [key, obj] of Object.entries(allState[serial])) {
        if (!obj.object_key) {
          console.log(`[DeviceStateService] WARNING: Object at key ${key} missing object_key field, adding it`);
          obj.object_key = key;
        }
      }

      this.cache[serial] = allState[serial];
      console.log(`[DeviceStateService] Hydrated ${Object.keys(allState[serial]).length} objects for ${serial}`);
    }
  }

  /**
   * Invalidate cache for a device
   * Forces next read to come from Convex
   */
  invalidate(serial: string): void {
    delete this.cache[serial];
  }

  /**
   * Invalidate a specific object
   */
  invalidateObject(serial: string, objectKey: string): void {
    if (this.cache[serial]) {
      delete this.cache[serial][objectKey];
    }
  }

  /**
   * Get all cached serials
   */
  getAllSerials(): string[] {
    return Object.keys(this.cache);
  }

  /**
   * Get entire device state (for debugging/status endpoints)
   * Returns a deep copy to prevent external mutation
   */
  getAllState(): DeviceStateStore {
    return JSON.parse(JSON.stringify(this.cache));
  }

  async getDeviceOwner(serial: string): Promise<DeviceOwner | null> {
    return this.convex.getDeviceOwner(serial);
  }

  private cacheObject(serial: string, obj: DeviceObject): void {
    if (!this.cache[serial]) {
      this.cache[serial] = {};
    }
    this.cache[serial][obj.object_key] = obj;
  }

  /**
   * Merge incoming value with existing value
   * Implements shallow merge strategy from original code
   */
  mergeValues(existing: Record<string, any>, incoming: Record<string, any>): Record<string, any> {
    return { ...existing, ...incoming };
  }

  /**
   * Compare objects for equality
   * Returns true if values are deeply equal (used to decide if revision should increment)
   */
  areValuesEqual(a: Record<string, any>, b: Record<string, any>): boolean {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (error) {
      // Fallback to false on serialization errors
      return false;
    }
  }

  /**
   * Determine if server state is newer than client state
   * Uses revision-first, timestamp-fallback comparison
   */
  isServerNewer(
    serverObj: DeviceObject,
    clientRevision: number,
    clientTimestamp: number
  ): boolean {
    if (serverObj.object_revision > clientRevision) {
      return true;
    }
    if (serverObj.object_revision === clientRevision && serverObj.object_timestamp > clientTimestamp) {
      return true;
    }
    return false;
  }
}
