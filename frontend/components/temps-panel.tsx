"use client";

import { useThermostat } from "@/lib/store";
import { Home, CloudSun, Droplets } from "lucide-react";
import { motion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
      delay,
    },
  }),
};

const metricCards = [
  {
    key: "inside",
    label: "Indoor",
    icon: Home,
    overlay: "from-orange-500/5 via-transparent to-transparent",
    colors: {
      light: "from-brand-100 to-brand-50",
      dark: "from-brand-700/50 to-brand-800/50",
      glow: "rgba(14, 165, 233, 0.15)",
      icon: "text-brand-600 dark:text-brand-300",
    },
  },
  {
    key: "outside",
    label: "Outdoor",
    icon: CloudSun,
    overlay: "from-amber-500/5 via-yellow-500/5 to-transparent",
    colors: {
      light: "from-amber-100 to-amber-50",
      dark: "from-amber-700/50 to-amber-800/50",
      glow: "rgba(251, 191, 36, 0.15)",
      icon: "text-amber-600 dark:text-amber-300",
    },
  },
  {
    key: "humidity",
    label: "Humidity",
    icon: Droplets,
    overlay: "from-cyan-500/5 via-blue-500/5 to-transparent",
    colors: {
      light: "from-cyan-200 to-cyan-100",
      dark: "from-cyan-700/50 to-cyan-800/50",
      glow: "rgba(6, 182, 212, 0.15)",
      icon: "text-cyan-600 dark:text-cyan-300",
    },
  },
];

function formatValue(value: number | null, suffix: string): { whole: string; decimal: string; suffix: string } | string {
  if (value === null || Number.isNaN(value)) return "--";

  if (suffix === "%") {
    return `${value}${suffix}`;
  }

  const whole = Math.floor(value);
  const decimal = value % 1;

  return {
    whole: whole.toString(),
    decimal: decimal > 0 ? (decimal * 10).toFixed(0) : "",
    suffix
  };
}

export function TempsPanel() {
  const activeDevice = useThermostat((s) => s.activeDevice());
  const tempSuffix = "";

  const values: Record<string, { whole: string; decimal: string; suffix: string } | string> = {
    inside: formatValue(
      activeDevice?.currentTemp ?? activeDevice?.insideTemp ?? null,
      tempSuffix
    ),
    outside: formatValue(activeDevice?.outsideTemp ?? null, tempSuffix),
    humidity: formatValue(activeDevice?.humidity ?? null, "%"),
  };

  return (
    <>
      {metricCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.key}
            custom={index * 0.1}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            whileHover={{ y: -4, scale: 1.02 }}
            className="surface p-2 sm:p-4 text-center group cursor-default relative"
          >
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              <div
                className={`absolute inset-0 bg-gradient-to-br ${card.overlay} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
              />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none">
                <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
              </div>
            </div>

            <div className="relative z-10">
              <motion.div
                className={`inline-flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br ${card.colors.light} dark:${card.colors.dark} mb-0.5 sm:mb-1.5`}
                whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                transition={{ duration: 0.5 }}
                style={{
                  boxShadow: `0 4px 12px ${card.colors.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
                }}
              >
                <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${card.colors.icon}`} />
              </motion.div>

              <div className="text-[0.5rem] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-300 uppercase tracking-[0.1em] sm:tracking-[0.15em] mb-0.5 sm:mb-1.5">
                {card.label}
              </div>

              <motion.div
                className="text-xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 relative inline-block"
                style={{
                  fontVariantNumeric: "tabular-nums",
                }}
                key={`${card.key}-${typeof values[card.key] === 'string' ? values[card.key] : (values[card.key] as any).whole}`}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {(() => {
                  const value = values[card.key];
                  if (typeof value === 'string') {
                    return value;
                  }
                  return (
                    <>
                      {value.whole}
                      {value.decimal && (
                        <span className="text-xs sm:text-sm font-semibold align-super ml-0.5">
                          {value.decimal}
                        </span>
                      )}
                      {value.suffix}
                    </>
                  );
                })()}
              </motion.div>
            </div>
          </motion.div>
        );
      })}
    </>
  );
}
