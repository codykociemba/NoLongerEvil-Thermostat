"use client";

import { motion } from "framer-motion";
import { ScheduleTimeline } from "@/components/schedule-timeline";
import { ScheduleDayRow } from "@/components/schedule-day-row";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useThermostat } from "@/lib/store";
import { thermostatAPI } from "@/lib/api";
import {
  ScheduleResponse,
  DAY_NAMES,
  parseScheduleEntries
} from "@/lib/schedule-types";
import { Calendar, Loader2, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SchedulePage() {
  return (
    <>
      <SignedIn>
        <ScheduleContent />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn redirectUrl="/schedule" />
      </SignedOut>
    </>
  );
}

function ScheduleContent() {
  const devices = useThermostat((s) => s.devices);
  const activeDevice = useThermostat((s) => s.activeDevice());
  const setActiveDevice = useThermostat((s) => s.setActiveDevice);
  const fetchStatus = useThermostat((s) => s.fetchStatus);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus(undefined).catch((error) => {
      console.error("[Schedule] Failed to fetch devices:", error);
    });
  }, [fetchStatus]);

  useEffect(() => {
    if (!activeDevice?.serial) {
      setIsLoading(false);
      return;
    }

    const fetchSchedule = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await thermostatAPI.getSchedule(activeDevice.serial);
        setSchedule(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load schedule");
        console.error("Failed to fetch schedule:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedule();
  }, [activeDevice?.serial]);

  const temperatureScale = activeDevice?.temperatureScale || "F";

  return (
    <>
      <motion.div
        className="mb-3 md:mb-6 flex items-center justify-between flex-wrap gap-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <div className="flex-1">
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
            Heat and cool schedule
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1 md:mt-2 text-xs md:text-sm">
            View your weekly temperature schedule
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {devices.length > 1 && (
            <Select
              value={activeDevice?.serial || ""}
              onValueChange={(serial) => setActiveDevice(serial)}
            >
              <SelectTrigger className="w-[200px] md:w-[250px]">
                <SelectValue placeholder="Select device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.serial} value={device.serial}>
                    {device.name || device.serial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </motion.div>

      {isLoading && (
        <motion.div
          className="surface flex flex-col items-center justify-center py-16 md:py-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2 className="h-12 w-12 text-zinc-400 dark:text-zinc-600 mb-4 animate-spin" />
          <p className="text-zinc-500 dark:text-zinc-400">Loading schedule...</p>
        </motion.div>
      )}

      {!isLoading && error && (
        <motion.div
          className="surface flex flex-col items-center justify-center py-16 md:py-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Calendar className="h-16 w-16 md:h-20 md:w-20 text-red-400 dark:text-red-600 mb-6" />
          <h2 className="text-xl md:text-2xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            Failed to Load Schedule
          </h2>
          <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 text-center max-w-md">
            {error}
          </p>
        </motion.div>
      )}

      {!isLoading && !error && !activeDevice && (
        <motion.div
          className="surface flex flex-col items-center justify-center py-16 md:py-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Calendar className="h-16 w-16 md:h-20 md:w-20 text-zinc-400 dark:text-zinc-600 mb-6" />
          <h2 className="text-xl md:text-2xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
            No Device Selected
          </h2>
          <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 text-center max-w-md mb-6">
            Please select a thermostat from the dashboard to view its schedule.
          </p>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </motion.div>
      )}

      {!isLoading && !error && schedule && (
        <>
          <motion.div
            className="surface overflow-x-auto [overflow-scrolling:touch] [-webkit-overflow-scrolling:touch] scroll-smooth relative -mx-2 md:-mx-4 scrollbar-hide"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          >
            <div className="min-w-[2000px] pr-4">
              <div className="pt-2 md:pt-4 pb-1 md:pb-2">
                <div className="flex">
                  <div className="w-28 sm:w-32 flex-shrink-0" />

                  <div className="flex-1 pr-12 pl-12">
                    <ScheduleTimeline />
                  </div>
                </div>
              </div>

              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {Object.entries(schedule.value.days).map(([dayNum, daySchedule], index) => {
                  const entries = parseScheduleEntries(daySchedule);
                  const dayName = DAY_NAMES[parseInt(dayNum)];

                  return (
                    <ScheduleDayRow
                      key={dayNum}
                      dayLabel={dayName}
                      entries={entries}
                      index={index}
                      temperatureScale={temperatureScale}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="mt-2 md:mt-6 text-center text-xs md:text-sm text-zinc-500 dark:text-zinc-400 space-y-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="md:hidden">Swipe horizontally to view full schedule</div>
            <div>Schedule editing coming soon</div>
          </motion.div>
        </>
      )}
    </>
  );
}
