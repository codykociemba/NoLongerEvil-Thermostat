/**
 * Integration Manager
 *
 * Manages lifecycle of all integrations (MQTT, WebSocket, Webhook, etc.)
 * Broadcasts device events to active integrations
 */

import { BaseIntegration } from './BaseIntegration';
import { DeviceStateChange } from './types';
import { DeviceStateService } from '../services/DeviceStateService';
import { SubscriptionManager } from '../services/SubscriptionManager';
import { AbstractDeviceStateManager } from '@/services/AbstractDeviceStateManager';

export class IntegrationManager {
  private integrations: Map<string, BaseIntegration> = new Map();
  private deviceStateManager: AbstractDeviceStateManager | null = null;
  private deviceState: DeviceStateService | null = null;
  private subscriptionManager: SubscriptionManager | null = null;

  /**
   * Initialize integration manager and load all enabled integrations
   */
  async initialize(deviceStateManager: AbstractDeviceStateManager, deviceState: DeviceStateService, subscriptionManager: SubscriptionManager): Promise<void> {
    this.deviceStateManager = deviceStateManager;
    this.deviceState = deviceState;
    this.subscriptionManager = subscriptionManager;

    console.log('[IntegrationManager] Initializing...');

    try {
      // Load all enabled MQTT integrations from Convex
      const mqttIntegrations = await this.deviceStateManager.getAllEnabledMqttIntegrations();

      console.log(`[IntegrationManager] Found ${mqttIntegrations.length} enabled MQTT integrations`);

      // Initialize each MQTT integration
      for (const { userId, config } of mqttIntegrations) {
        await this.loadMqttIntegration(userId, config);
      }

      console.log('[IntegrationManager] Initialization complete');
    } catch (error) {
      console.error('[IntegrationManager] Failed to initialize:', error);
    }
  }

  /**
   * Load a single MQTT integration
   */
  private async loadMqttIntegration(userId: string, config: any): Promise<void> {
    try {
      // Lazy load MQTT integration to avoid loading mqtt library if not used
      const { MqttIntegration } = await import('./mqtt/MqttIntegration');

      if (!this.deviceStateManager || !this.deviceState || !this.subscriptionManager) {
        throw new Error('IntegrationManager not initialized');
      }

      const integration = new MqttIntegration(userId, config, this.deviceState, this.deviceStateManager, this.subscriptionManager);
      await integration.initialize();

      const key = `mqtt:${userId}`;
      this.integrations.set(key, integration);

      console.log(`[IntegrationManager] Loaded MQTT integration for user ${userId}`);
    } catch (error) {
      console.error(`[IntegrationManager] Failed to load MQTT integration for user ${userId}:`, error);
    }
  }

  /**
   * Register an integration manually (for testing or future use)
   */
  registerIntegration(key: string, integration: BaseIntegration): void {
    this.integrations.set(key, integration);
  }

  /**
   * Notify all integrations of a device state change
   */
  async notifyStateChange(serial: string, objectKey: string, objectRevision: number, objectTimestamp: number, value: any): Promise<void> {
    const change: DeviceStateChange = {
      serial,
      objectKey,
      objectRevision,
      objectTimestamp,
      value,
    };

    // Broadcast to all integrations concurrently
    const promises = Array.from(this.integrations.values()).map(async (integration) => {
      try {
        await integration.onDeviceStateChange(change);
      } catch (error) {
        console.error(`[IntegrationManager] Error in ${integration.getType()} integration for user ${integration.getUserId()}:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Notify integrations when a device connects
   */
  async notifyDeviceConnected(serial: string): Promise<void> {
    const promises = Array.from(this.integrations.values()).map(async (integration) => {
      try {
        await integration.onDeviceConnected(serial);
      } catch (error) {
        console.error(`[IntegrationManager] Error notifying device connection:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Notify integrations when a device disconnects
   */
  async notifyDeviceDisconnected(serial: string): Promise<void> {
    const promises = Array.from(this.integrations.values()).map(async (integration) => {
      try {
        await integration.onDeviceDisconnected(serial);
      } catch (error) {
        console.error(`[IntegrationManager] Error notifying device disconnection:`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Reload integrations from database (hot reload)
   */
  async reload(): Promise<void> {
    console.log('[IntegrationManager] Reloading integrations...');

    // Shutdown all existing integrations
    await this.shutdown();

    // Reinitialize
    if (this.deviceStateManager && this.deviceState && this.subscriptionManager) {
      await this.initialize(this.deviceStateManager, this.deviceState, this.subscriptionManager);
    }
  }

  /**
   * Shutdown all integrations
   */
  async shutdown(): Promise<void> {
    console.log('[IntegrationManager] Shutting down all integrations...');

    const promises = Array.from(this.integrations.values()).map(async (integration) => {
      try {
        await integration.shutdown();
      } catch (error) {
        console.error(`[IntegrationManager] Error shutting down integration:`, error);
      }
    });

    await Promise.all(promises);
    this.integrations.clear();

    console.log('[IntegrationManager] All integrations shut down');
  }

  /**
   * Get count of active integrations
   */
  getActiveCount(): number {
    return this.integrations.size;
  }

  /**
   * Get integration types (for status/debugging)
   */
  getActiveIntegrationTypes(): string[] {
    return Array.from(this.integrations.values()).map((i) => i.getType());
  }
}
