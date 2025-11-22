"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { useThermostat } from "@/lib/store";
import { useSyncConvexToStore } from "@/lib/use-sync-convex-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from "next/dynamic";
import { usePullToRefresh } from "@/lib/use-pull-to-refresh";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Settings } from "lucide-react";
import { TempsPanel } from "@/components/temps-panel";
import { StatusBar } from "@/components/status-bar";
import { LinkDeviceCard } from "@/components/link-device-card";
import { AwayToggle } from "@/components/away-toggle";

const ModePicker = dynamic(() => import("@/components/mode-picker").then((mod) => ({ default: mod.ModePicker })), {
  ssr: false,
});
const FanControl = dynamic(() => import("@/components/fan-control").then((mod) => ({ default: mod.FanControl })), {
  ssr: false,
});
const ThermostatDial = dynamic(() => import("@/components/thermostat-dial").then((mod) => ({ default: mod.ThermostatDial })), {
  ssr: false,
});

export default function DashboardSerialPage() {
  return (
    <>
      <SignedIn>
        <DashboardSerialContent />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn redirectUrl="/dashboard" />
      </SignedOut>
    </>
  );
}

function DashboardSerialContent() {
  const params = useParams<{ serial: string }>();
  const rawSerial = params?.serial;
  const serial =
    typeof rawSerial === "string"
      ? decodeURIComponent(rawSerial).trim()
      : Array.isArray(rawSerial)
      ? decodeURIComponent(rawSerial[0] ?? "").trim()
      : "";

  // Sync Convex real-time data into Zustand store
  useSyncConvexToStore();

  // Use Zustand store (automatically synced with Convex)
  const devices = useThermostat((s) => s.devices);
  const setActiveDevice = useThermostat((s) => s.setActiveDevice);
  const activeDevice = useThermostat((s) => s.activeDevice());
  const error = useThermostat((s) => s.error);
  const isLoading = useThermostat((s) => s.isLoading);

  const hasDevices = devices.length > 0;
  const deviceKnown = devices.some((device) => device.serial === serial);

  useEffect(() => {
    if (!serial) return;
    setActiveDevice(serial);
  }, [serial, setActiveDevice]);

  const { isPulling, isRefreshing, pullDistance, progress } = usePullToRefresh({
    threshold: 80,
    onRefresh: async () => {
      // Convex automatically refreshes, but we can force a refresh if needed
      // For now, just add a small delay to show the refresh animation
      await new Promise(resolve => setTimeout(resolve, 500));
    },
  });

  const header = useMemo(() => {
    if (!serial) return "Thermostat";
    const device = devices.find((d) => d.serial === serial);
    if (device?.name) return device.name;
    return `Thermostat ${serial.slice(-4)}`;
  }, [devices, serial]);

  if (!serial) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-zinc-600 dark:text-zinc-400">Missing thermostat serial.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  if (!hasDevices || !deviceKnown) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
            Link Thermostat
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">
            We don't have any data for this thermostat yet. Enter the entry key displayed on your device to link it.
          </p>
        </div>
        <div className="max-w-xl">
          <LinkDeviceCard onLinked={() => {
            // No need to manually fetch - Convex will update automatically
          }} />
        </div>
        <Button asChild variant="ghost">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 relative">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
            {header}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Serial: <span className="font-mono">{serial}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon">
            <Link href={`/dashboard/${serial}/settings`}>
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">All devices</Link>
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {(isPulling || isRefreshing) && (
          <motion.div
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-4 md:hidden"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            style={{
              transform: `translateY(${Math.min(pullDistance, 80)}px)`,
              pointerEvents: "none",
            }}
          >
            <motion.div
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-brand-200 dark:border-brand-800 shadow-lg"
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
            >
              <RefreshCw className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                {isRefreshing ? "Refreshing..." : progress >= 100 ? "Release to refresh" : "Pull to refresh"}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="pb-6 pt-6 px-6 md:px-8 overflow-visible">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            <TempsPanel />
          </div>
          <StatusBar />
        </CardHeader>

        <CardContent className="pt-2 pb-8 px-6 md:px-8">
          <div className="flex flex-col items-center mb-8">
            <ThermostatDial />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <ModePicker />
            <FanControl />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
