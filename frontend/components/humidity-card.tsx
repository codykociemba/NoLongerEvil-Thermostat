"use client";

import { useThermostat } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets } from "lucide-react";
import { motion } from "framer-motion";

export function HumidityCard() {
  const humidity = useThermostat((s) => s.activeDevice()?.humidity ?? 0);

  const getHumidityLevel = (h: number) => {
    if (h < 30) return { label: "Low", color: "text-orange-600 dark:text-orange-400" };
    if (h > 60) return { label: "High", color: "text-blue-600 dark:text-blue-400" };
    return { label: "Optimal", color: "text-green-600 dark:text-green-400" };
  };

  const level = getHumidityLevel(humidity);

  return (
    <Card className="border-2 shadow-xl hover:shadow-2xl transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">Humidity</CardTitle>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3 mb-2">
          <div className="text-5xl font-bold">{humidity}%</div>
          <div className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
            humidity < 30
              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
              : humidity > 60
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
          }`}>
            {level.label}
          </div>
        </div>

        {/* Visual humidity bar */}
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>0%</span>
            <span>100%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
              initial={{ width: 0 }}
              animate={{ width: `${humidity}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Info text */}
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {humidity < 30 && "Consider using a humidifier for better comfort."}
          {humidity >= 30 && humidity <= 60 && "Perfect humidity level for comfort."}
          {humidity > 60 && "High humidity may feel uncomfortable."}
        </p>
      </CardContent>
    </Card>
  );
}
