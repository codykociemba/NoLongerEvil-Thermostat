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
  EntryKey,
  UserInfo,
  UserState,
  DialogState,
  APIKey,
  APIKeyPermissions,
  DeviceSharedWith,
} from '../lib/types';
import { environment } from '../config/environment';
import { AbstractDeviceStateManager } from './AbstractDeviceStateManager';

export class SQLite3Service extends AbstractDeviceStateManager {
  private db: Database | null = null;
  private initPromise: Promise<Database | null> | null = null;

  private async createSchema(db: Database): Promise<void> {
    console.log('[SQLite3] Creating database schema...');
    
    const schemaStatements = [
      // states
      `CREATE TABLE IF NOT EXISTS states (
        serial TEXT,
        object_key TEXT,
        object_revision INTEGER,
        object_timestamp INTEGER,
        value TEXT,
        updatedAt INTEGER
      );`,
      // logs
      `CREATE TABLE IF NOT EXISTS logs (
        ts INTEGER,
        route TEXT,
        serial TEXT,
        req TEXT,
        res TEXT
      );`,
      // sessions
      `CREATE TABLE IF NOT EXISTS sessions (
        serial TEXT,
        session TEXT,
        endpoint TEXT,
        startedAt INTEGER,
        lastActivity INTEGER,
        open INTEGER NOT NULL DEFAULT 0,
        client TEXT,
        meta TEXT
      );`,
      // users
      `CREATE TABLE IF NOT EXISTS users (
        clerkId TEXT,
        email TEXT,
        createdAt INTEGER
      );`,
      // entryKeys
      `CREATE TABLE IF NOT EXISTS entryKeys (
        code TEXT,
        serial TEXT,
        createdAt INTEGER,
        expiresAt INTEGER,
        claimedBy INTEGER,
        claimedAt INTEGER
      );`,
      // deviceOwners
      `CREATE TABLE IF NOT EXISTS deviceOwners (
        userId TEXT,
        serial TEXT,
        createdAt INTEGER
      );`,
      // weather
      `CREATE TABLE IF NOT EXISTS weather (
        postalCode TEXT,
        country TEXT,
        fetchedAt INTEGER,
        data TEXT
      );`,
      // deviceShares
      `CREATE TABLE IF NOT EXISTS deviceShares (
        ownerId TEXT,
        sharedWithUserId TEXT,
        serial TEXT,
        permissions TEXT,
        createdAt INTEGER
      );`,
      // deviceShareInvites
      `CREATE TABLE IF NOT EXISTS seviceShareInvites (
        ownerId TEXT,
        email TEXT,
        serial TEXT,
        permissions TEXT,
        status TEXT,
        inviteToken TEXT,
        invitedAt INTEGER,
        acceptedAt INTEGER,
        expiresAt INTEGER,
        sharedWithUserId TEXT
      );`,
      // apiKeys
      `CREATE TABLE IF NOT EXISTS apiKeys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyHash TEXT,
        keyPreview TEXT,
        userId TEXT,
        name TEXT,
        permissions TEXT,
        createdAt INTEGER,
        expiresAt INTEGER,
        lastUsedAt INTEGER
      );`,
      // integrations
      `CREATE TABLE IF NOT EXISTS integrations (
        userId TEXT,
        type TEXT,
        enabled INTEGER NOT NULL DEFAULT 0,
        config TEXT,
        createdAt INTEGER,
        updatedAt INTEGER
      );`,
    ];

    for (const stmt of schemaStatements) {
      await new Promise<void>((resolve, reject) => {
        db.run(stmt, (err) => {
          if (err) {
            console.error(err.message);
            reject(err);
          } else {
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
        const SQLITE3_DB_PATH = environment.SQLITE3_DB_PATH!;
        console.debug('Initializing SQLite3 db at ', SQLITE3_DB_PATH);
        
        const db = await new Promise<Database>((resolve, reject) => {
          const db = new Database(SQLITE3_DB_PATH, (err) => {
            if (err) {
                reject(err);
            }
          });
          resolve(db);
        });

        await this.createSchema(db);

        this.db = db;
        console.log('[SQLite3] Db initialized successfully');
        return db;
      } catch (error) {
        console.error('[SQLite3] Failed to initialize database:', error);
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
    const db = await this.getDb();
    if (!db) {
      console.warn('[SQLite3] Cannot upsert state: client not available');
      return;
    }

    try {
      const currentState = await this.getState(serial, objectKey);
      if (currentState) {
        const mergedValue = await this.mergeValues(currentState.value ?? {}, value ?? {});
        db.run(`UPDATE states SET object_revision = ?, object_timestamp = ?, value = ?, updatedAt = ?
          WHERE serial = ? and object_key = ?`,
          [revision, timestamp, JSON.stringify(mergedValue), Date.now(), serial, objectKey] ,(err) => {
            if (err) {
              throw err;
            }
          });
      } else {
        db.run(`INSERT INTO states (serial, object_key, object_revision, 
          object_timestamp, value, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
          [serial, objectKey, revision, timestamp, JSON.stringify(value), Date.now()], (err) => {
          if (err) {
            throw err;
          }
        });
      }
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

    try {
      const sql = `SELECT object_key, object_revision, 
        object_timestamp, value as db_value FROM states 
        WHERE serial = ? AND object_key = ?`
      return new Promise((resolve, reject) => {
        db.get<DeviceObject>(sql, [serial, objectKey], (err, row) => {
          if (err) {
            reject(err);
          }
          if (row) {
            const parsedObject: any = JSON.parse(row.db_value);
            const ret: DeviceObject = {
              serial: row.serial,
              object_key: row.object_key,
              object_revision: row.object_revision,
              object_timestamp: row.object_timestamp,
              value: parsedObject as Record<string, any>,
              updatedAt: row.updatedAt
            }
            resolve(ret);
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error(`[SQLite3] Failed to get state for ${serial}/${objectKey}:`, error);
      return null;
    }
  }

  /**
   * Get all state
   */
  async getAllState(): Promise<DeviceStateStore> {
    const db = await this.getDb();
    if (!db) {
      return {};
    }

    try {
      const sql = `SELECT serial, object_key, object_revision,
        object_timestamp, value as db_value, updatedAt FROM states`;
      return new Promise<DeviceStateStore>((resolve, reject) => {
        db.all<DeviceObject>(sql, (err, rows) => {
          if (err) {
            reject(err);
          }
          const deviceState: Record<string, Record<string, any>> = {};
          if (rows) {
            const devices = new Set<string>();
            for (const row of rows) {
              const serial = row.serial;
              devices.add(serial);
              const bucket = (deviceState[serial] ||= {});
              const parsedObject: any = JSON.parse(row.db_value);
              bucket[row.object_key] = {
                object_key: row.object_key,
                object_revision: row.object_revision,
                object_timestamp: row.object_timestamp,
                value: parsedObject as Record<string, any>,
                updatedAt: row.updatedAt
              }
            }
          }
          resolve(deviceState);
        });
      });
    } catch (error) {
      console.error('[SQLite3] Failed to get all state: ', error);
      return {};
    }
  }

  /**
   * Get all state for a device
   */
  async getAllStateForDevice(serial: string, object_key: string): Promise<DeviceStateStore> {
    const db = await this.getDb();
    if (!db) { return {}; }

    try {
      const sql = `SELECT serial, object_key, object_revision,
        object_timestamp, value as db_value, updatedAt FROM states
        WHERE serial = ? and object_key = ?`;
      return new Promise<DeviceStateStore>((resolve, reject) => {
        db.all<DeviceObject>(sql, [serial, object_key], (err, rows) => {
          if (err) { reject(err); }
          const deviceState: Record<string, Record<string, any>> = {};
          if (rows) {
            const devices = new Set<string>();
            for (const row of rows) {
              const serial = row.serial;
              devices.add(serial);
              const bucket = (deviceState[serial] ||= {});
              const parsedObject: any = JSON.parse(row.db_value);
              bucket[row.object_key] = {
                object_key: row.object_key,
                object_revision: row.object_revision,
                object_timestamp: row.object_timestamp,
                value: parsedObject as Record<string, any>,
                updatedAt: row.updatedAt
              }
            }
          }
          resolve(deviceState);
        });
      });
    } catch (err) {
      console.error('[SQLite] Failed to get all state for a device: ', err);
      return {};
    }
  }

  /**
   * Generate entry key for device pairing
   */
  async generateEntryKey(serial: string, ttlSeconds: number): Promise<StateEntryKey | null> {
    const db = await this.getDb();
    if (!db) {
      return null;
    }

    try {
      const ttl = ttlSeconds ?? 3600;
      const nowMs = Date.now();
      const expiresAt = nowMs + (ttl * 1000); // Convert TTL seconds to milliseconds

      // Delete all existing entry keys for this serial (both expired and active)
      const sql = `DELETE FROM entryKeys WHERE serial = ?`;
      db.run(sql, [serial], (err) => {
        if (err) {
          console.error(err.message);
        }
      });

      let attempts = 0;
      let codeDoc: any = null;
      let code: string | undefined;

      while (attempts < 20) {
        attempts += 1;
        
        const digits = Math.floor(Math.random() * 1000)
            .toString().padStart(3, "0");
        const letters = Array.from({ length: 4 }, () => 
          String.fromCharCode(65 + Math.floor(Math.random() * 26))
        ).join("");
        code = `${digits}${letters}`;

        const sql2 = `SELECT code as value, expiresAt as expires, claimedBy
          FROM entryKeys where code = ?`
        const codeDoc = await new Promise<EntryKey | null>((resolve, reject) => {
          db.get<EntryKey>(sql2, [code], (err, row) => {
            if (err) {
              reject(err);
            }
            if (row) {
              const ret: EntryKey = {
                value: row.value,
                expires: row.expires,
                claimedBy: row.claimedBy
              }
              resolve(ret);
            } else {
              resolve(null);
            }
          });
        });

        if (!codeDoc) break;

        const expired = codeDoc.expires < nowMs;
        if (expired && !codeDoc.claimedBy) {
          break;
        }
        code = undefined;
      }

      if (!code) {
        throw new Error("Unable to allocate entry key.");
      }

      if (codeDoc) {
        db.run(`UPDATE entryKeys SET serial = ?, createdAt = ?,
          expiresAt = ?, claimedBy = null, claimedAt = null`, 
          [serial, nowMs, expiresAt]);
      } else {
        db.run(`INSERT INTO entryKeys (code, serial, createdAt, expiresAt)
          VALUES (?, ?, ?, ?)`,
        [code, serial, nowMs, expiresAt]);
      }

      const result: StateEntryKey = {
        code: code,
        expiresAt: expiresAt
      }
      return result;
    } catch (error) {
      console.error(`[SQLite3] Failed to generate entry key for ${serial}:`, error);
      return null;
    }
  }

  /**
   * Get device owner
   */
  async getDeviceOwner(serial: string): Promise<DeviceOwner | null> {
    const db = await this.getDb();
    if (!db) {
      return null;
    }

    try {
      const sql = `SELECT userId, serial, createdAt FROM deviceOwners WHERE serial = ?`;
      return new Promise((resolve, reject) => {
        db.get<DeviceOwner>(sql, [serial], (err, row) => {
          if (err) {
            reject(err);
          }
          if (row) {
            const ret: DeviceOwner = {
              userId: row.userId,
              serial: row.serial,
              createdAt: row.createdAt
            }
            resolve(ret);
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error(`[SQLite3] Failed to get device owner for ${serial}:`, error);
      return null;
    }
  }

  /**
   * Get all devices for owner
   */
  async getOwnerDevices(userId: string): Promise<DeviceOwner[] | null> {
    const db = await this.getDb();
    if (!db){ return null; }

    try {
      const sql = `SELECT userId, serial, createdAt FROM deviceOwners where userId = ?`;
      return new Promise<DeviceOwner[]>((resolve, reject) => {
        db.all<DeviceOwner>(sql, [userId], (err, rows) => {
          if (err) { reject(err); }
          if (rows) {
            let devices: DeviceOwner[] = [];
            for (const row of rows) {
              const device: DeviceOwner = {
                userId: row.userId,
                serial: row.serial,
                createdAt: row.createdAt
              }
              devices.push(device);
            }
            resolve(devices);
          }
        });
      });
    } catch (err) {
      console.error('[SQLite3] Failed to get all devices for owner: ', err);
      return null;
    }
  }

  /**
   * Update user away status based on device state
   */
  async updateUserAwayStatus(userId: string): Promise<any> {
    const db = await this.getDb();
    if (!db) {
      return;
    }

    try {
      const nowMs = Date.now();
      userId = userId.replace(/^user_/, "");
      const ownedDevices = await this.getOwnerDevices(userId);
      if (ownedDevices?.length === 0) {
        return { updated: false, error: "No devices found" };
      }

      // Check away status for each device and find the most recent away change
      let allAway = true;
      let anyDeviceReported = false;
      let mostRecentAwayTimestamp = 0;
      let mostRecentAwaySetter = null;
      let hasVacationMode = false;
      let mostRecentManualAwayTimestamp = 0;

      if (ownedDevices) {
        for (const deviceOwner of ownedDevices) {
          const deviceKey = `device.${deviceOwner.serial}`;
          const deviceState = await this.getAllStateForDevice(deviceOwner.serial, deviceKey);

          if (deviceState && deviceState.value) {
            anyDeviceReported = true;
            const away = Boolean(deviceState.value.away);
            const awayTimestamp = Number(deviceState.value.away_timestamp) || 0;
            const awaySetter = String(deviceState.value.away_setter);
            const vacationMode = Boolean(deviceState.value.vacation_mode) || false;
            const manualAwayTimestamp = Number(deviceState.value.manual_away_timestamp) || 0;

            // Track Vacation Mode
            if (vacationMode) {
              hasVacationMode = true;
            }

            // Track most recent timestamps
            if (awayTimestamp > mostRecentAwayTimestamp) {
              mostRecentAwayTimestamp = awayTimestamp;
            }
            if (manualAwayTimestamp > mostRecentManualAwayTimestamp) {
              mostRecentManualAwayTimestamp = manualAwayTimestamp;
              mostRecentAwaySetter = awaySetter;
            }

            // If any device reports away as false (0 or false), user is not away
            if (!away) {
              allAway = false;
              break;
            }
          }
        }

        // If no devices reported status, default to not away
        const userAway = anyDeviceReported ? allAway : false;

        // Update user state on each device with full away information
        let updatedCount = 0;
        for (const deviceOwner of ownedDevices) {
          const userStateKey = `user.${userId}`;
          const existingUserState = await this.getAllStateForDevice(deviceOwner.serial, userStateKey);

          if (existingUserState) {
            const currentValue = existingUserState.value || {};
            const updatedValue: any = {
              ...currentValue,
              away: userAway,
              vacation_mode: hasVacationMode,
            }

            // Only include timestamps if they have valid values
            if (mostRecentAwayTimestamp > 0) {
              updatedValue.away_timestamp = mostRecentAwayTimestamp;
            }
            if (mostRecentAwaySetter !== null) {
              updatedValue.away_setter = mostRecentAwaySetter;
            }
            if (mostRecentManualAwayTimestamp > 0) {
              updatedValue.manual_away_timestamp = mostRecentManualAwayTimestamp;
            }

            await this.upsertState(deviceOwner.serial, userStateKey, (Number(existingUserState.object_revision) || 0) + 1, nowMs, updatedValue);
            updatedCount++;
          }
        }
      }
      
    } catch (error) {
      console.error(`[SQLite3] Failed to update away status for user ${userId}:`, error);
    }
  }

  /**
   * Sync user weather from device postal code
   */
  async syncUserWeatherFromDevice(userId: string): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      return;
    }

    try {
      const nowMs = Date.now();
      userId = userId.replace(/^user_/, "");

      // Get all devices owned by this user
      const ownedDevices = await this.getOwnerDevices(userId);

      if (ownedDevices?.length === 0) {
        console.log("No devices found");
        return;
      }

      // Try to get postal_code from any device
      let postalCode = null;
      let country = "US";
      let deviceSerial = null;

      if (ownedDevices) {
        for (const deviceOwner of ownedDevices) {
          const deviceKey = `device.${deviceOwner.serial}`;
          const deviceState = await this.getState(deviceOwner.serial, deviceKey);

          if (deviceState && deviceState.value && deviceState.value.postal_code) {
            postalCode = deviceState.value.postal_code;
            deviceSerial = deviceOwner.serial;
            // Country might be in device state too, otherwise default to US
            country = deviceState.value.country || "US";
            break;
          }
        }

        if (!postalCode || !deviceSerial) {
          console.log("No postal code found in device state.");
          return;
        }

        // Fetch weather from weather table
        const weatherData = await this.getWeather(postalCode, country);
        if (!weatherData) {
          console.log("No weather data found for location.")
          return;
        }

        // Extract weather data
        const locationKey = `${postalCode},${country}`;
        const weatherInfo = weatherData.data[locationKey];
        if (!weatherInfo || !weatherInfo.current) {
          console.log("Invalid weather data format.");
          return;
        }

        // Update user state on all devices
        const weatherDataToSave = {
          current: weatherInfo.current,
          location: weatherInfo.location,
          updatedAt: nowMs
        };

        let updatedCount = 0;
        for (const deviceOwner of ownedDevices) {
          const userStateKey = `user.${userId}`;
          const existingUserState = await this.getState(deviceOwner.serial, userStateKey);
          if (existingUserState) {
            const currentValue = existingUserState.value || {};
            const updatedValue = {
              ...currentValue,
              weather: weatherDataToSave
            };

            await this.upsertState(deviceOwner.serial, userStateKey, 
              (existingUserState.object_revision || 0) + 1, nowMs, updatedValue);
            updatedCount++
          }
        }
      }
    } catch (error) {
      console.error(`[SQLite3] Failed to sync weather for user ${userId}:`, error);
    }
  }

  /**
   * Get user info
   */
  async getUserInfo(clerkId: string): Promise<UserInfo | null> {
    const db = await this.getDb();
    if (!db) { return null; }

    try {
      const sql = `SELECT clerkId, email, createdAt FROM users WHERE clerkId = ?`;
      return new Promise((resolve, reject) => {
        db.get<UserInfo>(sql, [clerkId], (err, row) => {
          if (err) { reject(err); }
          if (row) {
            const ret: UserInfo = {
              clerkId: row.clerkId,
              email: row.email,
              createdAt: row.createdAt
            }
            resolve(ret);
          }
          resolve(null);
        });
      });
    } catch (err) {
      console.error(`[SQLite3] Failed to get user information for ${clerkId}`, err);
      return null;
    }
  }

  /**
   * Ensure device alert dialog exists
   */
  async ensureDeviceAlertDialog(serial: string): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      return;
    }

    try {
      const nowMs = Date.now();
      let dialogCreated = false;
      let userCreated = false;
      const deviceOwner = await this.getDeviceOwner(serial);
      if (deviceOwner) {
        // Get user info
        const userInfo = await this.getUserInfo(deviceOwner.userId);
        const userEmail = userInfo?.email ?? "";
        const userId = deviceOwner.userId.replace(/^user_/, "");
        const userStateKey = `user.${userId}`;
        const structureId = `structure.${userId}`;

        // Check if alert dialog state already exists
        const alertDialogKey = `device_alert_dialog.${serial}`;
        const existAlertDialog = await this.getState(serial, alertDialogKey);
        if (!existAlertDialog) {
          const dialogValue: DialogState = {
            dialog_data: "",
            dialog_id: "confirm-pairing"
          }
          await this.upsertState(serial, alertDialogKey, 1, nowMs, dialogValue as Record<string,any>);
          dialogCreated = true;
        }

        // Check if the user state already exists
        const existingUserState = await this.getState(serial, userStateKey);
        if (!existingUserState) {
          const defaultUserState: UserState = {
            acknowledged_onboarding_screens: ["rcs"],
            email: userEmail,
            name: "",
            obsidian_version: "5.58rc3",
            profile_image_url: "",
            short_name: "",
            structures: [structureId],
            structure_memberships: [{
              structure: structureId,
              roles: ["owner"]
            }]
          }
          await this.upsertState(serial, userStateKey, 1, nowMs, defaultUserState);
          userCreated = true;
        }
      }
    } catch (error) {
      console.error(`[SQLite3] Failed to ensure alert dialog for ${serial}:`, error);
    }
  }

  /**
   * Get cached weather data
   */
  async getWeather(postalCode: string, country: string): Promise<StateWeatherCache | null> {
    const db = await this.getDb();
    if (!db) { return null; }

    try {
      const sql = `SELECT postalCode, country, fetchedAt, data as db_data FROM weather
        WHERE postalCode = ? AND country = ?`
      return new Promise<StateWeatherCache | null>((resolve, reject) => {
        db.get<WeatherData>(sql, [postalCode, country], (err, row) => {
          if (err) { reject(err); }
          if (row) {
            const weatherData = String(row.db_data);
            const weather = JSON.parse(weatherData);
            const weatherCache: StateWeatherCache = {
              data: weather,
              fetchedAt: Number(row.fetchedAt)
            }
            resolve(weatherCache);
          }
          resolve(null);
        })
      });
    } catch (err) {
      console.error(`[SQLite3] Failed to get weather for zip/country: `, err);
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
    const db = await this.getDb();
    if (!db) {
      return;
    }

    try {
      const currentWeather = await this.getWeather(postalCode, country);
      if (currentWeather) {
        const sql = `UPDATE weather SET fetchedAt = ?, data = ? WHERE postalCode = ? AND country = ?`;
        db.run(sql, [fetchedAt, JSON.stringify(data), postalCode, country], (err) => {
          if (err) { throw err; }
        });
      } else {
        const sql = `INSERT INTO weather (postalCode, country, fetchedAt, data)
          VALUES (?, ?, ?, ?)`;
        db.run(sql, [postalCode, country, fetchedAt, JSON.stringify(data)], (err) => {
          if (err) { throw err; }
        });
      }
    } catch (error) {
      console.error(`[SQLite3] Failed to upsert weather for ${postalCode}, ${country}:`, error);
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
    return;
    const db = await this.getDb();
    if (!db) {
      return;
    }

    try {
    } catch (error) {
      console.error(
        `[SQLite3] Failed to update weather for postal code ${postalCode}, ${country}:`,
        error
      );
    }
  }

  /**
   * Get user's weather data
   */
  async getUserWeather(userId: string): Promise<any | null> {
    const db = await this.getDb();
    if (!db) {
      return null;
    }

    try {
      userId = userId.replace(/^user_/, "");
      const ownerDevices = await this.getOwnerDevices(userId);
      if (!ownerDevices || ownerDevices.length === 0) {
        return null;
      }

      console.log(JSON.stringify(ownerDevices));
      let result = null;
      const userStateKey = `user.${userId}`;
      const userState = await this.getState(ownerDevices[0].serial, userStateKey);
      console.log(JSON.stringify(userState));
      if (userState) {
        result = userState?.value;
      }

      console.log(JSON.stringify(result));
      return result?.weather || null;
    } catch (error) {
      console.error(`[SQLite3] Failed to get user weather for ${userId}:`, error);
      return null;
    }
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

    try {
      const integrations =null; // await db.action('integrations_actions:getAllEnabledMqttIntegrationsSecure' as any, {});
      return integrations || [];
    } catch (error) {
      console.error('[SQLite3] Failed to fetch enabled MQTT integrations:', error);
      return [];
    }
  }

  /**
   * Get API key
   */
  async getApiKey(keyHash: string): Promise<APIKey | null> {
    const db = await this.getDb();
    if (!db) { return null; }

    try {
      const sql = `SELECT id, keyHash, keyPreview, userId, name, permissions as db_perms, createdAt, expiresAt, lastUsedAt 
        FROM apiKeys WHERE keyHash = ?`;
        return new Promise<any>((resolve, reject) => {
          db.get<APIKey>(sql, [keyHash], (err, row) => {
            if (err) { reject(err); }
            if (row) {
              let parsedPerms: any = null;
              if (row.db_perms) {
                parsedPerms = JSON.parse(row.db_perms);
              }
              const ret: APIKey = {
                id: row.id,
                keyHash: row.keyHash,
                keyPreview: row.keyPreview,
                userId: row.userId,
                name: row.name,
                permissions: parsedPerms as APIKeyPermissions,
                createdAt: row.createdAt,
                expiresAt: row.expiresAt,
                lastUsedAt: row.lastUsedAt
              }
              resolve(ret);
            }
            return resolve(null);
          });
        })
    } catch (err) {
      console.error('[SQLite3] Failed to fetch api key.', err);
      return null;
    }
  }

  /**
   * Update last used API key
   */
  async updateAPIKeyLastUsed(keyHash:string): Promise<void> {
    const db = await this.getDb();
    if (!db) { return; }

    try {
      const sql = `UPDATE apiKeys SET lastUsedAt = ? where keyHash = ?`;
      db.run(sql, [Date.now(), keyHash], (err) => {
        if (err) {
          console.error('[SQLite3] Faild to update last used for API key.');
        }
      })
    } catch (err) {
      console.error('[SQLite3] Failed to update last used for API key.');
      return;
    }
  }

  /**
   * Validate API key for authentication
   */
  async validateApiKey(key: string): Promise<{ userId: string; permissions: any; keyId: string } | null> {
    const db = await this.getDb();
    if (!db) {
      return null;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(key);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      const apiKey = await this.getApiKey(keyHash);
      
      if (!apiKey) {
        return null; // Invalid key
      }

      // Check if expired
      if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) {
        return null; // Expired
      }

      // Update last used timestamp
      await this.updateAPIKeyLastUsed(keyHash);
      
      return {
        userId: apiKey.userId,
        permissions: apiKey.permissions,
        keyId: String(apiKey.id)
      }
    } catch (error) {
      console.error('[SQLite3] Failed to validate API key:', error);
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
    const db = await this.getDb();
    if (!db) {
      return false;
    }

    try {
      // Check if device is in allowed serials list (empty = all devices)
      if (permissions.serials.length > 0 && permissions.serials.includes(serial)) {
        return false;
      }

      // Check if user owns the device
      const ownership = await this.getDeviceOwner(serial);
      if (ownership && ownership.userId === userId) {
        return requiredScopes.every((scope) => permissions.scopes.includes(scope));
      }

      // Check if device is shared with the user
      const sharedDevice = await this.getDeviceSharedWithMe(userId, serial);
      if (sharedDevice) {
        // User has shared access, check both share permissions and API key scopes
        const hasSharePermissions = requiredScopes.every((scope) => {
          if (scope === "read") return true;
          if (scope === "write" || scope === "control") {
            return sharedDevice.permissions.includes("control");
          }
          return false;
        });

        const hasKeyScope = requiredScopes.every((scope) => permissions.scopes.includes(scope));
        return hasSharePermissions && hasKeyScope;
      }
      return false;
    } catch (error) {
      console.error('[SQLite3] Failed to check API key permission:', error);
      return false;
    }
  }

  /**
   * List all devices owned by a user
   */
  async listUserDevices(userId: string): Promise<Array<{ serial: string }>> {
    const db = await this.getDb();
    if (!db) {
      return [];
    }

    try {
      const sql = `SELECT userId, serial, createdAt FROM deviceOwners WHERE userId = ?`;
      return new Promise<Array<{ serial: string }>>((resolve, reject) => {
        db.all<DeviceOwner>(sql, [userId], (err, rows) => {
          if (err) { reject(err); }
          if (rows) {
            let serials: Array<{ serial: string }> = [];
            for (const row of rows) {
              serials.push({ serial: row.serial});
            }
            resolve(serials);
          }
          resolve([]);
        });
      });
      const devices = null; //await db.query('users:listUserDevices' as any, { userId });
      return devices || [];
    } catch (error) {
      console.error('[SQLite3] Failed to list user devices:', error);
      return [];
    }
  }

  /**
   * Get Device shared with a user
   */
  async getDeviceSharedWithMe(userId: string, serial: string): Promise<{ serial: string; permissions: string[] } | null> {
    const db = await this.getDb();
    if (!db) { return null ;}

    try {
      const sql = `SELECT ownerId, sharedWithUserId, serial, 
        permissions as db_perms, createdAt FROM deviceShares 
        WHERE serial = ? AND sharedWithUserId = ?`;
      return new Promise<{ serial: string; permissions: string[]; }>((resolve, reject) => {
        db.get<DeviceSharedWith>(sql, [serial, userId], (err, row) => {
          if (err) { reject(err); }
          if (row) {
            const dbPerms: any = JSON.parse(row.db_perms);
            const ret = {
              serial: row.serial,
              permissions: dbPerms
            }
            resolve(ret);
          }
        });
      })
      return null;
    } catch (err) {
      console.error('[SQLite3] Failed to get device shared with user.', err);
      return null;
    }
  }

  /**
   * Get devices shared with a user
   */
  async getSharedWithMe(userId: string): Promise<Array<{ serial: string; permissions: string[] }>> {
    const db = await this.getDb();
    if (!db) {
      return [];
    }

    try {
      const sql = `SELECT ownerId, sharedWithUserId, serial, 
        permissions as db_perms, createdAt FROM deviceShares 
        WHERE sharedWithUserId = ?`;
      return new Promise<Array<{ serial: string; permissions: string[] }>>((resolve, reject) => {
        db.all<DeviceSharedWith>(sql, [userId], (err, rows) => {
          if (err) { reject(err); }
          if (rows) {
            let devices: Array<{ serial: string; permissions: string[] }> = [];
            
            for (const row of rows) {
              const dbPerms: any = JSON.parse(row.db_perms);
              let userPerms = { serial: row.serial, permissions: dbPerms as string[] };
              devices.push(userPerms);
            }
            resolve(devices);
          }
          resolve([]);
        });
      });
    } catch (error) {
      console.error('[SQLite3] Failed to get shared devices:', error);
      return [];
    }
  }

  async mergeValues(current: any, incoming: any): Promise<any> {
    if (incoming === undefined) {
      return current;
    }
    if (current === undefined) {
      return incoming;
    }
    const isObject = (val: any) => val !== null && typeof val === "object" && !Array.isArray(val);
    if (!isObject(current) || !isObject(incoming)) {
      return incoming;
    }
    const result: Record<string, any> = { ...current};
    for (const key of Object.keys(incoming)) {
      result[key] = await this.mergeValues((current as any)[key], incoming[key]);
    }
    return result;
  }
}
