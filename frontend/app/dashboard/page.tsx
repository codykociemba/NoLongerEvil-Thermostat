"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useThermostat } from "@/lib/store";
import { ThermostatCard } from "@/components/thermostat-card";
import { LinkDeviceCard } from "@/components/link-device-card";
import { AddDeviceCard } from "@/components/add-device-card";
import { Grid3x3, Plus, X } from "lucide-react";
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
  const devices = useThermostat((s) => s.devices);
  const fetchStatus = useThermostat((s) => s.fetchStatus);
  const setActiveDevice = useThermostat((s) => s.setActiveDevice);
  const isLoading = useThermostat((s) => s.isLoading);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasDevices = devices.length > 0;

  useEffect(() => {
    fetchStatus(undefined).catch((error) => {
      console.error("[Dashboard] initial fetch failed:", error);
    });

    const interval = setInterval(() => {
      fetchStatus(undefined).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchStatus]);

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
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
            Your Thermostats
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2">
            {hasDevices
              ? `Manage ${devices.length} thermostat${devices.length !== 1 ? "s" : ""}`
              : "No devices linked yet. Add a thermostat to get started."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>

      {!hasDevices ? (
        <div className="grid gap-6">
          <div className="surface p-12 text-center">
            <Grid3x3 className="h-12 w-12 mx-auto text-zinc-400 mb-4" />
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              No Devices Connected
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mb-6">
              Use the entry key displayed on your No Longer Evil Thermostat to link it to your account.
              Keys expire after 60 minutes to keep things secure.
            </p>
            <Button
              onClick={() => setIsModalOpen(true)}
              size="lg"
              className="gap-2"
            >
              <Plus className="h-5 w-5" />
              Link Your Thermostat
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gridDevices}
          <AddDeviceCard onLinked={() => fetchStatus(undefined)} />
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
                        fetchStatus(undefined);
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
