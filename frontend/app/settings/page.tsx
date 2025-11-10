"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";

export default function SettingsPage() {
  return (
    <>
      <SignedIn>
        <SettingsContent />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn redirectUrl="/settings" />
      </SignedOut>
    </>
  );
}

function SettingsContent() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage your preferences
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Notifications */}
        <motion.div
          className="surface p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-700/50 dark:to-purple-800/50"
              style={{
                boxShadow: "0 4px 12px rgba(168, 85, 247, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)"
              }}
            >
              <Bell className="h-6 w-6 text-purple-600 dark:text-purple-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                Notifications
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                Manage alert and notification preferences
              </p>

              <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
                Coming soon
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
