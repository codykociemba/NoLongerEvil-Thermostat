export type ThermostatMode = "heat" | "cool" | "heat-cool" | "off";
export type FanMode = "auto" | "on" | "off";

export interface ThermostatCommand {
  serial: string;
  action: "temp" | "temperature" | "away" | "set";
  value: string | number | boolean | Record<string, any>;
  mode?: ThermostatMode;
  temperature_scale?: "C" | "F";
  field?: string;
  object?: string;
  low?: number;
  high?: number;
  target_temperature_low?: number;
  target_temperature_high?: number;
  target_change_pending?: boolean;
  touched_source?: string;
  touched_where?: string;
  touched_by_string?: string;
  touched_by_numeric?: {
    touched_when?: number;
    touched_tzo?: number;
  };
}

export interface DeviceState {
  devices: string[];
  deviceState: Record<
    string,
    Record<
      string,
      {
        object_revision: number;
        object_timestamp: number;
        value: any;
      }
    >
  >;
}

export interface CommandResponse {
  success: boolean;
  message: string;
  device?: string;
  object?: string;
  revision?: number;
  timestamp?: number | null;
  error?: string;
}

export interface ScheduleResponse {
  serial: string;
  object_key: string;
  object_revision: number;
  object_timestamp: number;
  value: any;
  updatedAt: number;
}

class ThermostatAPI {
  private readonly baseUrl = "/api/thermostat";

  private getTouchedByInfo() {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tzOffset = new Date().getTimezoneOffset() * -60;
    return {
      touched_source: "web",
      touched_where: "nolongerevil",
      touched_by_string: "nolongerevil-web",
      touched_by_numeric: {
        touched_when: nowSeconds,
        touched_tzo: tzOffset,
      },
    };
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      credentials: "include",
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const payload = await response.json();
        message = payload?.error || payload?.message || message;
      } catch {
      }
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  async getStatus(serial?: string): Promise<DeviceState> {
    const params = new URLSearchParams();
    if (typeof serial === "string" && serial.trim().length > 0) {
      params.set("serial", serial.trim());
    }
    const query = params.toString();
    return this.request<DeviceState>(
      `/status${query ? `?${query}` : ""}`,
      { method: "GET", cache: "no-store" }
    );
  }

  async sendCommand(command: ThermostatCommand): Promise<CommandResponse> {
    if (!command.serial) {
      throw new Error("Device serial is required");
    }

    return this.request<CommandResponse>("/command", {
      method: "POST",
      body: JSON.stringify(command),
    });
  }

  async setTemperature(
    temp: number,
    serial: string,
    mode: ThermostatMode,
    temperatureScale?: "C" | "F"
  ) {
    return this.sendCommand({
      serial,
      action: "temp",
      value: temp,
      mode,
      temperature_scale: temperatureScale,
      target_change_pending: true,
      ...this.getTouchedByInfo(),
    });
  }

  async setTemperatureRange(
    low: number,
    high: number,
    serial: string,
    mode: ThermostatMode = "heat-cool",
    temperatureScale?: "C" | "F"
  ) {
    return this.sendCommand({
      serial,
      action: "temp",
      value: high,
      low,
      high,
      target_temperature_low: low,
      target_temperature_high: high,
      mode,
      temperature_scale: temperatureScale,
      target_change_pending: true,
      ...this.getTouchedByInfo(),
    });
  }

  async setMode(mode: ThermostatMode, serial: string) {
    return this.sendCommand({
      serial,
      action: "set",
      field: "target_temperature_type",
      value: mode === "heat-cool" ? "range" : mode,
      object: `shared.${serial}`,
    });
  }

  async setFanMode(fanMode: FanMode, serial: string) {
    if (fanMode === "off") {
      return this.sendCommand({
        serial,
        action: "set",
        field: "fan_mode",
        value: {
          fan_control_state: false,
          fan_mode: "auto",
          fan_timer_timeout: 0,
          fan_timer_duration: 0,
        },
        object: `device.${serial}`,
      });
    } else {
      return this.sendCommand({
        serial,
        action: "set",
        field: "fan_mode",
        value: fanMode,
        object: `device.${serial}`,
      });
    }
  }

  async setFanTimer(duration: number, serial: string) {
    const timeout = Math.floor(Date.now() / 1000) + duration;

    await this.sendCommand({
      serial,
      action: "set",
      field: "hvac_fan_state",
      value: true,
      object: `shared.${serial}`,
    });

    return this.sendCommand({
      serial,
      action: "set",
      field: "fan_timer_duration",
      value: {
        fan_control_state: true,
        fan_mode: "auto",
        fan_timer_duration: duration,
        fan_current_speed: "stage1",
        fan_timer_timeout: timeout,
      },
      object: `device.${serial}`,
    });
  }

  async setAway(serial: string, away: boolean) {
    return this.sendCommand({
      serial,
      action: "away",
      value: away ? "true" : "false",
    });
  }

  async setEcoMode(serial: string, enabled: boolean) {
    const timestampSeconds = Math.floor(Date.now() / 1000);
    return this.sendCommand({
      serial,
      action: "set",
      field: "eco",
      value: {
        eco: {
          mode: enabled ? "manual-eco" : "schedule",
          mode_update_timestamp: timestampSeconds,
          touched_by: 1,
        },
        leaf: enabled,
      },
      object: `device.${serial}`,
    });
  }

  async setTemperatureScale(scale: "C" | "F", serial: string) {
    return this.sendCommand({
      serial,
      action: "set",
      field: "temperature_scale",
      value: scale,
      object: `device.${serial}`,
    });
  }

  async setDeviceName(name: string, serial: string) {
    return this.sendCommand({
      serial,
      action: "set",
      field: "name",
      value: name,
      object: `shared.${serial}`,
    });
  }

  async deleteDevice(serial: string): Promise<CommandResponse> {
    const response = await fetch(`${this.baseUrl}/device/${serial}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const payload = await response.json();
        message = payload?.error || payload?.message || message;
      } catch {
      }
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  async getSchedule(serial: string): Promise<ScheduleResponse> {
    if (!serial) {
      throw new Error("Device serial is required");
    }

    const params = new URLSearchParams();
    params.set("serial", serial);

    return this.request<ScheduleResponse>(`/schedule?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
  }
}

export const thermostatAPI = new ThermostatAPI();
