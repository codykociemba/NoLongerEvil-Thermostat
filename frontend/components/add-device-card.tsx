"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LinkDeviceCard } from "./link-device-card";

type AddDeviceCardProps = {
  onLinked?: () => Promise<void> | void;
};

export function AddDeviceCard({ onLinked }: AddDeviceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLinked = async () => {
    setIsExpanded(false);
    if (onLinked) {
      await onLinked();
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          key="expanded"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/50 backdrop-blur-md z-50 flex items-center justify-center overflow-y-auto p-4"
          onClick={() => setIsExpanded(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 dark:bg-white/10 dark:hover:bg-white/20 text-white transition-colors duration-200 shadow-lg cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <LinkDeviceCard onLinked={handleLinked} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <motion.button
        key="collapsed"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onClick={() => setIsExpanded(true)}
        className="surface group relative overflow-hidden h-full min-h-[320px] min-w-[250px] flex flex-col items-center justify-center gap-3 hover:border-brand-500 dark:hover:border-brand-500 transition-all duration-200 cursor-pointer"
      >
        <div className="rounded-full bg-gradient-to-br from-brand-500 to-brand-600 p-4 group-hover:scale-110 transition-transform duration-200">
          <Plus className="h-8 w-8 text-white" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Add Thermostat
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Link a new device
          </p>
        </div>
      </motion.button>

      {typeof document !== "undefined" ? createPortal(modalContent, document.body) : null}
    </>
  );
}
