"use client";

import { motion } from "framer-motion";
import { ScheduleCircle } from "./schedule-circle";
import { getTimePosition, ScheduleEntry, celsiusToFahrenheit } from "@/lib/schedule-types";

interface ScheduleDayRowProps {
  dayLabel: string;
  entries: ScheduleEntry[];
  index: number;
  temperatureScale?: "F" | "C";
}

export function ScheduleDayRow({
  dayLabel,
  entries,
  index,
  temperatureScale = "F",
}: ScheduleDayRowProps) {
  return (
    <motion.div
      className="relative flex items-center border-b border-slate-200/60 dark:border-slate-700/40 last:border-b-0 min-h-[70px] md:min-h-[120px]"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 200 }}
    >
      <div className="w-28 sm:w-32 flex-shrink-0 pl-4 pr-4 py-2 md:py-4 sticky left-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-r-xl">
        <div className="text-sm sm:text-base font-medium text-zinc-700 dark:text-zinc-300">
          {dayLabel}
        </div>
      </div>

      <div className="flex-1 relative h-full py-3 md:py-6 pr-12 pl-12">
        <div className="relative h-full">
          <div className="absolute inset-0 pointer-events-none">
            {[0, 6, 12, 18, 24].map((hour) => {
              const position = (hour / 24) * 100;
              return (
                <div
                  key={hour}
                  className="absolute top-0 bottom-0 w-[1px] bg-slate-200/40 dark:bg-slate-700/30"
                  style={{ left: `${position}%` }}
                />
              );
            })}
          </div>

          <div className="absolute inset-0">
          {entries
            .filter((entry) => entry.entry_type === "setpoint")
            .map((entry, idx) => {
            const position = getTimePosition(entry.time);

            let yOffset = 0;
            const circleWidthPercent = 3;
            const offsetAmount = 25;

            let overlapCount = 0;
            for (let i = 0; i < idx; i++) {
              const prevEntry = entries.filter((e) => e.entry_type === "setpoint")[i];
              if (!prevEntry) continue;
              const prevPosition = getTimePosition(prevEntry.time);
              const distance = Math.abs(position - prevPosition);

              if (distance < circleWidthPercent) {
                overlapCount++;
              }
            }

            yOffset = overlapCount * offsetAmount;

            const displayTemp = temperatureScale === "F"
              ? celsiusToFahrenheit(entry.temp)
              : Math.round(entry.temp);

            const mode = entry.type === "HEAT" ? "heat" :
                        entry.type === "COOL" ? "cool" :
                        entry.type === "RANGE" ? "heat-cool" : "cool";

            return (
              <div
                key={`${idx}-${entry.time}`}
                className="absolute transition-all duration-300"
                style={{
                  left: `${position}%`,
                  top: `calc(50% + ${yOffset}px)`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <ScheduleCircle
                  heatTemp={displayTemp}
                  coolTemp={displayTemp}
                  mode={mode}
                  size={44}
                  temperatureScale={temperatureScale}
                />
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
