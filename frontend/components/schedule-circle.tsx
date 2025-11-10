"use client";

import { motion } from "framer-motion";

interface ScheduleCircleProps {
  heatTemp: number;
  coolTemp: number;
  mode: "heat" | "cool" | "heat-cool";
  size?: number;
  temperatureScale?: "F" | "C";
}

export function ScheduleCircle({
  heatTemp,
  coolTemp,
  mode,
  size = 60,
  temperatureScale = "F",
}: ScheduleCircleProps) {
  const radius = size / 2;
  const center = radius;

  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      whileHover={{ scale: 1.1 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-md"
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="coolGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="heatGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {mode === "heat-cool" ? (
          <>
            {/* Cool (top half - blue) */}
            <path
              d={`
                M 0 ${center}
                A ${radius} ${radius} 0 0 1 ${size} ${center}
                L ${center} ${center}
                Z
              `}
              fill="url(#coolGradient)"
              className="transition-all duration-300"
            />

            {/* Heat (bottom half - orange) */}
            <path
              d={`
                M 0 ${center}
                A ${radius} ${radius} 0 0 0 ${size} ${center}
                L ${center} ${center}
                Z
              `}
              fill="url(#heatGradient)"
              className="transition-all duration-300"
            />
          </>
        ) : (
          <>
            {/* Solid circle for heat or cool mode */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill={mode === "cool" ? "url(#coolGradient)" : "url(#heatGradient)"}
              className="transition-all duration-300"
            />
          </>
        )}

        {/* Border circle */}
        <circle
          cx={center}
          cy={center}
          r={radius - 1}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="2"
        />
      </svg>

      {/* Temperature labels */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {mode === "heat-cool" ? (
          <>
            {/* Cool temp (top) */}
            <div
              className="font-bold text-white drop-shadow-md"
              style={{
                fontSize: `${Math.max(9, size * 0.2)}px`,
                marginTop: `-${size * 0.035}px`
              }}
            >
              {coolTemp}
            </div>

            {/* Divider line */}
            <div
              className="bg-white/50"
              style={{
                width: `${size * 0.6}px`,
                height: '1px',
                margin: `${size * 0.01}px 0`
              }}
            />

            {/* Heat temp (bottom) */}
            <div
              className="font-bold text-white drop-shadow-md"
              style={{
                fontSize: `${Math.max(9, size * 0.2)}px`,
                marginBottom: `-${size * 0.035}px`
              }}
            >
              {heatTemp}
            </div>
          </>
        ) : (
          <>
            {/* Single temperature for heat or cool mode */}
            <div
              className="font-bold text-white drop-shadow-md"
              style={{ fontSize: `${Math.max(12, size * 0.27)}px` }}
            >
              {mode === "cool" ? coolTemp : heatTemp}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
