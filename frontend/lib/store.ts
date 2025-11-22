"use client";

import { create } from "zustand";
import { thermostatAPI, ThermostatMode, FanMode } from "./api";
import { celsiusToFahrenheit, fahrenheitToCelsius } from "./utils/temperature";
import { resolveDeviceName } from "./utils/device-names";

export type Mode = ThermostatMode;
export type SystemStatus = "cooling" | "heating" | "fan" | "idle" | "unknown";

export interface DeviceData {
  serial: string;
  name?: string;
  temperatureScale: "C" | "F";
  mode: Mode;
  systemStatus: SystemStatus;
  setpoint: number | null;
  targetLow: number | null;
  targetHigh: number | null;
  insideTemp: number | null;
  currentTemp: number | null;
  outsideTemp: number | null;
  humidity: number | null;
  fanMode: FanMode;
  fanOn: boolean;
  fanTimerActive: boolean;
  fanTimerDuration: number | null;
  fanTimerTimeout: number | null;
  isAway: boolean;
  isEcoMode: boolean;
  showLeaf: boolean;
  lastUpdated?: number | null;
  isOwner?: boolean;
  sharedBy?: string;
  permissions?: string[];
  temperatureLock: boolean;
  temperatureLockLow: number | null;
  temperatureLockHigh: number | null;
  temperatureLockPinHash: string;
}

interface UserInteractionState {
  [serial: string]: {
    [field: string]: {
      lastTouchedAt: number;
      pendingValue: any;
    };
  };
}

export interface UserState {
  away?: boolean;
  away_timestamp?: number;
  away_setter?: number;
  vacation_mode?: boolean;
  manual_away_timestamp?: number;
  weather?: {
    current?: {
      condition?: string;
      temp_c?: number;
      temp_f?: number;
      humidity?: number;
      icon?: string;
    };
    location?: {
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
    updatedAt?: number;
  };
}

interface ThermostatState {
  devices: DeviceData[];
  userState: UserState | null;
  activeDeviceSerial: string | null;
  isLoading: boolean;
  error: string | null;
  pendingSetpointTimer: NodeJS.Timeout | null;
  userInteractionState: UserInteractionState;

  activeDevice: () => DeviceData | null;
  setActiveDevice: (serial: string) => void;
  clearError: () => void;
  setDevicesFromConvex: (devices: DeviceData[], userState: UserState | null) => void;
  setSetpoint: (value: number, immediate?: boolean) => Promise<void>;
  setTemperatureRange: (low: number, high: number, immediate?: boolean) => Promise<void>;
  nudge: (delta: number) => void;
  setMode: (mode: Mode) => Promise<void>;
  setFanMode: (mode: FanMode) => Promise<void>;
  setFanTimer: (duration: number) => Promise<void>;
  setAway: (away: boolean) => Promise<void>;
  setEcoMode: (enabled: boolean) => Promise<void>;
  setTemperatureScale: (scale: "C" | "F", serial: string) => Promise<void>;
  setDeviceName: (name: string, serial: string) => Promise<void>;
  setTemperatureLock: (
    serial: string,
    enabled: boolean,
    pin?: string,
    lowTemp?: number,
    highTemp?: number
  ) => Promise<void>;
  deleteDevice: (serial: string) => Promise<void>;
  fetchStatus: (serial?: string) => Promise<void>;
}

export type RawDeviceState = Record<
  string,
  {
    object_revision: number;
    object_timestamp: number;
    value: Record<string, any>;
  }
>;

const DISPLAY_RANGE: Record<"C" | "F", { min: number; max: number }> = {
  F: { min: 45, max: 95 },
  C: { min: 7, max: 35 },
};

const HEAT_COOL_DEFAULT_GAP: Record<"C" | "F", number> = {
  F: 5,
  C: 2,
};

const HEAT_COOL_MIN_GAP: Record<"C" | "F", number> = {
  F: 1,
  C: 0.5,
};

function toDisplayTemperature(value: number | null | undefined, scale: "C" | "F"): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const raw = scale === "F" ? celsiusToFahrenheit(value as number) : (value as number);
  return Math.round(raw * 10) / 10;
}

function toNestCelsius(value: number, scale: "C" | "F"): number {
  return scale === "F" ? fahrenheitToCelsius(value) : value;
}

function clampDisplay(value: number, scale: "C" | "F"): number {
  const { min, max } = DISPLAY_RANGE[scale];
  return Math.min(Math.max(value, min), max);
}

function normalizeScale(value: unknown): "C" | "F" {
  if (typeof value === "string") {
    const text = value.trim().toUpperCase();
    if (text === "F" || text === "FAHRENHEIT") return "F";
    if (text === "C" || text === "CELSIUS") return "C";
  } else if (typeof value === "number" && Number.isFinite(value)) {
    return value >= DISPLAY_RANGE.F.min ? "F" : "C";
  }
  return "C";
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function deriveMode(shared: Record<string, any>, device: Record<string, any>): Mode {
  const raw = String(
    shared?.target_temperature_type ??
    device?.current_schedule_mode ??
    ""
  ).toLowerCase();

  if (raw === "heat") return "heat";
  if (raw === "off") return "off";
  if (raw === "cool") return "cool";
  if (raw === "range" || raw === "heatcool" || raw === "heat-cool") return "heat-cool";
  return "cool";
}

function deriveSystemStatus(device: Record<string, any>, fanOn: boolean): SystemStatus {
  const cooling = Boolean(
    device?.hvac_ac_state ||
    device?.hvac_cool_x2_state ||
    device?.hvac_cool_x3_state
  );
  if (cooling) return "cooling";

  const heating = Boolean(
    device?.hvac_heater_state ||
    device?.hvac_heat_x2_state ||
    device?.hvac_heat_x3_state ||
    device?.hvac_aux_heater_state ||
    device?.hvac_alt_heat_state
  );
  if (heating) return "heating";

  if (fanOn) return "fan";
  return "idle";
}

function extractOutsideTemperature(
  state: RawDeviceState,
  shared: Record<string, any>,
  device: Record<string, any>
): number | null {
  const direct = firstNumber(
    shared?.outside_temperature,
    shared?.outdoor_temperature,
    shared?.ambient_temperature,
    device?.outside_temperature,
    device?.outdoor_temperature,
    device?.estimated_outdoor_temperature,
    device?.weather_current_temperature,
    device?.weather_temperature
  );
  if (direct !== null) return direct;

  for (const entry of Object.values(state)) {
    const nested = entry?.value;
    if (!nested || typeof nested !== "object") continue;
    const candidate = firstNumber(
      nested?.outside_temperature,
      nested?.outdoor_temperature,
      nested?.temperature,
      nested?.current?.temperature,
      nested?.now?.temperature,
      nested?.weather?.temperature,
      nested?.weather?.current?.temperature
    );
    if (candidate !== null) return candidate;
  }

  return null;
}

function sanitizeSerial(serial?: string): string | undefined {
  if (typeof serial !== "string") return undefined;
  const trimmed = serial.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Helper function to round temperature values based on scale
function roundTemp(value: number, scale: "C" | "F"): number {
  return scale === "C" ? Math.round(value * 2) / 2 : Math.round(value);
}

export function parseDeviceState(
  serial: string,
  state: RawDeviceState,
  previous?: DeviceData
): DeviceData {
  const sharedEntry = state[`shared.${serial}`] ?? { value: {} };
  const deviceEntry = state[`device.${serial}`] ?? { value: {} };
  const shared = sharedEntry.value ?? {};
  const device = deviceEntry.value ?? {};

  const scale = normalizeScale(device?.temperature_scale ?? shared?.temperature_scale ?? "C");

  const currentTempRaw = firstNumber(shared?.current_temperature, device?.current_temperature);
  const targetTempRaw = firstNumber(shared?.target_temperature);

  const insideTemp = toDisplayTemperature(currentTempRaw, scale);
  const currentTemp = insideTemp !== null ? Number(insideTemp.toFixed(1)) : null;

  const targetTemp = toDisplayTemperature(targetTempRaw, scale);
  const targetLow = toDisplayTemperature(firstNumber(shared?.target_temperature_low), scale);
  const targetHigh = toDisplayTemperature(firstNumber(shared?.target_temperature_high), scale);

  const humidity = firstNumber(device?.current_humidity, shared?.humidity);

  const fanTimerDuration = firstNumber(device?.fan_timer_duration);
  const fanTimerTimeout = firstNumber(device?.fan_timer_timeout);
  const fanTimerActive = fanTimerTimeout !== null && fanTimerTimeout > Math.floor(Date.now() / 1000);

  const fanCurrentSpeed = String(device?.fan_current_speed ?? "").toLowerCase();
  const hvacFanState = Boolean(device?.hvac_fan_state) || fanCurrentSpeed === "on";
  const fanModeRaw = String(device?.fan_mode ?? "").toLowerCase();

  let fanMode: FanMode;
  if (fanModeRaw === "on") {
    fanMode = "on";
  } else if (fanTimerActive) {
    fanMode = "on";
  } else if (hvacFanState) {
    fanMode = "auto";
  } else {
    fanMode = "off";
  }

  const fanOn = fanMode === "on" || hvacFanState;

  const outsideRaw = extractOutsideTemperature(state, shared, device);
  const outsideTemp = outsideRaw !== null
    ? toDisplayTemperature(outsideRaw, scale)
    : previous?.outsideTemp ?? null;

  const mode = deriveMode(shared, device);
  const systemStatus = deriveSystemStatus(device, fanOn);

  let resolvedSetpoint: number | null = null;
  const hasValidTargetTemp = targetTemp !== null && targetTemp !== 0 && (scale === "C" || targetTemp !== 32);

  if (hasValidTargetTemp) {
    resolvedSetpoint = roundTemp(targetTemp!, scale);
  } else if (mode === "heat-cool" && targetHigh !== null) {
    resolvedSetpoint = roundTemp(targetHigh, scale);
  } else if (mode === "cool" && targetHigh !== null) {
    resolvedSetpoint = roundTemp(targetHigh, scale);
  } else if (mode === "heat" && targetLow !== null) {
    resolvedSetpoint = roundTemp(targetLow, scale);
  } else if (insideTemp !== null) {
    resolvedSetpoint = roundTemp(insideTemp, scale);
  } else {
    resolvedSetpoint = previous?.setpoint ?? null;
  }

  // Device name resolution with fallback priority
  const customName = previous?.name; // User-set custom name from DB
  const sharedName = typeof shared?.name === "string" ? shared.name : null;
  const whereId = typeof device?.where_id === "string" ? device.where_id : null;
  const name = resolveDeviceName(customName, sharedName, whereId);

  const autoAwayValue = firstNumber(shared?.auto_away);
  const isAway = autoAwayValue !== null ? autoAwayValue > 0 : Boolean(shared?.away);

  const eco = device?.eco;
  const isEcoMode = eco && typeof eco === 'object' && eco.mode === 'manual-eco';
  const showLeaf = Boolean(eco && typeof eco === 'object' && eco.leaf);

  const lastUpdatedSeconds = firstNumber(sharedEntry?.object_timestamp, deviceEntry?.object_timestamp);
  const lastUpdated = lastUpdatedSeconds !== null
    ? Number(lastUpdatedSeconds) * 1000
    : previous?.lastUpdated ?? null;

  // Temperature lock
  const temperatureLock = Boolean(device?.temperature_lock);
  const temperatureLockLow = toDisplayTemperature(firstNumber(device?.temperature_lock_low_temp), scale);
  const temperatureLockHigh = toDisplayTemperature(firstNumber(device?.temperature_lock_high_temp), scale);
  const temperatureLockPinHash = typeof device?.temperature_lock_pin_hash === "string"
    ? device.temperature_lock_pin_hash
    : "";

  return {
    serial,
    name,
    temperatureScale: scale,
    mode,
    systemStatus,
    setpoint: resolvedSetpoint,
    targetLow: targetLow !== null ? roundTemp(targetLow, scale) : null,
    targetHigh: targetHigh !== null ? roundTemp(targetHigh, scale) : null,
    insideTemp: insideTemp !== null ? Number(insideTemp.toFixed(1)) : null,
    currentTemp,
    outsideTemp: outsideTemp !== null ? Number(outsideTemp.toFixed(1)) : null,
    humidity: humidity !== null ? Math.round(humidity) : null,
    fanMode,
    fanOn,
    fanTimerActive,
    fanTimerDuration,
    fanTimerTimeout,
    isAway,
    isEcoMode,
    showLeaf,
    lastUpdated,
    temperatureLock,
    temperatureLockLow: temperatureLockLow !== null ? roundTemp(temperatureLockLow, scale) : null,
    temperatureLockHigh: temperatureLockHigh !== null ? roundTemp(temperatureLockHigh, scale) : null,
    temperatureLockPinHash,
  };
}

const USER_INTERACTION_GRACE_PERIOD_MS = 3000;

function markFieldTouched(
  state: UserInteractionState,
  serial: string,
  field: string,
  value: any
): UserInteractionState {
  return {
    ...state,
    [serial]: {
      ...(state[serial] || {}),
      [field]: {
        lastTouchedAt: Date.now(),
        pendingValue: value,
      },
    },
  };
}

function shouldAcceptServerUpdate(
  state: UserInteractionState,
  serial: string,
  field: string
): boolean {
  const touched = state[serial]?.[field];
  if (!touched) return true;

  const staleness = Date.now() - touched.lastTouchedAt;
  return staleness >= USER_INTERACTION_GRACE_PERIOD_MS;
}

function clearFieldTouch(
  state: UserInteractionState,
  serial: string,
  field: string
): UserInteractionState {
  if (!state[serial]) return state;

  const { [field]: removed, ...rest } = state[serial];
  return {
    ...state,
    [serial]: rest,
  };
}

export const useThermostat = create<ThermostatState>((set, get) => ({
  devices: [],
  userState: null,
  activeDeviceSerial: null,
  isLoading: false,
  error: null,
  pendingSetpointTimer: null,
  userInteractionState: {},

  activeDevice: () => {
    const { devices, activeDeviceSerial } = get();
    if (!activeDeviceSerial) return devices[0] ?? null;
    return devices.find((device) => device.serial === activeDeviceSerial) ?? null;
  },

  setActiveDevice: (serial) => {
    const sanitized = sanitizeSerial(serial);
    if (!sanitized) return;
    if (get().devices.some((device) => device.serial === sanitized)) {
      set({ activeDeviceSerial: sanitized });
    }
  },

  clearError: () => set({ error: null }),

  /**
   * Sync devices from Convex real-time subscription into Zustand store
   * This enables existing components to work with real-time data
   */
  setDevicesFromConvex: (devices, userState) => {
    const currentActiveSerial = get().activeDeviceSerial;
    const hasPreferred = currentActiveSerial
      ? devices.some((device) => device.serial === currentActiveSerial)
      : false;

    set({
      devices,
      userState,
      activeDeviceSerial: hasPreferred
        ? currentActiveSerial
        : devices[0]?.serial ?? null,
    });
  },

  setSetpoint: async (value, immediate = false) => {
    const active = get().activeDevice();
    if (!active || !active.serial) return;

    const currentTimer = get().pendingSetpointTimer;
    if (currentTimer) {
      clearTimeout(currentTimer);
      set({ pendingSetpointTimer: null });
    }

    const devicesSnapshot = get().devices;

    const updatedDevices = devicesSnapshot.map((device) => {
      if (device.serial !== active.serial) return device;

      const scale = device.temperatureScale;
      const { min } = DISPLAY_RANGE[scale];
      const minGap = HEAT_COOL_MIN_GAP[scale];
      const defaultGap = HEAT_COOL_DEFAULT_GAP[scale];

      const roundedValue = roundTemp(value, scale);
      const newTarget = clampDisplay(roundedValue, scale);
      const next: DeviceData = { ...device, setpoint: newTarget };

      if (device.mode === "heat-cool") {
        const existingLow = Number.isFinite(device.targetLow) ? Number(device.targetLow) : null;
        let desiredLow = existingLow ?? (newTarget - defaultGap);
        desiredLow = Math.min(desiredLow, newTarget - minGap);
        desiredLow = Math.max(desiredLow, min);
        desiredLow = clampDisplay(desiredLow, scale);
        next.targetLow = desiredLow;
        next.targetHigh = newTarget;
      }

      return next;
    });

    let newInteractionState = get().userInteractionState;
    newInteractionState = markFieldTouched(newInteractionState, active.serial, "setpoint", value);
    if (active.mode === "heat-cool") {
      const updatedActive = updatedDevices.find((d) => d.serial === active.serial);
      newInteractionState = markFieldTouched(newInteractionState, active.serial, "targetLow", updatedActive?.targetLow);
      newInteractionState = markFieldTouched(newInteractionState, active.serial, "targetHigh", updatedActive?.targetHigh);
    }

    set({
      devices: updatedDevices,
      error: null,
      userInteractionState: newInteractionState,
    });

    // Define the API call function
    const sendUpdate = async () => {
      set({ isLoading: true, pendingSetpointTimer: null });
      try {
        if (active.mode === "heat-cool") {
          const updatedActive = updatedDevices.find((device) => device.serial === active.serial)!;
          const scale = updatedActive.temperatureScale;
          const defaultGap = HEAT_COOL_DEFAULT_GAP[scale];
          const minGap = HEAT_COOL_MIN_GAP[scale];
          const range = DISPLAY_RANGE[scale];
          const roundedValue = roundTemp(value, scale);
          const target = updatedActive.setpoint ?? clampDisplay(roundedValue, scale);

          let low = Number.isFinite(updatedActive.targetLow)
            ? Number(updatedActive.targetLow)
            : target - defaultGap;
          low = Math.min(low, target - minGap);
          low = Math.max(low, range.min);
          low = clampDisplay(low, scale);

          await thermostatAPI.setTemperatureRange(low, target, active.serial, active.mode, scale);
        } else {
          const scale = active.temperatureScale;
          const roundedValue = roundTemp(value, scale);
          const target = clampDisplay(roundedValue, scale);
          await thermostatAPI.setTemperature(target, active.serial, active.mode, scale);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to set temperature";
        set({ error: message, devices: devicesSnapshot });
        console.error("[Thermostat] Failed to set temperature:", error);
      } finally {
        set({ isLoading: false });
      }
    };

    // Debounce: wait 1 second before sending, unless immediate is true
    if (immediate) {
      await sendUpdate();
    } else {
      const timer = setTimeout(() => {
        sendUpdate();
      }, 1000);
      set({ pendingSetpointTimer: timer });
    }
  },

  setTemperatureRange: async (low, high, immediate = false) => {
    const active = get().activeDevice();
    if (!active || !active.serial) return;
    if (active.mode !== "heat-cool") {
      console.warn("[Thermostat] setTemperatureRange called but not in heat-cool mode");
      return;
    }

    const currentTimer = get().pendingSetpointTimer;
    if (currentTimer) {
      clearTimeout(currentTimer);
      set({ pendingSetpointTimer: null });
    }

    const devicesSnapshot = get().devices;
    const scale = active.temperatureScale;
    const minGap = HEAT_COOL_MIN_GAP[scale];

    const roundLow = roundTemp(low, scale);
    const roundHigh = roundTemp(high, scale);
    let clampedLow = clampDisplay(roundLow, scale);
    let clampedHigh = clampDisplay(roundHigh, scale);

    if (clampedHigh - clampedLow < minGap) {
      clampedHigh = clampDisplay(clampedLow + minGap, scale);
    }

    const updatedDevices = devicesSnapshot.map((device) => {
      if (device.serial !== active.serial) return device;
      return {
        ...device,
        targetLow: clampedLow,
        targetHigh: clampedHigh,
        setpoint: clampedHigh,
      };
    });

    let newInteractionState = get().userInteractionState;
    newInteractionState = markFieldTouched(newInteractionState, active.serial, "targetLow", clampedLow);
    newInteractionState = markFieldTouched(newInteractionState, active.serial, "targetHigh", clampedHigh);
    newInteractionState = markFieldTouched(newInteractionState, active.serial, "setpoint", clampedHigh);

    set({
      devices: updatedDevices,
      error: null,
      userInteractionState: newInteractionState,
    });

    // Define the API call function
    const sendUpdate = async () => {
      set({ isLoading: true, pendingSetpointTimer: null });
      try {
        await thermostatAPI.setTemperatureRange(
          clampedLow,
          clampedHigh,
          active.serial,
          "heat-cool",
          scale
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to set temperature range";
        set({ error: message, devices: devicesSnapshot });
        console.error("[Thermostat] Failed to set temperature range:", error);
      } finally {
        set({ isLoading: false });
      }
    };

    // Debounce: wait 1 second before sending, unless immediate is true
    if (immediate) {
      await sendUpdate();
    } else {
      const timer = setTimeout(() => {
        sendUpdate();
      }, 1000);
      set({ pendingSetpointTimer: timer });
    }
  },

  nudge: (delta) => {
    const active = get().activeDevice();
    if (!active || active.setpoint === null) return;
    const scale = active.temperatureScale;
    const increment = scale === "C" ? 0.5 : 1;
    const newSetpoint = clampDisplay(active.setpoint + (delta * increment), scale);
    get().setSetpoint(newSetpoint);
  },

  setMode: async (mode) => {
    const active = get().activeDevice();
    if (!active) return;

    set({
      devices: get().devices.map((device) =>
        device.serial === active.serial ? { ...device, mode } : device
      ),
      isLoading: true,
      error: null,
    });

    try {
      await thermostatAPI.setMode(mode, active.serial);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set mode";
      set({ error: message });
      console.error("[Thermostat] Failed to set mode:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  setFanMode: async (mode) => {
    const active = get().activeDevice();
    if (!active) return;

    const devicesSnapshot = get().devices;
    set({
      devices: devicesSnapshot.map((device) =>
        device.serial === active.serial
          ? {
              ...device,
              fanMode: mode,
              fanOn: mode === "on",
              fanTimerActive: false,
              fanTimerDuration: null,
              fanTimerTimeout: null
            }
          : device
      ),
      isLoading: true,
      error: null,
    });

    try {
      await thermostatAPI.setFanMode(mode, active.serial);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set fan mode";
      set({ error: message, devices: devicesSnapshot });
      console.error("[Thermostat] Failed to set fan mode:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  setFanTimer: async (duration) => {
    const active = get().activeDevice();
    if (!active) return;

    const devicesSnapshot = get().devices;
    const timeout = Math.floor(Date.now() / 1000) + duration;

    set({
      devices: devicesSnapshot.map((device) =>
        device.serial === active.serial
          ? {
              ...device,
              fanMode: "on",
              fanOn: true,
              fanTimerActive: true,
              fanTimerDuration: duration,
              fanTimerTimeout: timeout
            }
          : device
      ),
      isLoading: true,
      error: null,
    });

    try {
      await thermostatAPI.setFanTimer(duration, active.serial);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set fan timer";
      set({ error: message, devices: devicesSnapshot });
      console.error("[Thermostat] Failed to set fan timer:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  setAway: async (away) => {
    const active = get().activeDevice();
    if (!active) return;

    const devicesSnapshot = get().devices;

    set({
      devices: devicesSnapshot.map((device) =>
        device.serial === active.serial
          ? { ...device, isAway: away, systemStatus: away ? "idle" : device.systemStatus }
          : device
      ),
      isLoading: true,
      error: null,
    });

    try {
      await thermostatAPI.setAway(active.serial, away);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update away mode";
      set({ error: message, devices: devicesSnapshot, isLoading: false });
      console.error("[Thermostat] Failed to update away mode:", error);
    }
  },

  setEcoMode: async (enabled) => {
    const active = get().activeDevice();
    if (!active) return;

    const devicesSnapshot = get().devices;

    set({
      devices: devicesSnapshot.map((device) =>
        device.serial === active.serial
          ? { ...device, isEcoMode: enabled, showLeaf: enabled }
          : device
      ),
      isLoading: true,
      error: null,
    });

    try {
      await thermostatAPI.setEcoMode(active.serial, enabled);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update eco mode";
      set({ error: message, devices: devicesSnapshot, isLoading: false });
      console.error("[Thermostat] Failed to update eco mode:", error);
    }
  },

  setTemperatureScale: async (scale, serial) => {
    const devicesSnapshot = get().devices;
    const device = devicesSnapshot.find((d) => d.serial === serial);
    if (!device) return;

    // Convert all temperatures to the new scale
    const convertTemp = (temp: number | null, fromScale: "C" | "F", toScale: "C" | "F"): number | null => {
      if (temp === null) return null;
      if (fromScale === toScale) return temp;
      if (toScale === "F") return celsiusToFahrenheit(temp);
      return fahrenheitToCelsius(temp);
    };

    const oldScale = device.temperatureScale;

    set({
      devices: devicesSnapshot.map((d) =>
        d.serial === serial
          ? {
              ...d,
              temperatureScale: scale,
              setpoint: convertTemp(d.setpoint, oldScale, scale),
              targetLow: convertTemp(d.targetLow, oldScale, scale),
              targetHigh: convertTemp(d.targetHigh, oldScale, scale),
              insideTemp: convertTemp(d.insideTemp, oldScale, scale),
              currentTemp: convertTemp(d.currentTemp, oldScale, scale),
              outsideTemp: convertTemp(d.outsideTemp, oldScale, scale),
            }
          : d
      ),
      isLoading: true,
      error: null,
    });

    try {
      await thermostatAPI.setTemperatureScale(scale, serial);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update temperature scale";
      set({ error: message, devices: devicesSnapshot, isLoading: false });
      console.error("[Thermostat] Failed to update temperature scale:", error);
    }
  },

  setDeviceName: async (name, serial) => {
    const devicesSnapshot = get().devices;

    set({
      devices: devicesSnapshot.map((d) =>
        d.serial === serial ? { ...d, name } : d
      ),
      isLoading: true,
      error: null,
    });

    try {
      await thermostatAPI.setDeviceName(name, serial);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update device name";
      set({ error: message, devices: devicesSnapshot, isLoading: false });
      console.error("[Thermostat] Failed to update device name:", error);
    }
  },

  setTemperatureLock: async (serial, enabled, pin, lowTemp, highTemp) => {
    const devicesSnapshot = get().devices;
    const device = devicesSnapshot.find((d) => d.serial === serial);

    if (!device) {
      throw new Error("Device not found");
    }

    // Import hash function dynamically
    const { hashPin } = await import("./utils/hash");

    let pinHash: string | undefined;
    let lowTempCelsius: number | undefined;
    let highTempCelsius: number | undefined;

    if (enabled) {
      if (!pin || lowTemp === undefined || highTemp === undefined) {
        throw new Error("PIN and temperature range are required when enabling lock");
      }

      // Hash the PIN with serial number
      pinHash = await hashPin(pin, serial);

      // Convert temperatures to Celsius for the device
      lowTempCelsius = toNestCelsius(lowTemp, device.temperatureScale);
      highTempCelsius = toNestCelsius(highTemp, device.temperatureScale);

      // Optimistically update UI
      set({
        devices: devicesSnapshot.map((d) =>
          d.serial === serial
            ? {
                ...d,
                temperatureLock: true,
                temperatureLockLow: lowTemp,
                temperatureLockHigh: highTemp,
                temperatureLockPinHash: pinHash as string,
              }
            : d
        ),
        isLoading: true,
        error: null,
      });
    } else {
      // Optimistically update UI for unlock
      set({
        devices: devicesSnapshot.map((d) =>
          d.serial === serial
            ? {
                ...d,
                temperatureLock: false,
                temperatureLockPinHash: "",
              }
            : d
        ),
        isLoading: true,
        error: null,
      });
    }

    try {
      await thermostatAPI.setTemperatureLock(
        serial,
        enabled,
        pinHash,
        lowTempCelsius,
        highTempCelsius
      );
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update temperature lock";
      set({ error: message, devices: devicesSnapshot, isLoading: false });
      console.error("[Thermostat] Failed to update temperature lock:", error);
      throw error;
    }
  },

  deleteDevice: async (serial) => {
    const devicesSnapshot = get().devices;

    set({
      devices: devicesSnapshot.filter((d) => d.serial !== serial),
      activeDeviceSerial: get().activeDeviceSerial === serial ? null : get().activeDeviceSerial,
      isLoading: true,
      error: null,
    });

    try {
      await thermostatAPI.deleteDevice(serial);
      set({ isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete device";
      set({ error: message, devices: devicesSnapshot, isLoading: false });
      console.error("[Thermostat] Failed to delete device:", error);
    }
  },

  fetchStatus: async (serialArg) => {
    const normalizedSerial = sanitizeSerial(serialArg);
    set({ isLoading: true, error: null });
    try {
      const response = await thermostatAPI.getStatus(normalizedSerial);

      const existing = get().devices;
      const interactionState = get().userInteractionState;

      const parsed = (response.devices ?? []).map((deviceSerial) => {
        const previous = existing.find((device) => device.serial === deviceSerial);
        const state = response.deviceState?.[deviceSerial] ?? {};
        const serverDevice = parseDeviceState(deviceSerial, state, previous);

        if (!previous) {
          return serverDevice;
        }

        const merged: DeviceData = { ...serverDevice };

        if (!shouldAcceptServerUpdate(interactionState, deviceSerial, "setpoint")) {
          merged.setpoint = previous.setpoint;
        }

        if (!shouldAcceptServerUpdate(interactionState, deviceSerial, "targetLow")) {
          merged.targetLow = previous.targetLow;
        }

        if (!shouldAcceptServerUpdate(interactionState, deviceSerial, "targetHigh")) {
          merged.targetHigh = previous.targetHigh;
        }

        return merged;
      });

      const preferredSerial = normalizedSerial ?? get().activeDeviceSerial;
      const hasPreferred = preferredSerial
        ? parsed.some((device) => device.serial === preferredSerial)
        : false;

      // Extract user state from first device (all devices share the same user state)
      let userState: UserState | null = null;
      if (response.devices && response.devices.length > 0) {
        const firstSerial = response.devices[0];
        const deviceState = response.deviceState?.[firstSerial];
        if (deviceState) {
          // Find user state key (user.{userId})
          const userStateKey = Object.keys(deviceState).find(key => key.startsWith('user.'));
          if (userStateKey && deviceState[userStateKey]?.value) {
            userState = deviceState[userStateKey].value as UserState;
          }
        }
      }

      set({
        devices: parsed,
        userState,
        activeDeviceSerial: hasPreferred
          ? preferredSerial
          : parsed[0]?.serial ?? null,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch thermostat data";
      set({ error: message, isLoading: false });
      console.error("[Thermostat] Failed to fetch status:", error);
    }
  },
}));
