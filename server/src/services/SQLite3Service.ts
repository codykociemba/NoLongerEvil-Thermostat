/**
 * SQLite3Service.ts
 * Centralized wrapper for all SQLite3 database operations
 * Provides type-safe methods and error handling for Convex interactions
 */
import { Database } from 'sqlite3';
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
import path from 'path';

export class SQLite3Service extends AbstractDeviceStateManager {
  private db: Database | null = null;
  private initPromise: Promise<Database | null> | null = null;

  private async createSchema(db: Database): Promise<void> {
    console.log('[SQLite3] Creating database schema...');
    
    const schemaStatements = [
      `CREATE TABLE IF NOT EXISTS device (
        serial TEXT NOT NULL,
        object_key TEXT NOT NULL,
        object_revision INTEGER NOT NULL,
        object_timestamp INTEGER NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (serial, object_key)
      );`,
    ];

    for (const stmt of schemaStatements) {
      await new Promise<void>((resolve, reject) => {

        console.log('[SQLite3] Running schema statement:', stmt);
        db.run(stmt, (err) => {
          if (err) {
            console.error('[SQLite3] Error creating schema:', err);
            reject(err);
          } else {
            console.log('[SQLite3] Created schema');
            resolve();
          }
        });
      });
    }

    console.log('[SQLite3] Database schema created or already exists.');
  }

  /**
   * Initialize SQLite3 database connection
   */
  private async getDb(): Promise<Database | null> {
    if (this.db) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const SQLITE3_DB_PATH = path.resolve(environment.SQLITE3_DB_PATH!);
        console.debug('[SQLite3] Initializing db at ', SQLITE3_DB_PATH);
        
        const db = await new Promise<Database>((resolve, reject) => {
          const db = new Database(SQLITE3_DB_PATH, (err) => {
            if (err) {
              reject(err);
            }
            resolve(db);
          });          
        });

        await this.createSchema(db);

        this.db = db;
        console.log('[SQLite3] Db initialized successfully');
        return db;
      } catch (error) {
        console.error('[SQLite3] Failed to initialize database:', error);
        process.exit(1);
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
    const db = await this.getDb();
    if (!db) {
      console.warn('[SQLite3] Cannot upsert state: client not available');
      return;
    }

    try {
      db.run(`INSERT INTO device (serial, object_key, object_revision, object_timestamp, value)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(serial, object_key) DO UPDATE SET
                object_revision = excluded.object_revision,
                object_timestamp = excluded.object_timestamp,
                value = excluded.value;`,
        [serial, objectKey, revision, timestamp, JSON.stringify(value)],
        (err) => {
          if (err) {
            throw err;
          }
        }
      );
    } catch (error) {
      console.error(`[SQLite3] Failed to upsert state for ${serial}/${objectKey}:`, error);
      throw error;
    }
  }

  /**
   * Get single device state object
   */
  async getState(serial: string, objectKey: string): Promise<DeviceObject | null> {
    const db = await this.getDb();
    if (!db) {
      return null;
    }

    console.warn('[SQLite3] getState is not implemented yet.');
    return null;
  }

  /**
   * Get all state for a device
   */
  async getAllState(): Promise<DeviceStateStore> {
    const db = await this.getDb();
    if (!db) {
      return {};
    }

    console.warn('[SQLite3] getAllState is not implemented yet.');
    return {};
  }

  /**
   * Generate entry key for device pairing
   */
  async generateEntryKey(serial: string, ttlSeconds: number): Promise<StateEntryKey | null> {
    const db = await this.getDb();
    if (!db) {
      return null;
    }

    console.warn('[SQLite3] generateEntryKey is not implemented yet.');
    return null;
  }

  /**
   * Get device owner
   */
  async getDeviceOwner(serial: string): Promise<DeviceOwner | null> {
    const db = await this.getDb();
    if (!db) {
      return null;
    }

    console.warn('[SQLite3] getDeviceOwner is not implemented yet.');
    return null;
  }

  /**
   * Update user away status based on device state
   */
  async updateUserAwayStatus(userId: string): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      return;
    }

    console.warn('[SQLite3] updateUserAwayStatus is not implemented yet.');
  }

  /**
   * Sync user weather from device postal code
   */
  async syncUserWeatherFromDevice(userId: string): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      return;
    }

    console.warn('[SQLite3] syncUserWeatherFromDevice is not implemented yet.');
  }

  /**
   * Ensure device alert dialog exists
   */
  async ensureDeviceAlertDialog(serial: string): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      return;
    }

    console.warn('[SQLite3] ensureDeviceAlertDialog is not implemented yet.');
  }

  /**
   * Get cached weather data
   */
  async getWeather(postalCode: string, country: string): Promise<StateWeatherCache | null> {
    const db = await this.getDb();
    if (!db) {
      return null;
    }

    console.warn('[SQLite3] getWeather is not implemented yet.');
    return null;
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
    const db = await this.getDb();
    if (!db) {
      return;
    }

    console.warn('[SQLite3] upsertWeather is not implemented yet.');
  }

  /**
   * Update weather for all users with postal code
   */
  async updateWeatherForPostalCode(
    postalCode: string,
    country: string,
    weatherData: WeatherData
  ): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      return;
    }
    
    console.warn('[SQLite3] updateWeatherForPostalCode is not implemented yet.');
  }

  /**
   * Get user's weather data
   */
  async getUserWeather(userId: string): Promise<any | null> {
    const db = await this.getDb();
    if (!db) {
      return null;
    }

    console.warn('[SQLite3] getUserWeather is not implemented yet.');
    return null;
  }

  /**
   * Get all enabled MQTT integrations for loading by IntegrationManager
   * Uses secure action to decrypt passwords
   */
  async getAllEnabledMqttIntegrations(): Promise<Array<{ userId: string; config: any }>> {
    const db = await this.getDb();
    if (!db) {
      return [];
    }

    console.warn('[SQLite3] getAllEnabledMqttIntegrations is not implemented yet.');
    return [];
  }

  /**
   * Validate API key for authentication
   */
  async validateApiKey(key: string): Promise<{ userId: string; permissions: any; keyId: string } | null> {
    const db = await this.getDb();
    if (!db) {
      return null;
    }

    console.warn('[SQLite3] validateApiKey is not implemented yet.');
    return null;
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
    const db = await this.getDb();
    if (!db) {
      return false;
    }

    console.warn('[SQLite3] checkApiKeyPermission is not implemented yet.');
    return false;
  }

  /**
   * List all devices owned by a user
   */
  async listUserDevices(userId: string): Promise<Array<{ serial: string }>> {
    const db = await this.getDb();
    if (!db) {
      return [];
    }

    console.warn('[SQLite3] listUserDevices is not implemented yet.');
    return [];
  }

  /**
   * Get devices shared with a user
   */
  async getSharedWithMe(userId: string): Promise<Array<{ serial: string; permissions: string[] }>> {
    const db = await this.getDb();
    if (!db) {
      return [];
    }

    console.warn('[SQLite3] getSharedWithMe is not implemented yet.');
    return [];
  }
}
