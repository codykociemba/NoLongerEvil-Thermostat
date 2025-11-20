/**
 * Core type definitions for the NoLongerEvil Thermostat API
 */

import { ServerResponse } from 'http';

/**
 * Device State Object
 * Represents a single object in the Nest protocol (device.SERIAL, shared.SERIAL, etc.)
 */
export interface DeviceObject {
  object_key: string;
  object_revision: number;
  object_timestamp: number;
  value: Record<string, any>;
}

/**
 * Client Device Object (from device requests)
 * May not include value field when subscribing
 */
export interface ClientDeviceObject {
  object_key: string;
  object_revision: number;
  object_timestamp: number;
  value?: Record<string, any>;
}

/**
 * Device State Store
 * Maps serial -> object_key -> DeviceObject
 */
export interface DeviceStateStore {
  [serial: string]: {
    [objectKey: string]: DeviceObject;
  };
}

/**
 * Subscription Entry
 * Represents an active long-poll connection waiting for updates
 */
export interface Subscription {
  res: ServerResponse;
  objects: ClientDeviceObject[];
  sessionId: string;
  connectedAt: number;
  serial: string;
}

/**
 * Entry Key
 * 7-character pairing code for new devices
 */
export interface EntryKey {
  value: string;
  expires: number;
}

/**
 * Weather Data Structure
 */
export interface WeatherData {
  [location: string]: {
    now: {
      temp_c: number;
      temp_f: number;
      condition: string;
      humidity: number;
      wind_kph: number;
      wind_mph: number;
    };
    forecast: Array<{
      date: string;
      high_c: number;
      high_f: number;
      low_c: number;
      low_f: number;
      condition: string;
    }>;
  };
}

/**
 * Command Request (from web dashboard)
 */
export interface CommandRequest {
  serial: string;
  action: 'temp' | 'temperature' | 'away' | 'set';
  value?: any;
  mode?: 'heat' | 'cool' | 'range';
  target_temperature_low?: number;
  target_temperature_high?: number;
  target_change_pending?: boolean;
  object?: string;
  field?: string;
}

/**
 * Command Response
 */
export interface CommandResponse {
  success: boolean;
  message: string;
  device: string;
  object: string;
  revision: number;
  timestamp: number;
}

/**
 * Environment Configuration
 */
export interface EnvironmentConfig {
  CONVEX_URL: string | null;
  CONVEX_ADMIN_KEY: string | null;
  API_ORIGIN: string;
  PROXY_PORT: number;
  CONTROL_PORT: number;
  CERT_DIR: string | null;
  ENTRY_KEY_TTL_SECONDS: number;
  WEATHER_CACHE_TTL_MS: number;
  SUBSCRIPTION_TIMEOUT_MS: number;
  MAX_SUBSCRIPTIONS_PER_DEVICE: number;
  DEBUG_LOGGING: boolean;
}

/**
 * State Device Owner Response
 */
export interface DeviceOwner {
  userId: string;
}

/**
 * State Entry Key Response
 */
export interface StateEntryKey {
  code: string;
  expiresAt: number;
}

/**
 * State Weather Cache Entry
 */
export interface StateWeatherCache {
  data: WeatherData;
  fetchedAt: number;
}

/**
 * Temperature Safety Bounds
 */
export interface TemperatureSafetyBounds {
  lower: number;
  upper: number;
}

/**
 * Fan Timer State
 */
export interface FanTimerState {
  fan_timer_timeout?: number;
  fan_control_state?: string;
  fan_timer_duration?: number;
  fan_current_speed?: string;
  fan_mode?: string;
}

/**
 * Structure Assignment Result
 */
export interface StructureAssignmentResult {
  assigned: boolean;
  structure_id?: string;
}

/**
 * Subscription Notification Result
 */
export interface NotificationResult {
  notified: number;
  removed: number;
}
