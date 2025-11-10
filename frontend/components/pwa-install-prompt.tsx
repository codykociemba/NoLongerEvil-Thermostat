"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    const visitCount = parseInt(localStorage.getItem("pwa-visit-count") || "0", 10);

    localStorage.setItem("pwa-visit-count", String(visitCount + 1));

    if (!dismissed && visitCount >= 2) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);

        setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
      };

      window.addEventListener("beforeinstallprompt", handler);

      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      if (navigator.vibrate) {
        navigator.vibrate([10, 50, 10]);
      }
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-40"
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div
          className="relative p-4 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.5)",
          }}
        >
          {/* Dark mode background */}
          <div
            className="absolute inset-0 opacity-0 dark:opacity-100 transition-opacity"
            style={{
              background: "linear-gradient(135deg, rgba(39, 39, 42, 0.98) 0%, rgba(39, 39, 42, 0.95) 100%)",
            }}
          />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-10"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          </button>

          <div className="relative z-10">
            {/* Icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 mb-3 shadow-lg shadow-brand-500/30">
              <Download className="h-6 w-6 text-white" />
            </div>

            {/* Content */}
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-1">
              Install No Longer Evil Thermostat
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              Add to your home screen for quick access to your repurposed thermostat.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <motion.button
                onClick={handleInstall}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg shadow-brand-500/30"
                style={{
                  background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Install App
              </motion.button>
              <motion.button
                onClick={handleDismiss}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Not Now
              </motion.button>
            </div>
          </div>

          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
