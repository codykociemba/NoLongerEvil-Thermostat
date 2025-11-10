"use client";

import { useThermostat } from "@/lib/store";
import { Plus, Minus, Leaf } from "lucide-react";
import { motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { haptic } from "@/lib/haptics";
import { celsiusToFahrenheit } from "@/lib/utils/temperature";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export function ThermostatDial() {
  const activeDevice = useThermostat((s) => s.activeDevice());

  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<'low' | 'high' | null>(null);
  const [startAngle, setStartAngle] = useState(0);
  const [startSetpoint, setStartSetpoint] = useState(0);
  const dialRef = useRef<SVGSVGElement>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
      }
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
      }
    };
  }, []);

  const scale = activeDevice?.temperatureScale ?? "F";
  const range = scale === "F"
    ? { min: 45, max: 95 }
    : { min: 7, max: 35 };
  const clampToRange = (value: number) => Math.max(range.min, Math.min(range.max, value));
  const midpoint = Math.round((range.min + range.max) / 2);
  const setpoint =
    typeof activeDevice?.setpoint === "number" && Number.isFinite(activeDevice.setpoint)
      ? clampToRange(activeDevice.setpoint)
      : clampToRange(midpoint);
  const nudge = useThermostat((s) => s.nudge);
  const setSetpoint = useThermostat((s) => s.setSetpoint);
  const setTemperatureRange = useThermostat((s) => s.setTemperatureRange);
  const serial = activeDevice?.serial;
  const isHeatCoolMode = activeDevice?.mode === "heat-cool";
  const targetLow = activeDevice?.targetLow ?? setpoint - 5;
  const targetHigh = activeDevice?.targetHigh ?? setpoint;
  const rangeSpan = Math.max(range.max - range.min, 1);
  const displaySetpointF =
    scale === "F" ? setpoint : celsiusToFahrenheit(setpoint);
  const degreeSuffix = "";
  const isEcoMode = activeDevice?.isEcoMode ?? false;
  const modeLabel = (() => {
    if (isEcoMode) return "ECO";
    switch (activeDevice?.mode) {
      case "heat":
        return "HEAT";
      case "cool":
        return "COOL";
      case "heat-cool":
        return "AUTO";
      case "off":
      default:
        return "OFF";
    }
  })();
  const fanOn = activeDevice?.fanOn ?? false;

  if (!activeDevice || !serial) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Select a thermostat to view controls.
      </div>
    );
  }

  const pct = (setpoint - range.min) / rangeSpan;
  const arc = 440 * pct;

  const pctLow = (targetLow - range.min) / rangeSpan;
  const pctHigh = (targetHigh - range.min) / rangeSpan;
  const arcLow = 440 * pctLow;
  const arcHigh = 440 * pctHigh;

  const angleLow = pctLow * 360;
  const angleHigh = pctHigh * 360;

  const getTemperatureColor = () => {
    const tempF = displaySetpointF;
    if (tempF <= 60) {
      const t = (tempF - 45) / 15;
      return {
        start: `rgb(${30 + t * 29}, ${100 + t * 30}, ${220 + t * 26})`,
        mid: `rgb(${6 + t * 50}, ${150 + t * 32}, ${212 + t * 0})`,
        end: `rgb(${20 + t * 17}, ${120 + t * 12}, ${200 + t * -6})`
      };
    } else if (tempF <= 70) {
      const t = (tempF - 60) / 10;
      return {
        start: `rgb(${59 + t * 91}, ${130 + t * 77}, ${246 - t * 62})`,
        mid: `rgb(${56 + t * 82}, ${182 - t * 0}, ${212 - t * 45})`,
        end: `rgb(${37 + t * 69}, ${160 + t * 22}, ${194 - t * 61})`
      };
    } else if (tempF <= 80) {
      const t = (tempF - 70) / 10;
      return {
        start: `rgb(${150 + t * 99}, ${207 + t * 8}, ${184 - t * 95})`,
        mid: `rgb(${138 + t * 99}, ${183 + t * 14}, ${167 - t * 76})`,
        end: `rgb(${106 + t * 88}, ${155 + t * 30}, ${133 - t * 66})`
      };
    } else {
      const t = (tempF - 80) / 15;
      return {
        start: `rgb(${249}, ${115 + t * (-47)}, ${22 + t * 46})`,
        mid: `rgb(${239 + t * 0}, ${100 + t * (-32)}, ${68 + t * 0})`,
        end: `rgb(${220 + t * 19}, ${90 + t * (-25)}, ${60 + t * 8})`
      };
    }
  };

  const tempColors = getTemperatureColor();

  const getAngleFromPointer = (clientX: number, clientY: number): number | null => {
    if (!dialRef.current) return null;

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);

    angle = (angle + 360) % 360;

    return angle;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const angle = getAngleFromPointer(e.clientX, e.clientY);
    if (angle === null) return;

    setIsDragging(true);
    setStartAngle(angle);

    if (isHeatCoolMode) {
      const normalizedAngle = angle % 360;
      const normalizedLow = (angleLow) % 360;
      const normalizedHigh = (angleHigh) % 360;

      const distToLow = Math.min(
        Math.abs(normalizedAngle - normalizedLow),
        360 - Math.abs(normalizedAngle - normalizedLow)
      );
      const distToHigh = Math.min(
        Math.abs(normalizedAngle - normalizedHigh),
        360 - Math.abs(normalizedAngle - normalizedHigh)
      );

      if (distToLow < distToHigh && distToLow < 30) {
        setDragTarget('low');
        setStartSetpoint(targetLow);
      } else if (distToHigh < 30) {
        setDragTarget('high');
        setStartSetpoint(targetHigh);
      } else {
        setDragTarget('high');
        setStartSetpoint(targetHigh);
      }
    } else {
      setDragTarget(null);
      setStartSetpoint(setpoint);
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const currentAngle = getAngleFromPointer(e.clientX, e.clientY);
    if (currentAngle === null) return;

    let delta = currentAngle - startAngle;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const tempDelta = (delta / 360) * rangeSpan;
    const newTemp = startSetpoint + tempDelta;
    const clampedTemp = clampToRange(Math.round(newTemp));

    if (isHeatCoolMode && dragTarget) {
      const minGap = scale === "F" ? 1 : 0.5;

      if (dragTarget === 'low') {
        const maxLow = targetHigh - minGap;
        const adjustedLow = Math.min(clampedTemp, maxLow);

        if (adjustedLow !== targetLow) {
          haptic("light");
          setTemperatureRange(adjustedLow, targetHigh);
        }
      } else if (dragTarget === 'high') {
        const minHigh = targetLow + minGap;
        const adjustedHigh = Math.max(clampedTemp, minHigh);

        if (adjustedHigh !== targetHigh) {
          haptic("light");
          setTemperatureRange(targetLow, adjustedHigh);
        }
      }
    } else {
      if (clampedTemp !== setpoint) {
        haptic("light");
      }
      setSetpoint(clampedTemp);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setDragTarget(null);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const nudgeLow = (delta: number) => {
    const minGap = scale === "F" ? 1 : 0.5;
    const increment = scale === "C" ? 0.5 : 1;
    const maxLow = targetHigh - minGap;
    const newLow = clampToRange(Math.min(targetLow + (delta * increment), maxLow));
    setTemperatureRange(newLow, targetHigh);
  };

  const nudgeHigh = (delta: number) => {
    const minGap = scale === "F" ? 1 : 0.5;
    const increment = scale === "C" ? 0.5 : 1;
    const minHigh = targetLow + minGap;
    const newHigh = clampToRange(Math.max(targetHigh + (delta * increment), minHigh));
    setTemperatureRange(targetLow, newHigh);
  };

  const startHolding = (direction: number, target?: 'low' | 'high') => {
    if (isHeatCoolMode && target) {
      if (target === 'low') {
        nudgeLow(direction);
      } else {
        nudgeHigh(direction);
      }
    } else {
      nudge(direction);
    }

    holdIntervalRef.current = setInterval(() => {
      if (isHeatCoolMode && target) {
        if (target === 'low') {
          nudgeLow(direction);
        } else {
          nudgeHigh(direction);
        }
      } else {
        nudge(direction);
      }
    }, 200);

    holdTimeoutRef.current = setTimeout(() => {
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
      }
      holdIntervalRef.current = setInterval(() => {
        if (isHeatCoolMode && target) {
          if (target === 'low') {
            nudgeLow(direction);
          } else {
            nudgeHigh(direction);
          }
        } else {
          nudge(direction);
        }
      }, 100);
    }, 1000);
  };

  const stopHolding = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  };

  return (
    <div className="relative grid place-items-center py-6 px-4 sm:py-8 sm:px-8 overflow-visible">
      {/* Multi-layer atmospheric glow */}
      <div className="absolute inset-0 flex items-center justify-center overflow-visible pointer-events-none">
        <motion.div
          className="absolute h-[280px] w-[280px] sm:h-80 sm:w-80 rounded-full"
          style={{
            filter: "blur(40px)"
          }}
          animate={{
            backgroundColor: tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.15)'),
            scale: [1, 1.15, 1.05, 1.12, 1],
            opacity: [0.4, 0.7, 0.5, 0.65, 0.4]
          }}
          transition={{
            backgroundColor: { duration: 0.5 },
            duration: 4.5,
            repeat: Infinity,
            ease: [0.45, 0, 0.55, 1]
          }}
        />
        <motion.div
          className="absolute h-56 w-56 sm:h-64 sm:w-64 rounded-full"
          style={{
            filter: "blur(30px)"
          }}
          animate={{
            backgroundColor: tempColors.start.replace('rgb', 'rgba').replace(')', ', 0.2)'),
            scale: [1.1, 1, 1.08, 1.02, 1.1],
            opacity: [0.3, 0.6, 0.4, 0.55, 0.3]
          }}
          transition={{
            backgroundColor: { duration: 0.5 },
            duration: 3.8,
            repeat: Infinity,
            ease: [0.4, 0, 0.2, 1],
            delay: 0.7
          }}
        />
      </div>

      {/* Main dial container with glass effect */}
      <motion.div
        className="relative h-[280px] w-[280px] sm:h-80 sm:w-80 overflow-visible"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: isDragging ? 1.02 : 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
      >
        {/* Control handle glows (outside SVG to prevent clipping) */}
        {isHeatCoolMode && (
          <>
            {/* Blue low temp glow - combined layers */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: '45px',
                height: '45px',
                left: `calc(50% + ${70 * Math.cos(angleLow * Math.PI / 180) * 1.75}px - 22.5px)`,
                top: `calc(50% + ${70 * Math.sin(angleLow * Math.PI / 180) * 1.75}px - 22.5px)`,
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, rgba(59, 130, 246, 0.35) 40%, rgba(59, 130, 246, 0.15) 70%, transparent 100%)',
                filter: 'blur(10px)',
              }}
            />

            {/* Orange high temp glow - combined layers */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: '45px',
                height: '45px',
                left: `calc(50% + ${70 * Math.cos(angleHigh * Math.PI / 180) * 1.75}px - 22.5px)`,
                top: `calc(50% + ${70 * Math.sin(angleHigh * Math.PI / 180) * 1.75}px - 22.5px)`,
                background: 'radial-gradient(circle, rgba(249, 115, 22, 0.6) 0%, rgba(249, 115, 22, 0.35) 40%, rgba(249, 115, 22, 0.15) 70%, transparent 100%)',
                filter: 'blur(10px)',
              }}
            />
          </>
        )}
        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            filter: "blur(20px)"
          }}
          animate={{
            background: `radial-gradient(circle, ${tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.1)')} 0%, transparent 70%)`,
            opacity: isDragging ? [1.5, 1.8, 1.5] : [0.6, 1, 0.7, 0.9, 0.6],
            scale: isDragging ? [1.1, 1.15, 1.1] : [1, 1.05, 1.02, 1.04, 1]
          }}
          transition={{
            background: { duration: 0.5 },
            opacity: isDragging
              ? { duration: 1, repeat: Infinity, ease: "easeInOut" }
              : { duration: 4, repeat: Infinity, ease: [0.45, 0, 0.55, 1] },
            scale: isDragging
              ? { duration: 1, repeat: Infinity, ease: "easeInOut" }
              : { duration: 4.5, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }
          }}
        />

        <svg
          ref={dialRef}
          viewBox="0 0 160 160"
          className="h-full w-full overflow-visible relative z-10 select-none"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Outer decorative ring */}
          <circle
            cx="80"
            cy="80"
            r="74"
            className="fill-none stroke-zinc-200/30 dark:stroke-zinc-700/30"
            strokeWidth="0.5"
          />

          {/* Background track with gradient */}
          <defs>
            <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(200, 200, 200, 0.3)" />
              <stop offset="100%" stopColor="rgba(150, 150, 150, 0.2)" />
            </linearGradient>
            <motion.linearGradient
              id="progressGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
              gradientTransform="rotate(0 0.5 0.5)"
              animate={{
                gradientTransform: [
                  "rotate(0 0.5 0.5)",
                  "rotate(360 0.5 0.5)"
                ]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <stop offset="0%" stopColor={tempColors.start} />
              <stop offset="50%" stopColor={tempColors.mid} />
              <stop offset="100%" stopColor={tempColors.end} />
            </motion.linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Inner background circle with glass effect */}
          <circle
            cx="80"
            cy="80"
            r="70"
            className="fill-white/40 dark:fill-zinc-900/40"
            style={{ filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08))" }}
          />

          {/* Background ring */}
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="url(#trackGradient)"
            strokeWidth="18"
            strokeLinecap="round"
          />

          {/* Base progress ring - solid foundation */}
          <motion.circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="url(#progressGradient)"
            strokeLinecap="round"
            initial={false}
            animate={{
              strokeDasharray: isHeatCoolMode ? `${arcHigh - arcLow} ${440}` : "440",
              strokeDashoffset: isHeatCoolMode ? -arcLow : 440 - arc,
            }}
            transition={{
              strokeDasharray: {
                type: "spring",
                stiffness: 120,
                damping: 20
              },
              strokeDashoffset: {
                type: "spring",
                stiffness: 120,
                damping: 20
              }
            }}
            strokeWidth="16"
            opacity="0.5"
          />

          {/* Animated wave segments - create organic traveling effect */}
          {/* Wave 1 - Primary wave */}
          <motion.circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="url(#progressGradient)"
            strokeLinecap="round"
            initial={false}
            animate={{
              strokeDasharray: isHeatCoolMode ? `${arcHigh - arcLow} ${440}` : "440",
              strokeDashoffset: isHeatCoolMode ? -arcLow : 440 - arc,
              strokeWidth: [18, 21, 17, 20, 18],
              opacity: [0.7, 1, 0.6, 0.9, 0.7],
              filter: `drop-shadow(0 0 8px ${tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.6)')})`
            }}
            transition={{
              strokeDasharray: {
                type: "spring",
                stiffness: 120,
                damping: 20
              },
              strokeDashoffset: {
                type: "spring",
                stiffness: 120,
                damping: 20
              },
              strokeWidth: {
                duration: 18,
                repeat: Infinity,
                ease: [0.45, 0.05, 0.55, 0.95],
                times: [0, 0.25, 0.5, 0.75, 1]
              },
              opacity: {
                duration: 18,
                repeat: Infinity,
                ease: [0.4, 0, 0.6, 1],
                times: [0, 0.25, 0.5, 0.75, 1]
              },
              filter: {
                duration: 0.5
              }
            }}
          />

          {/* Wave 2 - Secondary offset wave */}
          <motion.circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="url(#progressGradient)"
            strokeLinecap="round"
            initial={false}
            animate={{
              strokeDasharray: isHeatCoolMode ? `${arcHigh - arcLow} ${440}` : "440",
              strokeDashoffset: isHeatCoolMode ? -arcLow : 440 - arc,
              strokeWidth: [16, 19, 15, 18, 16],
              opacity: [0.5, 0.8, 0.4, 0.7, 0.5],
              filter: `drop-shadow(0 0 12px ${tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.5)')})`
            }}
            transition={{
              strokeDasharray: {
                type: "spring",
                stiffness: 120,
                damping: 20
              },
              strokeDashoffset: {
                type: "spring",
                stiffness: 120,
                damping: 20
              },
              strokeWidth: {
                duration: 22,
                repeat: Infinity,
                ease: [0.35, 0.1, 0.65, 0.9],
                times: [0, 0.3, 0.55, 0.8, 1],
                delay: 4
              },
              opacity: {
                duration: 22,
                repeat: Infinity,
                ease: [0.5, 0, 0.5, 1],
                times: [0, 0.3, 0.55, 0.8, 1],
                delay: 4
              },
              filter: {
                duration: 0.5
              }
            }}
          />

          {/* Wave 3 - Tertiary shimmer wave */}
          <motion.circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="url(#progressGradient)"
            strokeLinecap="round"
            initial={false}
            animate={{
              strokeDasharray: isHeatCoolMode ? `${arcHigh - arcLow} ${440}` : "440",
              strokeDashoffset: isHeatCoolMode ? -arcLow : 440 - arc,
              strokeWidth: [17, 20, 16, 19, 17],
              opacity: [0.6, 0.95, 0.5, 0.85, 0.6],
              filter: `drop-shadow(0 0 16px ${tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.7)')})`
            }}
            transition={{
              strokeDasharray: {
                type: "spring",
                stiffness: 120,
                damping: 20
              },
              strokeDashoffset: {
                type: "spring",
                stiffness: 120,
                damping: 20
              },
              strokeWidth: {
                duration: 15,
                repeat: Infinity,
                ease: [0.6, 0, 0.4, 1],
                times: [0, 0.2, 0.6, 0.85, 1],
                delay: 7
              },
              opacity: {
                duration: 15,
                repeat: Infinity,
                ease: [0.45, 0.05, 0.55, 0.95],
                times: [0, 0.2, 0.6, 0.85, 1],
                delay: 7
              },
              filter: {
                duration: 0.5
              }
            }}
          />

          {/* Inner highlight ring */}
          <circle
            cx="80"
            cy="80"
            r="62"
            className="fill-none stroke-white/20 dark:stroke-white/10"
            strokeWidth="1"
          />

          {/* Ultra-refined glass orb control points for heat-cool mode */}
          {isHeatCoolMode && (
            <>
              <defs>
                {/* Refined highlight gradients */}
                <radialGradient id="primaryGlassHighlight">
                  <stop offset="0%" stopColor="rgba(255, 255, 255, 0.5)" />
                  <stop offset="40%" stopColor="rgba(255, 255, 255, 0.25)" />
                  <stop offset="70%" stopColor="rgba(255, 255, 255, 0.05)" />
                  <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                </radialGradient>
                <radialGradient id="secondaryGlassHighlight">
                  <stop offset="0%" stopColor="rgba(255, 255, 255, 0.15)" />
                  <stop offset="60%" stopColor="rgba(255, 255, 255, 0.03)" />
                  <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                </radialGradient>
                <linearGradient id="rimCatchLight" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
                  <stop offset="30%" stopColor="rgba(255, 255, 255, 0.4)" />
                  <stop offset="70%" stopColor="rgba(255, 255, 255, 0.4)" />
                  <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                </linearGradient>

                {/* Filters for glass effect */}
                <filter id="outerGlow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Low temperature control point - Blue glass orb */}
              <motion.g
                initial={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                animate={dragTarget === 'low' && isDragging ?
                  { scale: [1.1, 1.15, 1.1] } :
                  { scale: 1 }
                }
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  scale: dragTarget === 'low' && isDragging ? {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : {}
                }}
                style={{
                  cursor: isDragging && dragTarget === 'low' ? 'grabbing' : 'grab',
                  transformOrigin: `${80 + 70 * Math.cos(angleLow * Math.PI / 180)}px ${80 + 70 * Math.sin(angleLow * Math.PI / 180)}px`
                }}
              >
                {/* Main glass orb body */}
                <circle
                  cx={80 + 70 * Math.cos(angleLow * Math.PI / 180)}
                  cy={80 + 70 * Math.sin(angleLow * Math.PI / 180)}
                  r="9"
                  className="fill-white/60 dark:fill-zinc-800/60"
                  stroke="rgba(59, 130, 246, 0.4)"
                  strokeWidth="1.5"
                  style={{
                    filter: "drop-shadow(0 2px 6px rgba(59, 130, 246, 0.3))"
                  }}
                />

                {/* Colored tint overlay */}
                <circle
                  cx={80 + 70 * Math.cos(angleLow * Math.PI / 180)}
                  cy={80 + 70 * Math.sin(angleLow * Math.PI / 180)}
                  r="9"
                  fill="rgba(59, 130, 246, 0.15)"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Primary glass highlight (main reflection) */}
                <ellipse
                  cx={80 + 70 * Math.cos(angleLow * Math.PI / 180) - 2.5}
                  cy={80 + 70 * Math.sin(angleLow * Math.PI / 180) - 2.5}
                  rx="4"
                  ry="5"
                  fill="url(#primaryGlassHighlight)"
                  transform={`rotate(-30 ${80 + 70 * Math.cos(angleLow * Math.PI / 180) - 2.5} ${80 + 70 * Math.sin(angleLow * Math.PI / 180) - 2.5})`}
                  style={{ pointerEvents: 'none' }}
                />

                {/* Secondary diffuse highlight */}
                <circle
                  cx={80 + 70 * Math.cos(angleLow * Math.PI / 180) + 2}
                  cy={80 + 70 * Math.sin(angleLow * Math.PI / 180) + 2.5}
                  r="2.5"
                  fill="url(#secondaryGlassHighlight)"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Ice Lottie Animation */}
                <foreignObject
                  x={80 + 70 * Math.cos(angleLow * Math.PI / 180) - 12}
                  y={80 + 70 * Math.sin(angleLow * Math.PI / 180) - 12}
                  width="24"
                  height="24"
                  style={{ pointerEvents: 'none', overflow: 'visible' }}
                >
                  <DotLottieReact
                    src="/ice.lottie"
                    loop
                    autoplay
                    speed={0.5}
                    style={{
                      width: '100%',
                      height: '100%',
                      opacity: 1.0
                    }}
                  />
                </foreignObject>
              </motion.g>

              {/* High temperature control point - Orange glass orb */}
              <motion.g
                initial={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                animate={dragTarget === 'high' && isDragging ?
                  { scale: [1.1, 1.15, 1.1] } :
                  { scale: 1 }
                }
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  scale: dragTarget === 'high' && isDragging ? {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : {}
                }}
                style={{
                  cursor: isDragging && dragTarget === 'high' ? 'grabbing' : 'grab',
                  transformOrigin: `${80 + 70 * Math.cos(angleHigh * Math.PI / 180)}px ${80 + 70 * Math.sin(angleHigh * Math.PI / 180)}px`
                }}
              >
                {/* Main glass orb body */}
                <circle
                  cx={80 + 70 * Math.cos(angleHigh * Math.PI / 180)}
                  cy={80 + 70 * Math.sin(angleHigh * Math.PI / 180)}
                  r="9"
                  className="fill-white/60 dark:fill-zinc-800/60"
                  stroke="rgba(249, 115, 22, 0.4)"
                  strokeWidth="1.5"
                  style={{
                    filter: "drop-shadow(0 2px 6px rgba(249, 115, 22, 0.3))"
                  }}
                />

                {/* Colored tint overlay */}
                <circle
                  cx={80 + 70 * Math.cos(angleHigh * Math.PI / 180)}
                  cy={80 + 70 * Math.sin(angleHigh * Math.PI / 180)}
                  r="9"
                  fill="rgba(249, 115, 22, 0.15)"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Primary glass highlight (main reflection) */}
                <ellipse
                  cx={80 + 70 * Math.cos(angleHigh * Math.PI / 180) - 2.5}
                  cy={80 + 70 * Math.sin(angleHigh * Math.PI / 180) - 2.5}
                  rx="4"
                  ry="5"
                  fill="url(#primaryGlassHighlight)"
                  transform={`rotate(-30 ${80 + 70 * Math.cos(angleHigh * Math.PI / 180) - 2.5} ${80 + 70 * Math.sin(angleHigh * Math.PI / 180) - 2.5})`}
                  style={{ pointerEvents: 'none' }}
                />

                {/* Secondary diffuse highlight */}
                <circle
                  cx={80 + 70 * Math.cos(angleHigh * Math.PI / 180) + 2}
                  cy={80 + 70 * Math.sin(angleHigh * Math.PI / 180) + 2.5}
                  r="2.5"
                  fill="url(#secondaryGlassHighlight)"
                  style={{ pointerEvents: 'none' }}
                />

                {/* Magma Lottie Animation */}
                <foreignObject
                  x={80 + 70 * Math.cos(angleHigh * Math.PI / 180) - 12}
                  y={80 + 70 * Math.sin(angleHigh * Math.PI / 180) - 12}
                  width="24"
                  height="24"
                  style={{ pointerEvents: 'none', overflow: 'visible' }}
                >
                  <DotLottieReact
                    src="/magma.lottie"
                    loop
                    autoplay
                    speed={0.5}
                    style={{
                      width: '100%',
                      height: '100%',
                      opacity: 1.0
                    }}
                  />
                </foreignObject>
              </motion.g>
            </>
          )}

          {/* Temperature display with gradient */}
          <defs>
            <linearGradient id="textGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" className="stop-zinc-900 dark:stop-zinc-100" />
              <stop offset="100%" className="stop-zinc-700 dark:stop-zinc-300" />
            </linearGradient>
          </defs>

          {isHeatCoolMode ? (
            <>
              {/* High temperature (top) */}
              <motion.g
                key={`high-${targetHigh}`}
                initial={{ scale: 1.15, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <text
                  x="50%"
                  y="33%"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  className="fill-current text-2xl font-bold"
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))"
                  }}
                >
                  {Math.floor(targetHigh)}
                  {targetHigh % 1 !== 0 && (
                    <tspan
                      dy="-0.6em"
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 'bold'
                      }}
                    >
                      5
                    </tspan>
                  )}
                  <tspan dy={targetHigh % 1 !== 0 ? "0.6em" : "0"}>
                    {degreeSuffix}
                  </tspan>
                </text>
              </motion.g>

              {/* Separator line */}
              <line
                x1="35%"
                y1="41.5%"
                x2="65%"
                y2="41.5%"
                className="stroke-zinc-300 dark:stroke-zinc-600"
                strokeWidth="1.5"
                opacity="0.5"
              />

              {/* Low temperature (bottom) */}
              <motion.g
                key={`low-${targetLow}`}
                initial={{ scale: 1.15, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <text
                  x="50%"
                  y="53%"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  className="fill-current text-2xl font-bold"
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))"
                  }}
                >
                  {Math.floor(targetLow)}
                  {targetLow % 1 !== 0 && (
                    <tspan
                      dy="-0.6em"
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 'bold'
                      }}
                    >
                      5
                    </tspan>
                  )}
                  <tspan dy={targetLow % 1 !== 0 ? "0.6em" : "0"}>
                    {degreeSuffix}
                  </tspan>
                </text>
              </motion.g>
            </>
          ) : (
            <motion.g
              key={setpoint}
              initial={{ scale: 1.15, opacity: 0.7 }}
              animate={{
                scale: 0.9 + ((setpoint - range.min) / rangeSpan) * 0.2,
                opacity: 1
              }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <text
                x="50%"
                y="46%"
                dominantBaseline="middle"
                textAnchor="middle"
                className="fill-current font-bold"
                style={{
                  fontSize: '2.5rem',
                  fontVariantNumeric: "tabular-nums",
                  filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))"
                }}
              >
                {Math.floor(setpoint)}
                {setpoint % 1 !== 0 && (
                  <tspan
                    dy="-0.8em"
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 'bold'
                    }}
                  >
                    5
                  </tspan>
                )}
                <tspan dy={setpoint % 1 !== 0 ? "0.8em" : "0"}>
                  {degreeSuffix}
                </tspan>
              </text>
            </motion.g>
          )}

          {/* Mode label and eco/fan icon container - centered */}
          <g transform={`translate(${(fanOn || isEcoMode) ? 69.5 : 80}, 112)`}>
            <text
              x="0"
              y="0"
              dominantBaseline="middle"
              textAnchor="middle"
              className={`font-semibold tracking-[0.2em] ${isEcoMode ? 'fill-green-500 dark:fill-green-400' : 'fill-zinc-400 dark:fill-zinc-500'}`}
              style={{ fontSize: '0.65rem' }}
            >
              {modeLabel}
            </text>

            {isEcoMode && (
              <>
                {/* Leaf icon when eco mode is on - right side after mode label */}
                <foreignObject
                  x="18"
                  y="-8"
                  width="14"
                  height="14"
                  style={{ pointerEvents: 'none', overflow: 'visible' }}
                >
                  <Leaf
                    className="w-full h-full text-green-500 dark:text-green-400"
                    style={{
                      opacity: 0.85,
                      strokeWidth: 2.5
                    }}
                  />
                </foreignObject>
              </>
            )}

            {fanOn && !isEcoMode && (
              <>
                {/* Fan Lottie Animation when fan is on - right side after mode label */}
                <foreignObject
                  x="23"
                  y="-8"
                  width="14"
                  height="14"
                  style={{ pointerEvents: 'none', overflow: 'visible' }}
                >
                  <DotLottieReact
                    src="/fan.lottie"
                    loop
                    autoplay
                    speed={0.8}
                    style={{
                      width: '100%',
                      height: '100%',
                      opacity: 0.7,
                      filter: 'brightness(0) saturate(100%) invert(50%) sepia(7%) saturate(587%) hue-rotate(169deg) brightness(91%) contrast(87%)'
                    }}
                  />
                </foreignObject>
              </>
            )}
          </g>
        </svg>

        {/* Glass reflection overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: `linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%)`,
          }}
        />
      </motion.div>

      {/* Control buttons with glassmorphism */}
      {isHeatCoolMode ? (
        <motion.div
          className="mt-8 flex items-center justify-center gap-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
        >
          {/* Low temperature controls */}
          <div className="flex flex-col items-center gap-3">
            <div className="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">Low</div>
            <div className="flex items-center gap-3">
              <motion.button
                onPointerDown={() => startHolding(-1, 'low')}
                onPointerUp={stopHolding}
                onPointerLeave={stopHolding}
                aria-label="Decrease low temperature"
                className="relative h-12 w-12 rounded-full border border-white/30 dark:border-white/20 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-xl overflow-hidden group cursor-pointer"
                style={{
                  boxShadow: `
                    0 4px 16px rgba(59, 130, 246, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.5),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.1)
                  `
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Minus className="h-5 w-5 relative z-10 mx-auto text-zinc-700 dark:text-zinc-300" />
              </motion.button>

              <motion.button
                onPointerDown={() => startHolding(1, 'low')}
                onPointerUp={stopHolding}
                onPointerLeave={stopHolding}
                aria-label="Increase low temperature"
                className="relative h-12 w-12 rounded-full overflow-hidden group cursor-pointer border border-blue-400 dark:border-blue-500"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                  boxShadow: `
                    0 8px 24px rgba(59, 130, 246, 0.4),
                    0 4px 8px rgba(59, 130, 246, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.4),
                    inset 0 -2px 0 rgba(0, 0, 0, 0.2)
                  `
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="h-5 w-5 relative z-10 mx-auto text-white" />
              </motion.button>
            </div>
          </div>

          {/* High temperature controls */}
          <div className="flex flex-col items-center gap-3">
            <div className="text-xs font-semibold text-orange-500 dark:text-orange-400 uppercase tracking-wider">High</div>
            <div className="flex items-center gap-3">
              <motion.button
                onPointerDown={() => startHolding(-1, 'high')}
                onPointerUp={stopHolding}
                onPointerLeave={stopHolding}
                aria-label="Decrease high temperature"
                className="relative h-12 w-12 rounded-full border border-white/30 dark:border-white/20 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-xl overflow-hidden group cursor-pointer"
                style={{
                  boxShadow: `
                    0 4px 16px rgba(249, 115, 22, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.5),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.1)
                  `
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Minus className="h-5 w-5 relative z-10 mx-auto text-zinc-700 dark:text-zinc-300" />
              </motion.button>

              <motion.button
                onPointerDown={() => startHolding(1, 'high')}
                onPointerUp={stopHolding}
                onPointerLeave={stopHolding}
                aria-label="Increase high temperature"
                className="relative h-12 w-12 rounded-full overflow-hidden group cursor-pointer border border-orange-400 dark:border-orange-500"
                style={{
                  background: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
                  boxShadow: `
                    0 8px 24px rgba(249, 115, 22, 0.4),
                    0 4px 8px rgba(249, 115, 22, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.4),
                    inset 0 -2px 0 rgba(0, 0, 0, 0.2)
                  `
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="h-5 w-5 relative z-10 mx-auto text-white" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="mt-8 flex items-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
        >
          <motion.button
            onPointerDown={() => startHolding(-1)}
            onPointerUp={stopHolding}
            onPointerLeave={stopHolding}
            aria-label="Decrease temperature"
            className="relative h-16 w-16 rounded-full border border-white/30 dark:border-white/20 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-xl overflow-hidden group cursor-pointer"
            style={{
              boxShadow: `
                0 4px 16px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.5),
                inset 0 -1px 0 rgba(0, 0, 0, 0.1)
              `
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Minus className="h-7 w-7 relative z-10 mx-auto text-zinc-700 dark:text-zinc-300" />
          </motion.button>

          <motion.button
            onPointerDown={() => startHolding(1)}
            onPointerUp={stopHolding}
            onPointerLeave={stopHolding}
            aria-label="Increase temperature"
            className="relative h-16 w-16 rounded-full overflow-hidden group cursor-pointer"
            animate={{
              background: `linear-gradient(135deg, ${tempColors.start} 0%, ${tempColors.mid} 100%)`,
              borderColor: tempColors.end,
              boxShadow: `
                0 8px 24px ${tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.4)')},
                0 4px 8px ${tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.2)')},
                inset 0 1px 0 rgba(255, 255, 255, 0.4),
                inset 0 -2px 0 rgba(0, 0, 0, 0.2)
              `
            }}
            transition={{
              background: { duration: 0.5 },
              borderColor: { duration: 0.5 },
              boxShadow: { duration: 0.5 }
            }}
            style={{
              borderWidth: '1px',
              borderStyle: 'solid'
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <motion.div
              className="absolute inset-0 bg-white/20 rounded-full"
              initial={{ scale: 0, opacity: 0 }}
              whileTap={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.4 }}
            />
            <Plus className="h-7 w-7 relative z-10 mx-auto text-white" />
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
