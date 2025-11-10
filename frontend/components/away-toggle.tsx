"use client";

import { useThermostat } from "@/lib/store";
import { Plane } from "lucide-react";
import { motion } from "framer-motion";
import { haptic } from "@/lib/haptics";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
      delay: 0.3,
    },
  },
};

export function AwayToggle() {
  const activeDevice = useThermostat((s) => s.activeDevice());
  const setAway = useThermostat((s) => s.setAway);

  if (!activeDevice || !activeDevice.serial) {
    return null;
  }

  const isAway = Boolean(activeDevice.isAway);

  const handleToggle = async (value: boolean) => {
    if (value === isAway) return;
    haptic(value ? "warning" : "success");
    await setAway(value);
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      whileHover={{ y: -4, scale: 1.02 }}
      className="surface p-2 sm:p-4 text-center group cursor-pointer relative"
      onClick={() => handleToggle(!isAway)}
    >
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${
            isAway ? "from-amber-500/10 via-amber-500/5 to-transparent" : "from-emerald-500/10 via-emerald-500/5 to-transparent"
          } transition-all duration-500`}
        />
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none">
          <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
        </div>
      </div>

      <div className="relative z-10">
        <motion.div
          className={`inline-flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl ${
            isAway
              ? "bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-700/50 dark:to-amber-800/50"
              : "bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-700/50 dark:to-emerald-800/50"
          } mb-0.5 sm:mb-1.5 transition-all duration-300`}
          whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
          transition={{ duration: 0.5 }}
          style={{
            boxShadow: isAway
              ? "0 4px 12px rgba(251, 191, 36, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)"
              : "0 4px 12px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
          }}
        >
          <Plane className={`h-3 w-3 sm:h-4 sm:w-4 ${isAway ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-300"} transition-colors duration-300`} />
        </motion.div>

        <div className="text-[0.5rem] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-300 uppercase tracking-[0.1em] sm:tracking-[0.15em] mb-0.5 sm:mb-1.5">
          Away
        </div>

        <motion.div
          className={`text-xl sm:text-3xl font-bold transition-colors duration-300 ${
            isAway ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
          }`}
          key={`away-${isAway}`}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {isAway ? "ON" : "OFF"}
        </motion.div>
      </div>
    </motion.div>
  );
}
