"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useThermostat } from "@/lib/store";
import { useSyncConvexToStore } from "@/lib/use-sync-convex-store";
import { ThermostatCard } from "@/components/thermostat-card";
import { LinkDeviceCard } from "@/components/link-device-card";
import { HomeStatus } from "@/components/home-status";
import { AnimatedWeather } from "@/components/animated-weather";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";

export default function DashboardPage() {
  return (
    <>
      <SignedIn>
        <DashboardContent />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn redirectUrl="/dashboard" />
      </SignedOut>
    </>
  );
}

function DashboardContent() {
  // Sync Convex real-time data into Zustand store (enables existing components to work)
  useSyncConvexToStore();

  // Now use the Zustand store as normal - it's automatically synced with Convex
  const devices = useThermostat((s) => s.devices);
  const setActiveDevice = useThermostat((s) => s.setActiveDevice);
  const isLoading = useThermostat((s) => s.isLoading);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasDevices = devices.length > 0;

  const gridDevices = useMemo(
    () =>
      devices.map((device, index) => (
        <Link key={device.serial} href={`/dashboard/${device.serial}`}>
          <ThermostatCard device={device} onClick={() => setActiveDevice(device.serial)} index={index} />
        </Link>
      )),
    [devices, setActiveDevice]
  );

  return (
    <div className="relative">
      <div className="mb-6 flex items-center justify-center flex-wrap gap-3 relative">
        <div className="flex-1 text-center">
          {hasDevices && <AnimatedWeather />}
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
            Your Home
          </h1>
          {hasDevices && (
            <div className="mt-3 flex justify-center">
              <HomeStatus />
            </div>
          )}
        </div>
        {hasDevices && (
          <div className="absolute right-0 top-0">
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Thermostat
            </Button>
          </div>
        )}
      </div>

      {hasDevices ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 justify-items-center">
          {gridDevices}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto mt-12">
          <div className="text-center mb-8">
            <p className="text-zinc-600 dark:text-zinc-400">
              Get started by linking your first thermostat
            </p>
          </div>
          <LinkDeviceCard
            onLinked={() => {
              // No need to manually fetch - Convex will update automatically
            }}
          />
        </div>
      )}

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {isModalOpen && (
                <motion.div
                  key="modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-slate-900/40 dark:bg-black/50 backdrop-blur-md z-50 flex items-center justify-center overflow-y-auto p-4"
                  onClick={() => setIsModalOpen(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-2xl relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="absolute -top-12 right-0 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 dark:bg-white/10 dark:hover:bg-white/20 text-white transition-colors duration-200 shadow-lg cursor-pointer"
                    >
                      <X className="h-6 w-6" />
                    </button>
                    <LinkDeviceCard
                      onLinked={() => {
                        setIsModalOpen(false);
                        // No need to manually fetch - Convex will update automatically
                      }}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}
