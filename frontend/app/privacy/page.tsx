"use client";

import { motion } from "framer-motion";
import { Shield, Mail, Database, Lock, UserX, Clock, Baby, FileEdit } from "lucide-react";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="space-y-8 py-8">
      {/* Hero Section */}
      <motion.section
        className="surface p-12 md:p-16 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 mb-6">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-600 dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 bg-clip-text text-transparent pb-2">
          Privacy Policy
        </h1>
        <p className="mt-6 text-lg md:text-xl text-zinc-600 dark:text-zinc-300 max-w-3xl mx-auto leading-relaxed">
          Your privacy matters. Here's how we handle your data.
        </p>
      </motion.section>

      {/* Effective Date */}
      <motion.div
        className="surface p-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <strong>Effective date:</strong> November 1, 2025
        </p>
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-2">
          <strong>Project:</strong> No Longer Evil
        </p>
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-2">
          <strong>Contact for privacy requests:</strong>{" "}
          <a
            href="mailto:cody@hackhouse.io"
            className="text-brand-600 dark:text-brand-400 hover:underline"
          >
            cody@hackhouse.io
          </a>
        </p>
      </motion.div>

      {/* Privacy Content */}
      <motion.section
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Section 1 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
              <Database className="h-4 w-4" />
            </span>
            What we collect (minimal data)
          </h2>
          <div className="ml-11 space-y-4 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              We store just enough data to make your thermostat(s) work via our service backed by Convex.
              This typically includes:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Technical identifiers (e.g., device IDs)</li>
              <li>Basic device state/settings required for operation</li>
              <li>Account or session identifiers needed to authenticate your requests</li>
            </ul>
            <p className="font-medium text-zinc-700 dark:text-zinc-200">
              We do not collect more than is necessary for functionality.
            </p>
          </div>
        </div>

        {/* Section 2 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
              <FileEdit className="h-4 w-4" />
            </span>
            How we use your data
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              Only to operate, maintain, and improve the Project's functionality for your devices.
            </p>
          </div>
        </div>

        {/* Section 3 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
              <UserX className="h-4 w-4" />
            </span>
            Sharing
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              We don't sell your data. We may share it with service providers that help us run the Project
              (e.g., Convex as our database/backend) under confidentiality commitments, and if required by law.
            </p>
          </div>
        </div>

        {/* Section 4 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
              <Clock className="h-4 w-4" />
            </span>
            Retention
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              We retain data only as long as needed to keep your thermostat(s) working. If you stop using the Project,
              we aim to delete associated data within a reasonable period.
            </p>
          </div>
        </div>

        {/* Section 5 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
              <Mail className="h-4 w-4" />
            </span>
            Deletion / your rights
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              Email{" "}
              <a
                href="mailto:cody@hackhouse.io"
                className="text-brand-600 dark:text-brand-400 hover:underline font-medium inline-flex items-center gap-1"
              >
                cody@hackhouse.io
                <Mail className="h-3.5 w-3.5" />
              </a>{" "}
              to request deletion of your data. Include sufficient info to identify your account/devices.
              We'll delete what we control, subject to legal obligations.
            </p>
          </div>
        </div>

        {/* Section 6 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
              <Lock className="h-4 w-4" />
            </span>
            Security
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              We use reasonable safeguards, but no system is 100% secure. Use the Project at your own risk.
            </p>
          </div>
        </div>

        {/* Section 7 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
              <Baby className="h-4 w-4" />
            </span>
            Children
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              The Project is not directed to children under 13, and we don't knowingly collect their data.
            </p>
          </div>
        </div>

        {/* Section 8 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
              <FileEdit className="h-4 w-4" />
            </span>
            Changes
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              We may update this policy by committing a new version to the repo. Continued use after changes
              means you accept the updated policy.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Footer Links */}
      <motion.div
        className="surface p-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Also see our{" "}
          <Link
            href="/terms"
            className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
          >
            Terms of Service
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
