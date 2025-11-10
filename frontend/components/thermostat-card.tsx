"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Thermometer, Droplets, Wind, Settings, Flame, Snowflake, Gauge, Power } from "lucide-react";
import type { DeviceData } from "@/lib/store";
import { celsiusToFahrenheit } from "@/lib/utils/temperature";
import { ThermostatSettingsDialog } from "./thermostat-settings-dialog";

interface ThermostatCardProps {
  device: DeviceData;
  onClick?: () => void;
  index: number;
}

function formatTemp(value: number | null | undefined, scale: "C" | "F") {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Math.round(value)}\u00B0${scale}`;
}

function formatHumidity(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${value}%`;
}

export function ThermostatCard({ device, onClick, index }: ThermostatCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const tempValue = device.insideTemp ?? device.currentTemp ?? device.setpoint ?? null;

  const getTempGradient = () => {
    const fallback = device.temperatureScale === "F" ? 72 : 22;
    const displayTemp = Number.isFinite(tempValue as number) ? (tempValue as number) : fallback;
    const tempF = device.temperatureScale === "F" ? displayTemp : celsiusToFahrenheit(displayTemp);

    if (tempF <= 60) {
      return {
        from: "from-blue-500",
        to: "to-cyan-400",
        glow: "rgba(59, 130, 246, 0.3)",
      };
    } else if (tempF <= 70) {
      return {
        from: "from-cyan-400",
        to: "to-emerald-400",
        glow: "rgba(6, 182, 212, 0.3)",
      };
    } else if (tempF <= 75) {
      return {
        from: "from-emerald-400",
        to: "to-yellow-400",
        glow: "rgba(16, 185, 129, 0.3)",
      };
    } else if (tempF <= 80) {
      return {
        from: "from-yellow-400",
        to: "to-orange-400",
        glow: "rgba(251, 191, 36, 0.3)",
      };
    } else {
      return {
        from: "from-orange-500",
        to: "to-red-500",
        glow: "rgba(249, 115, 22, 0.3)",
      };
    }
  };

  const gradient = getTempGradient();

  const getModeDisplay = () => {
    switch (device.systemStatus) {
      case "heating":
        return {
          label: "Heating",
          icon: Flame,
          color: "text-orange-600 dark:text-orange-400",
          bg: "bg-orange-100 dark:bg-orange-950/30",
          border: "border-orange-200 dark:border-orange-900/50"
        };
      case "cooling":
        return {
          label: "Cooling",
          icon: Snowflake,
          color: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-100 dark:bg-blue-950/30",
          border: "border-blue-200 dark:border-blue-900/50"
        };
      case "fan":
        return {
          label: "Fan",
          icon: Wind,
          color: "text-brand-600 dark:text-sky-400/90",
          bg: "bg-brand-100 dark:bg-sky-950/30",
          border: "border-brand-200 dark:border-sky-900/40"
        };
      case "idle":
        if (device.mode === "heat") {
          return {
            label: "Heat (idle)",
            icon: Flame,
            color: "text-orange-500/70 dark:text-orange-400/70",
            bg: "bg-orange-50 dark:bg-orange-950/20",
            border: "border-orange-100 dark:border-orange-900/30"
          };
        } else if (device.mode === "cool") {
          return {
            label: "Cool (idle)",
            icon: Snowflake,
            color: "text-blue-500/70 dark:text-blue-400/70",
            bg: "bg-blue-50 dark:bg-blue-950/20",
            border: "border-blue-100 dark:border-blue-900/30"
          };
        } else if (device.mode === "heat-cool") {
          return {
            label: "Auto (idle)",
            icon: Gauge,
            color: "text-emerald-500/70 dark:text-emerald-400/70",
            bg: "bg-emerald-50 dark:bg-emerald-950/20",
            border: "border-emerald-100 dark:border-emerald-900/30"
          };
        } else {
          return {
            label: "Off",
            icon: Power,
            color: "text-zinc-500 dark:text-zinc-400",
            bg: "bg-zinc-100 dark:bg-zinc-900/30",
            border: "border-zinc-200 dark:border-zinc-800/50"
          };
        }
      default:
        return {
          label: "Off",
          icon: Power,
          color: "text-zinc-500 dark:text-zinc-400",
          bg: "bg-zinc-100 dark:bg-zinc-900/30",
          border: "border-zinc-200 dark:border-zinc-800/50"
        };
    }
  };

  const modeDisplay = getModeDisplay();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="surface p-6 cursor-pointer relative overflow-hidden group h-full min-h-[320px] min-w-[250px]"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${gradient.glow}, transparent 70%)`,
        }}
      />

      <div className="relative z-10 h-full flex flex-col">
        <div className="mb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {device.name || "Thermostat"}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
                {device.serial}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSettingsOpen(true);
              }}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center my-6">
          <motion.div
            className={`text-6xl font-bold bg-gradient-to-br ${gradient.from} ${gradient.to} bg-clip-text text-transparent`}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {formatTemp(tempValue, device.temperatureScale)}
          </motion.div>
          <div className={`flex items-center gap-1.5 text-xs font-semibold mt-3 px-3 py-1.5 rounded-full border ${modeDisplay.color} ${modeDisplay.bg} ${modeDisplay.border} backdrop-blur-sm`}>
            <modeDisplay.icon className="h-3.5 w-3.5" />
            {modeDisplay.label}
          </div>
        </div>

        <div className="mt-auto">
          <div className={`h-[2px] w-full mb-4 bg-gradient-to-r ${gradient.from} ${gradient.to} rounded-full opacity-50`} />
          <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center">
            <Thermometer className="h-4 w-4 text-zinc-400 mb-1" />
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {device.mode === "heat-cool" && device.targetLow !== null && device.targetHigh !== null
                ? `${formatTemp(device.targetLow, device.temperatureScale)} - ${formatTemp(device.targetHigh, device.temperatureScale)}`
                : formatTemp(device.setpoint, device.temperatureScale)}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Target</div>
          </div>

          <div className="flex flex-col items-center">
            <Droplets className="h-4 w-4 text-zinc-400 mb-1" />
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {formatHumidity(device.humidity)}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Humidity</div>
          </div>

          <div className="flex flex-col items-center">
            <Wind className={`h-4 w-4 mb-1 ${device.fanOn ? "text-brand-500" : "text-zinc-400"}`} />
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {device.fanOn ? "On" : "Off"}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Fan</div>
          </div>
          </div>
        </div>

        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 to-brand-600"
          initial={{ scaleX: 0 }}
          whileHover={{ scaleX: 1 }}
          transition={{ duration: 0.3 }}
          style={{ originX: 0 }}
        />
      </div>

      <ThermostatSettingsDialog
        device={device}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </motion.div>
  );
}
