"use client";

import { Home, Calendar, Settings, Info } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { Route } from "next";
import { useThermostat } from "@/lib/store";
import { useAuth } from "@clerk/nextjs";

const navItems: Array<{ href: Route; label: string; icon: any }> = [
  { href: "/dashboard" as Route, label: "Home", icon: Home },
  { href: "/schedule" as Route, label: "Schedule", icon: Calendar },
  { href: "/about" as Route, label: "About", icon: Info },
  { href: "/settings" as Route, label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const setpoint = useThermostat((s) => s.activeDevice()?.setpoint ?? 72);
  const { isSignedIn } = useAuth();

  const protectedRoutes = ["/dashboard", "/schedule", "/settings"];
  const visibleNavItems = navItems.filter(item => {
    if (!isSignedIn && protectedRoutes.includes(item.href)) {
      return false;
    }
    return true;
  });

  const showNav = visibleNavItems.some(item => pathname === item.href || pathname.startsWith(item.href));
  if (!showNav) {
    return null;
  }

  const getTemperatureColor = () => {
    if (setpoint <= 60) {
      const t = (setpoint - 45) / 15;
      return {
        start: `rgb(${30 + t * 29}, ${100 + t * 30}, ${220 + t * 26})`,
        mid: `rgb(${6 + t * 50}, ${150 + t * 32}, ${212 + t * 0})`,
        end: `rgb(${20 + t * 17}, ${120 + t * 12}, ${200 + t * -6})`
      };
    } else if (setpoint <= 70) {
      const t = (setpoint - 60) / 10;
      return {
        start: `rgb(${59 + t * 91}, ${130 + t * 77}, ${246 - t * 62})`,
        mid: `rgb(${56 + t * 82}, ${182 - t * 0}, ${212 - t * 45})`,
        end: `rgb(${37 + t * 69}, ${160 + t * 22}, ${194 - t * 61})`
      };
    } else if (setpoint <= 80) {
      const t = (setpoint - 70) / 10;
      return {
        start: `rgb(${150 + t * 99}, ${207 + t * 8}, ${184 - t * 95})`,
        mid: `rgb(${138 + t * 99}, ${183 + t * 14}, ${167 - t * 76})`,
        end: `rgb(${106 + t * 88}, ${155 + t * 30}, ${133 - t * 66})`
      };
    } else {
      const t = (setpoint - 80) / 15;
      return {
        start: `rgb(${249}, ${115 + t * (-47)}, ${22 + t * 46})`,
        mid: `rgb(${239 + t * 0}, ${100 + t * (-32)}, ${68 + t * 0})`,
        end: `rgb(${220 + t * 19}, ${90 + t * (-25)}, ${60 + t * 8})`
      };
    }
  };

  const tempColors = getTemperatureColor();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none px-4 pb-4">
      <div className="relative pointer-events-auto">
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-32 h-32 pointer-events-none">
          <motion.div
            className="w-full h-full rounded-full blur-3xl"
            style={{
              background: `${tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.2)')}`
            }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div
          className="relative bg-white/60 dark:bg-zinc-800/60 backdrop-blur-xl border border-white/30 dark:border-white/20 rounded-3xl overflow-hidden"
          style={{
            boxShadow: `
              0 4px 16px rgba(0, 0, 0, 0.1),
              inset 0 1px 0 rgba(255, 255, 255, 0.5),
              inset 0 -1px 0 rgba(0, 0, 0, 0.1)
            `
          }}
        >
          <div className="flex items-center justify-around h-20 pb-safe px-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className="relative flex items-center justify-center min-w-[72px] h-16"
              >
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute w-14 h-14 rounded-full backdrop-blur-md"
                    style={{
                      background: `${tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.15)')}`,
                      border: `1px solid ${tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.3)')}`,
                      boxShadow: `0 4px 16px ${tempColors.mid.replace('rgb', 'rgba').replace(')', ', 0.25)')}, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
                )}

                <motion.div
                  className={`relative z-10 flex h-6 w-6 items-center justify-center transition-colors ${
                    isActive
                      ? ""
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                  style={isActive ? { color: tempColors.mid } : undefined}
                  whileTap={{ scale: 0.9 }}
                  animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                </motion.div>

                <span className="absolute inset-0 min-h-[44px]" />
              </Link>
            );
          })}
          </div>
        </div>
      </div>
    </nav>
  );
}
