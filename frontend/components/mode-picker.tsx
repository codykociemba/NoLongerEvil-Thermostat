"use client";

import { useThermostat, type Mode } from "@/lib/store";
import { Flame, Snowflake, Gauge, Power, Plane, Leaf } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "@/lib/haptics";

export function ModePicker() {
  const activeDevice = useThermostat((s) => s.activeDevice());
  const mode = activeDevice?.mode || "off";
  const setMode = useThermostat((s) => s.setMode);
  const setAway = useThermostat((s) => s.setAway);
  const setEcoMode = useThermostat((s) => s.setEcoMode);
  const serial = activeDevice?.serial;
  const isAway = Boolean(activeDevice?.isAway);
  const isEcoMode = Boolean(activeDevice?.isEcoMode);

  const isPowerOn = mode !== "off";

  if (!serial) {
    return (
      <div className="surface p-6 sm:p-8 text-sm text-zinc-500 dark:text-zinc-400">
        Link a thermostat to manage system mode.
      </div>
    );
  }

  const handlePowerToggle = () => {
    if (isPowerOn) {
      setMode("off");
      haptic("warning");
    } else {
      setMode("heat-cool");
      haptic("success");
    }
  };

  const modes: Array<{
    value: Exclude<Mode, "off">;
    label: string;
    icon: any;
    cssClass: string;
    glow: string;
    activeBg: string;
    activeBorder: string;
    activeShadow: string;
  }> = [
    {
      value: "heat-cool",
      label: "Auto",
      icon: Gauge,
      cssClass: "bg-gradient-to-br from-emerald-400 to-emerald-500",
      glow: "var(--color-mode-auto-glow)",
      activeBg: "bg-emerald-600 dark:bg-emerald-500",
      activeBorder: "border-emerald-500 dark:border-emerald-400",
      activeShadow: "shadow-emerald-500/40 dark:shadow-emerald-400/30",
    },
    {
      value: "cool",
      label: "Cool",
      icon: Snowflake,
      cssClass: "gradient-cool",
      glow: "var(--color-mode-cool-glow)",
      activeBg: "bg-blue-600 dark:bg-blue-500",
      activeBorder: "border-blue-500 dark:border-blue-400",
      activeShadow: "shadow-blue-500/40 dark:shadow-blue-400/30",
    },
    {
      value: "heat",
      label: "Heat",
      icon: Flame,
      cssClass: "gradient-heat",
      glow: "var(--color-mode-heat-glow)",
      activeBg: "bg-orange-600 dark:bg-orange-500",
      activeBorder: "border-orange-500 dark:border-orange-400",
      activeShadow: "shadow-orange-500/40 dark:shadow-orange-400/30",
    },
  ];

  const handleAwayToggle = async () => {
    const newValue = !isAway;
    haptic(newValue ? "success" : "warning");
    await setAway(newValue);
  };

  const handleEcoToggle = async () => {
    const newValue = !isEcoMode;
    haptic(newValue ? "success" : "warning");
    await setEcoMode(newValue);
  };

  return (
    <motion.div
      className="surface p-6 sm:p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
    >
      {/* Header with Power Icon */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.15em]">
          System Mode
        </div>
        <motion.button
          onClick={handlePowerToggle}
          className="relative cursor-pointer group"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Power
            className={`h-5 w-5 transition-all duration-300 ${
              isPowerOn
                ? "text-emerald-500 dark:text-emerald-400"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
            style={{
              filter: isPowerOn
                ? "drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))"
                : "none",
            }}
          />
        </motion.button>
      </div>
      {/* Row 1: Heat/Cool/Auto Buttons */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {modes.map((m, index) => {
          const Icon = m.icon;
          const isActive = mode === m.value;
          return (
            <motion.button
              key={m.value}
              onClick={() => {
                if (isPowerOn) {
                  setMode(m.value);
                  haptic("impact");
                }
              }}
              className={`relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl overflow-hidden group transition-all duration-300 ${
                isActive && isPowerOn
                  ? `${m.activeBg} shadow-xl ${m.activeShadow} border-2 ${m.activeBorder}`
                  : 'surface shadow-md border border-zinc-200 dark:border-zinc-700'
              } ${!isPowerOn ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              whileHover={isPowerOn ? { scale: 1.02, y: -2 } : {}}
              whileTap={isPowerOn ? { scale: 0.98 } : {}}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: isPowerOn ? 1 : 0.5, scale: 1 }}
              transition={{
                delay: 0.5 + index * 0.05,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
            >
              {/* Active state glow overlay */}
              <AnimatePresence>
                {isActive && isPowerOn && (
                  <motion.div
                    className={`absolute inset-0 ${m.cssClass} opacity-20`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.2 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </AnimatePresence>

              {/* Ripple effect on click */}
              <motion.div
                className="absolute inset-0 rounded-xl"
                style={{
                  background: `radial-gradient(circle, ${m.glow} 0%, transparent 70%)`
                }}
                initial={{ scale: 0, opacity: 0 }}
                whileTap={{ scale: 2, opacity: [0, 0.5, 0] }}
                transition={{ duration: 0.5 }}
              />

              {/* Icon */}
              <div className="relative z-10">
                <motion.div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    isActive && isPowerOn ? 'bg-white/20' : m.cssClass
                  } transition-all duration-300`}
                  style={{
                    boxShadow: isActive && isPowerOn
                      ? 'inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                      : isPowerOn
                      ? `0 4px 12px ${m.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -2px 0 rgba(0, 0, 0, 0.2)`
                      : 'inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  }}
                  animate={isActive && isPowerOn ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <Icon className="h-5 w-5 text-white transition-colors duration-300" />
                </motion.div>
              </div>

              <div
                className={`relative z-10 text-[0.5rem] sm:text-xs font-semibold uppercase tracking-[0.1em] sm:tracking-[0.15em] mt-1.5 sm:mt-2 transition-colors duration-300 ${
                  isActive && isPowerOn
                    ? "text-white"
                    : "text-zinc-500 dark:text-zinc-300"
                }`}
              >
                {m.label}
              </div>

              {/* Shimmer effect on hover */}
              {isPowerOn && (
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none">
                  <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Row 2: Eco Mode Toggle - Full Width */}
      {/* <motion.button
        onClick={() => {
          if (isPowerOn) {
            handleEcoToggle();
          }
        }}
        className={`w-full mt-3 relative flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 rounded-xl overflow-hidden group transition-all duration-300 ${
          isEcoMode
            ? 'bg-green-600 dark:bg-green-500 shadow-lg shadow-green-500/30 dark:shadow-green-400/20 border border-green-500 dark:border-green-400'
            : 'surface border border-zinc-200 dark:border-zinc-700'
        } ${!isPowerOn ? "cursor-not-allowed" : "cursor-pointer"}`}
        whileHover={isPowerOn ? { scale: 1.01, y: -1 } : {}}
        whileTap={isPowerOn ? { scale: 0.99 } : {}}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isPowerOn ? 1 : 0.5, y: 0 }}
        transition={{
          delay: 0.3,
          type: "spring",
          stiffness: 200,
          damping: 15
        }}
      >
        <AnimatePresence>
          {isEcoMode && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-green-400/20 via-green-500/10 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>

        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{
            background: `radial-gradient(circle, ${isEcoMode ? 'rgba(34, 197, 94, 0.4)' : 'rgba(100, 116, 139, 0.2)'} 0%, transparent 70%)`
          }}
          initial={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 2, opacity: [0, 0.5, 0] }}
          transition={{ duration: 0.5 }}
        />

        <div className="relative z-10 flex items-center gap-2 sm:gap-3">
          <motion.div
            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg ${
              isEcoMode
                ? 'bg-white/20'
                : 'bg-gradient-to-br from-green-100 to-green-50 dark:from-green-700/50 dark:to-green-800/50'
            } transition-all duration-300`}
            style={{
              boxShadow: isEcoMode
                ? 'inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                : '0 2px 8px rgba(34, 197, 94, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
            }}
          >
            <Leaf className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
              isEcoMode ? 'text-white' : 'text-green-600 dark:text-green-300'
            } transition-colors duration-300`} />
          </motion.div>

          <span
            className={`text-xs sm:text-sm font-semibold transition-colors duration-300 ${
              isEcoMode
                ? "text-white"
                : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            Eco Mode
          </span>
        </div>

        <motion.div
          key={`eco-state-${isEcoMode}`}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`relative z-10 text-sm sm:text-base font-bold ${
            isEcoMode
              ? "text-white"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {isEcoMode ? 'ON' : 'OFF'}
        </motion.div>

        {isPowerOn && (
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
          </div>
        )}
      </motion.button> */}

      {/* Row 3: Away Toggle - Full Width */}
      <motion.button
        onClick={() => {
          if (isPowerOn) {
            handleAwayToggle();
          }
        }}
        className={`w-full mt-3 relative flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 rounded-xl overflow-hidden group transition-all duration-300 ${
          isAway
            ? 'bg-amber-700 dark:bg-amber-600 shadow-lg shadow-amber-600/30 dark:shadow-amber-500/20 border border-amber-600 dark:border-amber-500'
            : 'surface border border-zinc-200 dark:border-zinc-700'
        } ${!isPowerOn ? "cursor-not-allowed" : "cursor-pointer"}`}
        whileHover={isPowerOn ? { scale: 1.01, y: -1 } : {}}
        whileTap={isPowerOn ? { scale: 0.99 } : {}}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: isPowerOn ? 1 : 0.5, y: 0 }}
        transition={{
          delay: 0.35,
          type: "spring",
          stiffness: 200,
          damping: 15
        }}
      >
        {/* Active state glow overlay */}
        <AnimatePresence>
          {isAway && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>

        {/* Ripple effect on click */}
        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{
            background: `radial-gradient(circle, ${isAway ? 'rgba(217, 119, 6, 0.4)' : 'rgba(100, 116, 139, 0.2)'} 0%, transparent 70%)`
          }}
          initial={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 2, opacity: [0, 0.5, 0] }}
          transition={{ duration: 0.5 }}
        />

        {/* Left side: Icon + Label */}
        <div className="relative z-10 flex items-center gap-2 sm:gap-3">
          <motion.div
            className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg ${
              isAway
                ? 'bg-white/20'
                : 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/50 dark:to-amber-800/50'
            } transition-all duration-300`}
            style={{
              boxShadow: isAway
                ? 'inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                : '0 2px 8px rgba(217, 119, 6, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
            }}
          >
            <Plane className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
              isAway ? 'text-white' : 'text-amber-800 dark:text-amber-300'
            } transition-colors duration-300`} />
          </motion.div>

          <span
            className={`text-xs sm:text-sm font-semibold transition-colors duration-300 ${
              isAway
                ? "text-white"
                : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            Away Mode
          </span>
        </div>

        {/* Right side: OFF/ON with spring animation */}
        <motion.div
          key={`away-state-${isAway}`}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`relative z-10 text-sm sm:text-base font-bold ${
            isAway
              ? "text-white"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {isAway ? 'ON' : 'OFF'}
        </motion.div>

        {/* Shimmer effect on hover */}
        {isPowerOn && (
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
          </div>
        )}
      </motion.button>
    </motion.div>
  );
}
