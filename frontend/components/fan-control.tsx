"use client";

import { useThermostat } from "@/lib/store";
import { Power } from "lucide-react";
import { motion } from "framer-motion";
import { haptic } from "@/lib/haptics";
import { FanMode } from "@/lib/api";

const TIMER_OPTIONS = [
  { duration: 900, label: "15 min" },
  { duration: 1800, label: "30 min" },
  { duration: 2700, label: "45 min" },
  { duration: 3600, label: "1 hr" },
  { duration: 7200, label: "2 hr" },
  { duration: 14400, label: "4 hr" },
  { duration: 28800, label: "8 hr" },
  { duration: 43200, label: "12 hr" },
];

export function FanControl() {
  const activeDevice = useThermostat((s) => s.activeDevice());
  const setFanMode = useThermostat((s) => s.setFanMode);
  const setFanTimer = useThermostat((s) => s.setFanTimer);

  if (!activeDevice || !activeDevice.serial) {
    return (
      <div className="surface p-6 sm:p-8 text-sm text-zinc-500 dark:text-zinc-400">
        Link a thermostat to control the fan.
      </div>
    );
  }

  const activeMode = activeDevice.fanMode ?? "auto";
  const timerActive = activeDevice.fanTimerActive ?? false;
  const timerDuration = activeDevice.fanTimerDuration ?? null;

  const handleTimerSelect = async (duration: number) => {
    haptic("impact");
    await setFanTimer(duration);
  };

  const handleOff = async () => {
    haptic("impact");
    await setFanMode("off");
  };

  return (
    <motion.div
      className="surface p-6 sm:p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, type: "spring", stiffness: 100 }}
    >
      {/* Header with Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.15em]">
          Fan Timer
        </div>
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {timerActive
            ? `Running (${
                timerDuration === 900 ? "15m" :
                timerDuration === 1800 ? "30m" :
                timerDuration === 2700 ? "45m" :
                timerDuration === 3600 ? "1h" :
                timerDuration === 7200 ? "2h" :
                timerDuration === 14400 ? "4h" :
                timerDuration === 28800 ? "8h" :
                timerDuration === 43200 ? "12h" :
                "custom"
              })`
            : activeMode === "off"
            ? "Off"
            : "Ready"}
        </div>
      </div>

      {/* Timer Buttons Grid with Off as first option */}
      <div className="grid grid-cols-3 gap-3 auto-rows-fr">
        {/* Off Button */}
        <motion.button
          onClick={handleOff}
          className={`relative flex flex-col items-center justify-center py-4 rounded-xl overflow-hidden group cursor-pointer transition-all duration-300 ${
            activeMode === "off"
              ? "bg-zinc-600 dark:bg-zinc-500 shadow-xl shadow-zinc-500/40 dark:shadow-zinc-400/30 border-2 border-zinc-500 dark:border-zinc-400"
              : "surface shadow-md border border-zinc-200 dark:border-zinc-700"
          }`}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 0.55,
            type: "spring",
            stiffness: 200,
            damping: 15
          }}
        >
          <Power className={`h-5 w-5 mb-1 relative z-10 ${
            activeMode === "off"
              ? "text-white"
              : "text-zinc-600 dark:text-zinc-400"
          }`} />
          <div className={`text-xs font-semibold relative z-10 ${
            activeMode === "off"
              ? "text-white"
              : "text-zinc-700 dark:text-zinc-300"
          }`}>
            Off
          </div>

          {/* Shimmer effect on hover */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
          </div>
        </motion.button>

        {/* Timer Duration Buttons */}
        {TIMER_OPTIONS.map((option, index) => (
          <motion.button
            key={option.duration}
            onClick={() => handleTimerSelect(option.duration)}
            className={`relative flex items-center justify-center py-4 rounded-xl overflow-hidden group cursor-pointer transition-all duration-300 ${
              timerActive && timerDuration === option.duration
                ? "bg-brand-600 dark:bg-brand-500 shadow-xl shadow-brand-500/40 dark:shadow-brand-400/30 border-2 border-brand-500 dark:border-brand-400"
                : "surface shadow-md border border-zinc-200 dark:border-zinc-700"
            }`}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.6 + index * 0.05,
              type: "spring",
              stiffness: 200,
              damping: 15
            }}
          >
            <div className={`text-xs font-semibold relative z-10 ${
              timerActive && timerDuration === option.duration
                ? "text-white"
                : "text-zinc-700 dark:text-zinc-300"
            }`}>
              {option.label}
            </div>

            {/* Shimmer effect on hover */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none">
              <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
