/**
 * MQTT Integration
 *
 * Connects to MQTT broker and:
 * - Publishes device state changes to MQTT topics (Nest-compatible field names)
 * - Subscribes to command topics and executes commands
 * - Publishes Home Assistant discovery messages
 * - Handles availability (online/offline) status
 *
 */

import * as mqtt from 'mqtt';
import { BaseIntegration } from '../BaseIntegration';
import { DeviceStateChange, MqttConfig } from '../types';
import { DeviceStateService } from '../../services/DeviceStateService';
import { AbstractDeviceStateManager } from '@/services/AbstractDeviceStateManager';
import { SubscriptionManager } from '../../services/SubscriptionManager';
import { validateTemperature } from '../../utils/temperatureSafety';
import {
  parseObjectKey,
  buildStateTopic,
  buildAvailabilityTopic,
  parseCommandTopic,
  getCommandTopicPatterns,
} from './topicBuilder';
import { publishThermostatDiscovery, removeDeviceDiscovery } from './HomeAssistantDiscovery';
import {
  nestModeToHA,
  haModeToNest,
  deriveHvacAction,
  deriveFanMode,
  isDeviceAway,
  isFanRunning,
  isEcoActive,
  nestPresetToHA,
} from './helpers';

export class MqttIntegration extends BaseIntegration {
  private client: mqtt.MqttClient | null = null;
  private config: MqttConfig;
  private deviceState: DeviceStateService;
  private deviceStateManager: AbstractDeviceStateManager;
  private subscriptionManager: SubscriptionManager;
  private userDeviceSerials: Set<string> = new Set();
  private isReady: boolean = false;
  private deviceWatchInterval: NodeJS.Timeout | null = null;

  constructor(
    userId: string,
    config: MqttConfig,
    deviceState: DeviceStateService,
    deviceStateManager: AbstractDeviceStateManager,
    subscriptionManager: SubscriptionManager
  ) {
    super(userId, 'mqtt');
    this.config = {
      topicPrefix: 'nest',
      discoveryPrefix: 'homeassistant',
      clientId: `nolongerevil-${userId}`,
      publishRaw: true, // Default: publish raw Nest objects
      homeAssistantDiscovery: false, // Default: don't publish HA formatted (user must enable)
      ...config, // User config overrides defaults
    };
    this.deviceState = deviceState;
    this.deviceStateManager = deviceStateManager;
    this.subscriptionManager = subscriptionManager;
  }

  /**
   * Initialize MQTT connection
   */
  async initialize(): Promise<void> {
    console.log(`[MQTT:${this.userId}] Initializing MQTT integration...`);

    try {
      await this.loadUserDevices();

      await this.connectToBroker();

      await this.subscribeToCommands();

      // Publish Initial State FIRST to populate data for discovery check
      await this.publishInitialState();

      // Discovery now runs after data is loaded (checking for has_humidifier)
      await this.publishDiscoveryMessages();

      this.startDeviceWatching();

      this.isReady = true;
      console.log(`[MQTT:${this.userId}] Integration initialized successfully`);
    } catch (error) {
      console.error(`[MQTT:${this.userId}] Failed to initialize:`, error);
      throw error;
    }
  }

  /**
   * Start polling for device changes
   */
  private startDeviceWatching(): void {
    if (this.deviceWatchInterval) {
      clearInterval(this.deviceWatchInterval);
    }

    this.deviceWatchInterval = setInterval(async () => {
      await this.checkForDeviceChanges();
    }, 10000);

    console.log(`[MQTT:${this.userId}] Started watching for device changes (polling every 10s)`);
  }

  /**
   * Check for added/removed devices and update accordingly
   */
  private async checkForDeviceChanges(): Promise<void> {
    if (!this.isReady) return;

    try {
      const ownedDevices = await this.deviceStateManager.listUserDevices(this.userId);
      const sharedDevices = await this.deviceStateManager.getSharedWithMe(this.userId);

      const currentSerials = new Set<string>();
      for (const device of ownedDevices) {
        currentSerials.add(device.serial);
      }
      for (const share of sharedDevices) {
        currentSerials.add(share.serial);
      }

      // Detect removed devices
      for (const serial of this.userDeviceSerials) {
        if (!currentSerials.has(serial)) {
          console.log(`[MQTT:${this.userId}] Device ${serial} was removed, cleaning up...`);
          await this.handleDeviceRemoved(serial);
        }
      }

      // Detect added devices
      for (const serial of currentSerials) {
        if (!this.userDeviceSerials.has(serial)) {
          console.log(`[MQTT:${this.userId}] New device ${serial} detected, publishing discovery...`);
          this.userDeviceSerials.add(serial);

          // Publish discovery for new device
          if (this.config.homeAssistantDiscovery && this.client) {
            try {
              await publishThermostatDiscovery(
                this.client,
                serial,
                this.deviceState,
                this.config.topicPrefix!,
                this.config.discoveryPrefix!
              );
              await this.publishHomeAssistantState(serial);
              await this.publishAvailability(serial, 'online');
            } catch (error) {
              console.error(`[MQTT:${this.userId}] Failed to publish discovery for new device ${serial}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`[MQTT:${this.userId}] Error checking for device changes:`, error);
    }
  }

  /**
   * Handle device removal - clean up HA discovery
   */
  private async handleDeviceRemoved(serial: string): Promise<void> {
    // Remove from local tracking
    this.userDeviceSerials.delete(serial);

    // Mark device as offline
    await this.publishAvailability(serial, 'offline');

    // Remove Home Assistant discovery (publishes empty payloads)
    if (this.config.homeAssistantDiscovery && this.client) {
      try {
        await removeDeviceDiscovery(this.client, serial, this.config.discoveryPrefix!);
        console.log(`[MQTT:${this.userId}] Successfully removed device ${serial} from Home Assistant`);
      } catch (error) {
        console.error(`[MQTT:${this.userId}] Failed to remove discovery for ${serial}:`, error);
      }
    }
  }

  /**
   * Load user's devices from device state manager
   */
  private async loadUserDevices(): Promise<void> {
    try {
      const ownedDevices = await this.deviceStateManager.listUserDevices(this.userId);

      const sharedDevices = await this.deviceStateManager.getSharedWithMe(this.userId);

      this.userDeviceSerials.clear();
      for (const device of ownedDevices) {
        this.userDeviceSerials.add(device.serial);
      }
      for (const share of sharedDevices) {
        this.userDeviceSerials.add(share.serial);
      }

      console.log(`[MQTT:${this.userId}] Loaded ${this.userDeviceSerials.size} device(s)`);
    } catch (error) {
      console.error(`[MQTT:${this.userId}] Failed to load user devices:`, error);
    }
  }

  /**
   * Connect to MQTT broker
   */
  private async connectToBroker(): Promise<void> {
    return new Promise((resolve, reject) => {
      const options: mqtt.IClientOptions = {
        clientId: this.config.clientId,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      };

      if (this.config.username) {
        options.username = this.config.username;
      }

      if (this.config.password) {
        options.password = this.config.password;
      }

      options.will = {
        topic: `${this.config.topicPrefix}/status`,
        payload: 'offline',
        qos: 1,
        retain: true,
      };

      this.client = mqtt.connect(this.config.brokerUrl!, options);

      this.client.on('connect', () => {
        console.log(`[MQTT:${this.userId}] Connected to broker ${this.config.brokerUrl}`);
        resolve();
      });

      this.client.on('error', (error) => {
        console.error(`[MQTT:${this.userId}] Connection error:`, error);
        if (!this.client!.connected) {
          reject(error);
        }
      });

      this.client.on('message', async (topic, message) => {
        await this.handleCommand(topic, message);
      });

      this.client.on('reconnect', () => {
        console.log(`[MQTT:${this.userId}] Reconnecting to broker...`);
      });

      this.client.on('offline', () => {
        console.log(`[MQTT:${this.userId}] Client offline`);
      });
    });
  }

  /**
   * Subscribe to command topics
   */
  private async subscribeToCommands(): Promise<void> {
    if (!this.client) return;

    const prefix = this.config.topicPrefix!;
    const patterns: string[] = [];

    if (this.config.publishRaw !== false) {
      patterns.push(...getCommandTopicPatterns(prefix));
    }

    if (this.config.homeAssistantDiscovery) {
      patterns.push(`${prefix}/+/ha/+/set`);
    }

    for (const pattern of patterns) {
      await new Promise<void>((resolve, reject) => {
        this.client!.subscribe(pattern, { qos: 1 }, (err) => {
          if (err) {
            console.error(`[MQTT:${this.userId}] Failed to subscribe to ${pattern}:`, err);
            reject(err);
          } else {
            console.log(`[MQTT:${this.userId}] Subscribed to commands: ${pattern}`);
            resolve();
          }
        });
      });
    }
  }

  /**
   * Handle incoming MQTT command
   */
  private async handleCommand(topic: string, message: Buffer): Promise<void> {
    try {
      const prefix = this.config.topicPrefix!;

      if (topic.includes('/ha/') && topic.endsWith('/set')) {
        await this.handleHomeAssistantCommand(topic, message);
        return;
      }

      const parsed = parseCommandTopic(topic, prefix);
      if (!parsed) {
        console.warn(`[MQTT:${this.userId}] Invalid command topic: ${topic}`);
        return;
      }

      const { serial, objectType, field } = parsed;

      if (!this.userDeviceSerials.has(serial)) {
        console.warn(`[MQTT:${this.userId}] Unauthorized command for device ${serial}`);
        return;
      }

      const valueStr = message.toString();
      let value: any = valueStr;

      try {
        value = JSON.parse(valueStr);
      } catch {
        const num = parseFloat(valueStr);
        if (!isNaN(num)) {
          value = num;
        }
      }

      console.log(`[MQTT:${this.userId}] Command: ${serial}/${objectType}.${field} = ${value}`);

      const objectKey = `${objectType}.${serial}`;
      const currentObj = await this.deviceState.get(serial, objectKey);

      if (!currentObj) {
        console.warn(`[MQTT:${this.userId}] Object not found: ${objectKey}`);
        return;
      }

      const newValue = {
        ...currentObj.value,
        [field]: value,
      };

      const newRevision = currentObj.object_revision + 1;
      const newTimestamp = Date.now();

      await this.deviceState.upsert(serial, objectKey, newRevision, newTimestamp, newValue);

      console.log(`[MQTT:${this.userId}] Command executed successfully`);
    } catch (error) {
      console.error(`[MQTT:${this.userId}] Failed to handle command:`, error);
    }
  }

  /**
   * Handle Home Assistant formatted command
   */
  private async handleHomeAssistantCommand(topic: string, message: Buffer): Promise<void> {
    try {
      const prefix = this.config.topicPrefix!;
      const valueStr = message.toString().trim();

      const match = topic.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^/]+)/ha/(.+)/set$`));
      if (!match) {
        console.warn(`[MQTT:${this.userId}] Invalid HA command topic: ${topic}`);
        return;
      }

      const [, serial, command] = match;

      if (!this.userDeviceSerials.has(serial)) {
        console.warn(`[MQTT:${this.userId}] Unauthorized HA command for device ${serial}`);
        return;
      }

      console.log(`[MQTT:${this.userId}] HA Command: ${serial}/${command} = ${valueStr}`);

      const deviceObj = await this.deviceState.get(serial, `device.${serial}`);
      const sharedObj = await this.deviceState.get(serial, `shared.${serial}`);

      if (!deviceObj || !sharedObj) {
        console.warn(`[MQTT:${this.userId}] Device ${serial} not fully initialized`);
        return;
      }

      // HA sends temperatures in Celsius (as declared in discovery config)
      // No conversion needed - just validate and pass through
      switch (command) {
        case 'mode':
          const nestMode = haModeToNest(valueStr);
          await this.updateSharedValue(serial, sharedObj, 'target_temperature_type', nestMode);
          break;

        case 'target_temperature':
          const tempC = validateTemperature(parseFloat(valueStr), sharedObj.value);
          await this.updateSharedValue(serial, sharedObj, 'target_temperature', tempC);
          break;

        case 'target_temperature_low':
          const tempLowC = validateTemperature(parseFloat(valueStr), sharedObj.value);
          await this.updateSharedValue(serial, sharedObj, 'target_temperature_low', tempLowC);
          break;

        case 'target_temperature_high':
          const tempHighC = validateTemperature(parseFloat(valueStr), sharedObj.value);
          await this.updateSharedValue(serial, sharedObj, 'target_temperature_high', tempHighC);
          break;

        case 'fan_mode':
          if (valueStr === 'on') {
            // Turn fan on: activate control state and set timer
            // Set timeout to 60 minutes from now (3600 seconds)
            const timeoutTimestamp = Math.floor(Date.now() / 1000) + 3600;
            await this.updateDeviceFields(serial, deviceObj, {
              fan_control_state: true,
              fan_timer_active: true,
              fan_timer_timeout: timeoutTimestamp,
            });
          } else {
            // Turn fan off: deactivate control state and clear timer
            await this.updateDeviceFields(serial, deviceObj, {
              fan_control_state: false,
              fan_timer_active: false,
              fan_timer_timeout: 0,
            });
          }
          break;

        case 'preset':
          if (valueStr === 'away') {
            await this.updateDeviceValue(serial, deviceObj, 'auto_away', 2);
            await this.updateDeviceValue(serial, deviceObj, 'away', true);
          } else if (valueStr === 'home') {
            await this.updateDeviceValue(serial, deviceObj, 'auto_away', 0);
            await this.updateDeviceValue(serial, deviceObj, 'away', false);
          } else if (valueStr === 'eco') {
            await this.updateDeviceValue(serial, deviceObj, 'eco', { mode: 'manual-eco', leaf: true });
          }
          break;

        case 'target_humidity':
          let humVal = parseFloat(valueStr);
          // 1. Validation (10-60 range, ignore -1)
          if (!isNaN(humVal) && humVal >= 10 && humVal <= 60) {
            // 2. Rounding
            humVal = Math.round(humVal / 5) * 5;
            console.log(`[MQTT:${this.userId}] Setting Humidity Target: ${humVal}%`);
            // 3. Atomic Update (Value + Enable)
            await this.updateSharedFields(serial, sharedObj, {
              target_humidity: humVal,
              target_humidity_enabled: true
            });
            await this.updateDeviceFields(serial, deviceObj, {
              target_humidity: humVal,
              target_humidity_enabled: true
            });
          }
          break;

        case 'humidifier_enabled':
        case 'target_humidity_enabled':
          const isEnabled = valueStr === 'true';
          console.log(`[MQTT:${this.userId}] Setting Humidifier Enabled: ${isEnabled}`);
          if (isEnabled) {
            // Turn ON: Default to 40% if current target is bad
            const currentTgt = sharedObj.value.target_humidity;
            const isValidTarget = (currentTgt !== undefined && currentTgt >= 10 && currentTgt <= 60);
            const safeTgt = isValidTarget ? currentTgt : 40;
            await this.updateSharedFields(serial, sharedObj, {
              target_humidity_enabled: true,
              target_humidity: safeTgt
            });
            await this.updateDeviceFields(serial, deviceObj, {
              target_humidity_enabled: true,
              target_humidity: safeTgt
            });
          } else {
            // Turn OFF: Just disable flag
            await this.updateSharedValue(serial, sharedObj, 'target_humidity_enabled', false);
            await this.updateDeviceValue(serial, deviceObj, 'target_humidity_enabled', false);
          }
          break;

        default:
          console.warn(`[MQTT:${this.userId}] Unknown HA command: ${command}`);
      }

      console.log(`[MQTT:${this.userId}] HA command executed successfully`);

      // Republish state to reflect the changes in Home Assistant
      await this.publishHomeAssistantState(serial);
    } catch (error) {
      console.error(`[MQTT:${this.userId}] Failed to handle HA command:`, error);
    }
  }

  private async updateSharedValue(serial: string, currentObj: any, field: string, value: any): Promise<void> {
    const objectKey = `shared.${serial}`;
    const newValue = {
      ...currentObj.value,
      [field]: value,
    };
    const newRevision = currentObj.object_revision + 1;
    const newTimestamp = Date.now();

    const updatedObj = await this.deviceState.upsert(serial, objectKey, newRevision, newTimestamp, newValue);
    const notifyResult = this.subscriptionManager.notify(serial, objectKey, updatedObj);
    console.log(`[MQTT:${this.userId}] Notified ${notifyResult.notified} subscriber(s) for ${serial}/${objectKey}`);
  }

  // Helper for atomic updates to shared state
  private async updateSharedFields(serial: string, currentObj: any, fields: Record<string, any>): Promise<void> {
    const objectKey = `shared.${serial}`;
    const newValue = { ...currentObj.value, ...fields };
    const newRevision = currentObj.object_revision + 1;
    const newTimestamp = Date.now();

    const updatedObj = await this.deviceState.upsert(serial, objectKey, newRevision, newTimestamp, newValue);
    const notifyResult = this.subscriptionManager.notify(serial, objectKey, updatedObj);
    console.log(`[MQTT:${this.userId}] Notified ${notifyResult.notified} subscriber(s) for ${serial}/${objectKey}`);
  }

  private async updateDeviceValue(serial: string, currentObj: any, field: string, value: any): Promise<void> {
    const objectKey = `device.${serial}`;
    const newValue = {
      ...currentObj.value,
      [field]: value,
    };
    const newRevision = currentObj.object_revision + 1;
    const newTimestamp = Date.now();

    const updatedObj = await this.deviceState.upsert(serial, objectKey, newRevision, newTimestamp, newValue);
    const notifyResult = this.subscriptionManager.notify(serial, objectKey, updatedObj);
    console.log(`[MQTT:${this.userId}] Notified ${notifyResult.notified} subscriber(s) for ${serial}/${objectKey}`);
  }

  /**
   * Update multiple fields in device.{serial} atomically
   */
  private async updateDeviceFields(serial: string, currentObj: any, fields: Record<string, any>): Promise<void> {
    const objectKey = `device.${serial}`;
    const newValue = {
      ...currentObj.value,
      ...fields, // Merge all fields at once
    };
    const newRevision = currentObj.object_revision + 1;
    const newTimestamp = Date.now();

    const updatedObj = await this.deviceState.upsert(serial, objectKey, newRevision, newTimestamp, newValue);
    const notifyResult = this.subscriptionManager.notify(serial, objectKey, updatedObj);
    console.log(`[MQTT:${this.userId}] Notified ${notifyResult.notified} subscriber(s) for ${serial}/${objectKey} (${Object.keys(fields).length} fields updated)`);
  }

  /**
   * Publish Home Assistant discovery messages
   */
  private async publishDiscoveryMessages(): Promise<void> {
    if (!this.client || !this.config.homeAssistantDiscovery) {
      console.log(`[MQTT:${this.userId}] Skipping discovery - HA discovery disabled`);
      return;
    }

    console.log(`[MQTT:${this.userId}] Publishing HA discovery messages for ${this.userDeviceSerials.size} device(s)...`);

    for (const serial of this.userDeviceSerials) {
      try {
        await publishThermostatDiscovery(
          this.client,
          serial,
          this.deviceState,
          this.config.topicPrefix!,
          this.config.discoveryPrefix!
        );
      } catch (error) {
        console.error(`[MQTT:${this.userId}] Failed to publish discovery for ${serial}:`, error);
      }
    }

    console.log(`[MQTT:${this.userId}] HA discovery messages published`);
  }

  /**
   * Publish initial state for all user devices
   */
  private async publishInitialState(): Promise<void> {
    if (!this.client) {
      console.log(`[MQTT:${this.userId}] Cannot publish initial state - no MQTT client`);
      return;
    }

    console.log(`[MQTT:${this.userId}] Publishing initial state for ${this.userDeviceSerials.size} device(s)...`);

    for (const serial of this.userDeviceSerials) {
      try {
        console.log(`[MQTT:${this.userId}] Getting state for device ${serial}...`);

        // Get all objects for this device
        const deviceObjects = await this.deviceState.getAllForDevice(serial);
        const objectKeys = Object.keys(deviceObjects);

        console.log(`[MQTT:${this.userId}] Device ${serial} has ${objectKeys.length} objects:`, objectKeys);

        if (objectKeys.length === 0) {
          console.warn(`[MQTT:${this.userId}] Device ${serial} has no state yet, skipping initial publish`);
          continue;
        }

        // Publish each object (raw MQTT only, skip HA state for now)
        for (const objectKey of objectKeys) {
          const obj = deviceObjects[objectKey];
          console.log(`[MQTT:${this.userId}] Publishing ${objectKey}...`);
          await this.publishObjectState(serial, objectKey, obj.value, true); // Pass skipHA flag
        }

        // Now publish Home Assistant state once (after all objects loaded)
        if (this.config.homeAssistantDiscovery) {
          console.log(`[MQTT:${this.userId}] Publishing Home Assistant state for ${serial}...`);
          await this.publishHomeAssistantState(serial);
        }

        // Mark device as online
        await this.publishAvailability(serial, 'online');
        console.log(`[MQTT:${this.userId}] Published initial state for ${serial}`);
      } catch (error) {
        console.error(`[MQTT:${this.userId}] Failed to publish initial state for ${serial}:`, error);
      }
    }

    console.log(`[MQTT:${this.userId}] Initial state publishing complete`);
  }

  /**
   * Publish device state to MQTT (raw Nest objects)
   */
  private async publishObjectState(serial: string, objectKey: string, value: any, skipHA: boolean = false): Promise<void> {
    if (!this.client || !this.isReady) return;

    const parsed = parseObjectKey(objectKey);
    if (!parsed) return;

    const { objectType } = parsed;

    if (this.config.publishRaw !== false) {
      const fullTopic = buildStateTopic(this.config.topicPrefix!, serial, objectType);
      await this.publish(fullTopic, JSON.stringify(value), { retain: true, qos: 0 });

      for (const [field, fieldValue] of Object.entries(value)) {
        const fieldTopic = buildStateTopic(this.config.topicPrefix!, serial, objectType, field);
        const payload = typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue);
        await this.publish(fieldTopic, payload, { retain: true, qos: 0 });
      }
    }

    if (this.config.homeAssistantDiscovery && !skipHA) {
      await this.publishHomeAssistantState(serial);
    }
  }

  /**
   * Publish Home Assistant formatted state for a device
   * All temperatures are published in Celsius (Nest's internal format)
   * HA handles display conversion based on user preferences
   */
  private async publishHomeAssistantState(serial: string): Promise<void> {
    if (!this.client || !this.isReady) {
      console.log(`[MQTT:${this.userId}] Cannot publish HA state for ${serial} - client not ready`);
      return;
    }

    try {
      console.log(`[MQTT:${this.userId}] Starting HA state publish for ${serial}...`);

      // Republish discovery to ensure configuration matches current mode
      await publishThermostatDiscovery(
        this.client,
        serial,
        this.deviceState,
        this.config.topicPrefix!,
        this.config.discoveryPrefix!
      );

      const prefix = this.config.topicPrefix!;

      // Get current device state
      const deviceObj = await this.deviceState.get(serial, `device.${serial}`);
      const sharedObj = await this.deviceState.get(serial, `shared.${serial}`);

      if (!deviceObj || !sharedObj) {
        console.warn(`[MQTT:${this.userId}] Cannot publish HA state for ${serial} - missing objects (device: ${!!deviceObj}, shared: ${!!sharedObj})`);
        return; // Device not fully initialized yet
      }

      console.log(`[MQTT:${this.userId}] Publishing HA state topics for ${serial}...`);

      const device = deviceObj.value || {};
      const shared = sharedObj.value || {};

      // Publish temperatures in Celsius (Nest's internal format)
      // HA discovery declares temperature_unit: C, so HA will convert for display
      const currentTemp = shared.current_temperature ?? device.current_temperature;
      if (currentTemp !== null && currentTemp !== undefined) {
        await this.publish(`${prefix}/${serial}/ha/current_temperature`, String(currentTemp), { retain: true, qos: 0 });
      }

      if (device.current_humidity !== undefined) {
        await this.publish(`${prefix}/${serial}/ha/current_humidity`, String(device.current_humidity), { retain: true, qos: 0 });
      }

      if (shared.target_temperature !== null && shared.target_temperature !== undefined) {
        await this.publish(`${prefix}/${serial}/ha/target_temperature`, String(shared.target_temperature), { retain: true, qos: 0 });
      }

      if (shared.target_temperature_low !== null && shared.target_temperature_low !== undefined) {
        await this.publish(`${prefix}/${serial}/ha/target_temperature_low`, String(shared.target_temperature_low), { retain: true, qos: 0 });
      }

      if (shared.target_temperature_high !== null && shared.target_temperature_high !== undefined) {
        await this.publish(`${prefix}/${serial}/ha/target_temperature_high`, String(shared.target_temperature_high), { retain: true, qos: 0 });
      }

      // Humidifier State
      const targetHum = device.target_humidity ?? shared.target_humidity;
      if (targetHum !== undefined && targetHum >= 10 && targetHum <= 60) {
        await this.publish(`${prefix}/${serial}/device/target_humidity`, String(targetHum), { retain: true, qos: 0 });
      }

      const rawEnabled = shared.target_humidity_enabled === true || device.target_humidity_enabled === true;
      const isTargetOff = targetHum === -1;
      const isEnabled = rawEnabled && !isTargetOff;
      await this.publish(`${prefix}/${serial}/ha/humidifier_enabled`, String(isEnabled), { retain: true, qos: 0 });

      const valveState = String(device.humidifier_state).toLowerCase();
      const isValveOpen = valveState === 'true' || valveState === 'on';
      let humAction = 'idle';
      if (isEnabled && isValveOpen) humAction = 'humidifying';
      await this.publish(`${prefix}/${serial}/ha/humidifier_action`, humAction, { retain: true, qos: 0 });

      const haMode = nestModeToHA(shared.target_temperature_type);
      await this.publish(`${prefix}/${serial}/ha/mode`, haMode, { retain: true, qos: 0 });

      const action = await deriveHvacAction(serial, this.deviceState);
      console.log(`[MQTT:${this.userId}] HVAC action for ${serial}: ${action} (heater: ${shared.hvac_heater_state}, ac: ${shared.hvac_ac_state}, fan: ${shared.hvac_fan_state})`);
      await this.publish(`${prefix}/${serial}/ha/action`, action, { retain: true, qos: 0 });

      const fanMode = await deriveFanMode(serial, this.deviceState);
      console.log(`[MQTT:${this.userId}] Fan mode for ${serial}: ${fanMode} (timer_timeout: ${device.fan_timer_timeout}, control_state: ${device.fan_control_state}, hvac_fan: ${shared.hvac_fan_state})`);
      await this.publish(`${prefix}/${serial}/ha/fan_mode`, fanMode, { retain: true, qos: 0 });

      const preset = await nestPresetToHA(serial, this.deviceState);
      if (preset) {
        await this.publish(`${prefix}/${serial}/ha/preset`, preset, { retain: true, qos: 0 });
      }

      // Outdoor temperature (already in Celsius)
      let outdoorTempCelsius = device.outdoor_temperature ?? shared.outside_temperature ?? device.outside_temperature;

      if (outdoorTempCelsius === undefined || outdoorTempCelsius === null) {
        try {
          const userWeather = await this.deviceStateManager.getUserWeather(this.userId);
          if (userWeather?.current?.temp_c !== undefined) {
            outdoorTempCelsius = userWeather.current.temp_c;
          }
        } catch (error) {
          console.error(`[MQTT:${this.userId}] Failed to get user weather for outdoor temp:`, error);
        }
      }

      if (outdoorTempCelsius !== null && outdoorTempCelsius !== undefined) {
        await this.publish(`${prefix}/${serial}/ha/outdoor_temperature`, String(outdoorTempCelsius), { retain: true, qos: 0 });
      }

      const isAway = await isDeviceAway(serial, this.deviceState);
      await this.publish(`${prefix}/${serial}/ha/occupancy`, isAway ? 'away' : 'home', { retain: true, qos: 0 });

      const fanRunning = await isFanRunning(serial, this.deviceState);
      await this.publish(`${prefix}/${serial}/ha/fan_running`, String(fanRunning), { retain: true, qos: 0 });

      const eco = await isEcoActive(serial, this.deviceState);
      await this.publish(`${prefix}/${serial}/ha/eco`, String(eco), { retain: true, qos: 0 });

      console.log(`[MQTT:${this.userId}] Successfully published HA state for ${serial}`);
    } catch (error) {
      console.error(`[MQTT:${this.userId}] Error publishing HA state for ${serial}:`, error);
      throw error; // Re-throw to ensure errors are visible
    }
  }

  /**
   * Publish availability status
   */
  private async publishAvailability(serial: string, status: 'online' | 'offline'): Promise<void> {
    if (!this.client) return;

    const topic = buildAvailabilityTopic(this.config.topicPrefix!, serial);
    await this.publish(topic, status, { retain: true, qos: 1 });
  }

  /**
   * Publish message to MQTT (with error handling)
   */
  private async publish(topic: string, message: string, options: mqtt.IClientPublishOptions): Promise<void> {
    if (!this.client) return;

    return new Promise((resolve, reject) => {
      this.client!.publish(topic, message, options, (err) => {
        if (err) {
          console.error(`[MQTT:${this.userId}] Failed to publish to ${topic}:`, err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Called when device state changes (from BaseIntegration)
   */
  async onDeviceStateChange(change: DeviceStateChange): Promise<void> {
    if (!this.userDeviceSerials.has(change.serial)) {
      console.log(`[MQTT:${this.userId}] Ignoring state change for ${change.serial} (not authorized)`);
      return;
    }

    console.log(`[MQTT:${this.userId}] Publishing state change: ${change.serial}/${change.objectKey}`);

    await this.publishObjectState(change.serial, change.objectKey, change.value);
  }

  /**
   * Called when device connects (from BaseIntegration)
   */
  async onDeviceConnected(serial: string): Promise<void> {
    if (!this.userDeviceSerials.has(serial)) {
      return;
    }

    await this.publishAvailability(serial, 'online');
  }

  /**
   * Called when device disconnects (from BaseIntegration)
   */
  async onDeviceDisconnected(serial: string): Promise<void> {
    if (!this.userDeviceSerials.has(serial)) {
      return;
    }

    await this.publishAvailability(serial, 'offline');
  }

  /**
   * Shutdown MQTT connection
   */
  async shutdown(): Promise<void> {
    console.log(`[MQTT:${this.userId}] Shutting down...`);

    if (this.deviceWatchInterval) {
      clearInterval(this.deviceWatchInterval);
      this.deviceWatchInterval = null;
    }

    if (this.client) {
      for (const serial of this.userDeviceSerials) {
        await this.publishAvailability(serial, 'offline');
      }

      await new Promise<void>((resolve) => {
        this.client!.end(false, {}, () => {
          console.log(`[MQTT:${this.userId}] Disconnected from broker`);
          resolve();
        });
      });

      this.client = null;
    }

    this.isReady = false;
  }
}
