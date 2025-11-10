"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Thermometer, Gauge, Smartphone, ArrowRight, Github, Code2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="space-y-20 py-8">
      {/* Hero Section */}
      <section className="relative">
        {/* Animated background blobs */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center overflow-hidden">
          <motion.div
            className="absolute h-96 w-96 rounded-full blur-3xl"
            style={{ backgroundColor: 'var(--color-mode-cool-from)', opacity: 0.1 }}
            animate={{
              scale: [1, 1.2, 1],
              x: [-20, 20, -20],
              y: [-20, 20, -20],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute h-96 w-96 rounded-full blur-3xl"
            style={{ backgroundColor: 'var(--color-mode-heat-from)', opacity: 0.1 }}
            animate={{
              scale: [1.2, 1, 1.2],
              x: [20, -20, 20],
              y: [20, -20, 20],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="surface p-12 md:p-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-600 dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 bg-clip-text text-transparent pb-2">
              No Longer Evil
            </h1>
            <p className="mt-6 text-lg md:text-xl text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed">
              Breathing new life into bricked and outdated Nest Generation 1 & 2 thermostats.
              Repurpose your old hardware with our custom software and enjoy a beautiful, modern control interface.
            </p>
          </motion.div>

          <motion.div
            className="mt-10 flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link href="/auth/login">
              <Button
                size="lg"
                className="px-8 h-12 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40 transition-all group"
              >
                Get started
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <motion.div
        className="grid gap-6 md:grid-cols-3"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="surface p-8 group cursor-default relative overflow-hidden">
          <div
            className="absolute inset-0 group-hover:opacity-[0.05] transition-opacity"
            style={{
              background: 'linear-gradient(135deg, var(--color-mode-heat-from) 0%, transparent 100%)',
              opacity: 0
            }}
          />
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-900/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform" style={{
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(249, 115, 22, 0.05) 100%)'
            }}>
              <Thermometer className="h-7 w-7" style={{ color: 'var(--color-mode-heat-from)' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Revive Your Hardware</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Give your bricked Nest Gen 1 or Gen 2 thermostat a second life with our custom firmware and modern control interface.
            </p>
          </div>
        </div>

        <div className="surface p-8 group cursor-default relative overflow-hidden">
          <div
            className="absolute inset-0 group-hover:opacity-[0.05] transition-opacity"
            style={{
              background: 'linear-gradient(135deg, var(--color-mode-cool-from) 0%, transparent 100%)',
              opacity: 0
            }}
          />
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform" style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)'
            }}>
              <Gauge className="h-7 w-7" style={{ color: 'var(--color-mode-cool-from)' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Full Control</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Adjust temperature, switch modes, and monitor real-time status—all with a sleek, intuitive interface that rivals the original.
            </p>
          </div>
        </div>

        <div className="surface p-8 group cursor-default relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-900/30 dark:to-brand-900/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Smartphone className="h-7 w-7 text-brand-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Open Source</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Community-driven software that's free and open. Install as a PWA and control your repurposed thermostat from any device.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Open Source Section */}
      <motion.section
        className="surface p-12 md:p-16 text-center relative overflow-hidden"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-brand-600/5" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.div
            className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 mb-6"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Code2 className="h-8 w-8 text-white dark:text-zinc-900" />
          </motion.div>

          <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Open Source Project
          </h2>
          <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed mb-8">
            This is a community-driven open source project. The code is free to use, modify, and share.
            Together we can fight planned obsolescence and keep working hardware out of landfills.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://github.com/codykociemba/NoLongerEvil-Thermostat"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                className="px-8 h-12 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-lg hover:shadow-xl transition-all group gap-2"
              >
                <Github className="h-5 w-5" />
                View on GitHub
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </a>
            <Link href="/about">
              <Button
                size="lg"
                variant="outline"
                className="px-8 h-12"
              >
                Learn More About This Project
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-6 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="text-3xl font-bold text-brand-600 dark:text-brand-400 mb-1">100%</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Open Source</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-brand-600 dark:text-brand-400 mb-1">Free</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Forever</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-brand-600 dark:text-brand-400 mb-1">Gen 1 & 2</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Supported</div>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
