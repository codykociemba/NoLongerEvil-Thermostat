"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";
import { parseDeviceState } from "./store";
import type { DeviceData, UserState, RawDeviceState } from "./store";

/**
 * Type definitions for raw Convex state
 */
interface RawStateEntry {
  object_key: string;
  object_revision: number;
  object_timestamp: number;
  value: any;
  updatedAt: number;
}

interface ConvexDeviceStateResponse {
  devices: string[];
  deviceState: Record<string, RawDeviceState>;
}

/**
 * Hook to get all devices for the current user with real-time updates
 * Uses Convex reactive queries instead of HTTP polling
 */
export function useDeviceState() {
  const { userId } = useAuth();

  const data = useQuery(
    api.device.getUserDevicesState,
    userId ? { userId } : "skip"
  );

  const result = useMemo(() => {
    if (!data) {
      return {
        devices: [] as DeviceData[],
        userState: null as UserState | null,
        isLoading: true,
      };
    }

    // Parse devices using the existing parseDeviceState logic
    const parsedDevices = data.devices.map((serial) => {
      const state = data.deviceState?.[serial] ?? {};
      return parseDeviceState(serial, state);
    });

    return {
      devices: parsedDevices,
      userState: extractUserState(data),
      isLoading: false,
    };
  }, [data]);

  return result;
}

/**
 * Hook to get a single device's state with real-time updates
 */
export function useDeviceStateBySerial(serial: string | null) {
  const { userId } = useAuth();

  const data = useQuery(
    api.device.getUserDeviceState,
    userId && serial ? { userId, serial } : "skip"
  );

  const result = useMemo(() => {
    if (!data) {
      return {
        serial: serial || "",
        state: {} as RawDeviceState,
        hasWriteAccess: false,
        isLoading: true,
      };
    }

    return {
      ...data,
      isLoading: false,
    };
  }, [data, serial]);

  return result;
}

/**
 * Extract user state from device state response
 * User state is stored in user.{userId} key
 */
function extractUserState(data: ConvexDeviceStateResponse): UserState | null {
  if (!data.devices || data.devices.length === 0) {
    return null;
  }

  const firstSerial = data.devices[0];
  const deviceState = data.deviceState?.[firstSerial];

  if (!deviceState) {
    return null;
  }

  // Find user state key (user.{userId})
  const userStateKey = Object.keys(deviceState).find(key => key.startsWith('user.'));

  if (!userStateKey || !deviceState[userStateKey]?.value) {
    return null;
  }

  return deviceState[userStateKey].value as UserState;
}

/**
 * Hook that provides the raw Convex response format
 * Compatible with existing /api/status response shape
 */
export function useDeviceStateRaw() {
  const { userId } = useAuth();

  const data = useQuery(
    api.device.getUserDevicesState,
    userId ? { userId } : "skip"
  );

  return {
    data: data ? {
      devices: data.devices,
      deviceState: data.deviceState,
    } : null,
    isLoading: data === undefined,
  };
}
