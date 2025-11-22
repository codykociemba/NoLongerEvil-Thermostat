"use client";

import { useEffect } from "react";
import { useDeviceState } from "./use-device-state";
import { useThermostat } from "./store";

/**
 * Hook that syncs Convex real-time device state into Zustand store
 * This allows existing components to continue using useThermostat() while
 * getting real-time updates from Convex subscriptions
 *
 */
export function useSyncConvexToStore() {
  const { devices, userState, isLoading } = useDeviceState();
  const setDevicesFromConvex = useThermostat((s) => s.setDevicesFromConvex);

  useEffect(() => {
    if (!isLoading && devices) {
      // Sync Convex devices into Zustand store
      setDevicesFromConvex(devices, userState);
    }
  }, [devices, userState, isLoading, setDevicesFromConvex]);
}
