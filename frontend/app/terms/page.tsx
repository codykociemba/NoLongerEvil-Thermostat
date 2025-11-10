"use client";

import { motion } from "framer-motion";
import { Scale, Mail } from "lucide-react";
import Link from "next/link";

export default function TermsPage() {
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
          <Scale className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-600 dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 bg-clip-text text-transparent pb-2">
          Terms of Service
        </h1>
        <p className="mt-6 text-lg md:text-xl text-zinc-600 dark:text-zinc-300 max-w-3xl mx-auto leading-relaxed">
          Please read these terms carefully before using the Project
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
          <strong>Project:</strong> No Longer Evil (the "Project")
        </p>
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mt-2">
          <strong>Maintainers:</strong> Hack House contributors (collectively, "we" / "us")
        </p>
      </motion.div>

      {/* Terms Content */}
      <motion.section
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* Section 1 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-bold">
              1
            </span>
            Use at your own risk
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              Running this software can permanently damage ("brick") your device or make it behave unexpectedly.
              If you brick your device, that's on you. You understand and accept all risks of installing,
              configuring, and using the Project.
            </p>
          </div>
        </div>

        {/* Section 2 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-bold">
              2
            </span>
            No affiliation with Google/Nest
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              This Project is independent and not affiliated with, endorsed by, or sponsored by Google LLC, Nest,
              or any related entity. You're responsible for making sure your use complies with your local laws
              and with any agreements you have with third parties (including Google/Nest).
            </p>
          </div>
        </div>

        {/* Section 3 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-bold">
              3
            </span>
            You must own (or have permission to modify) the device
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              Only use the Project on hardware you own or are expressly authorized to modify.
            </p>
          </div>
        </div>

        {/* Section 4 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-bold">
              4
            </span>
            Acceptable use
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              Don't use the Project to break the law, harm others, or disrupt networks/services.
              Don't use it to bypass technical protection measures where prohibited.
            </p>
          </div>
        </div>

        {/* Section 5 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-bold">
              5
            </span>
            No warranties
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              The Project is provided "AS IS" and "AS AVAILABLE," without warranties of any kind (express or implied),
              including merchantability, fitness for a particular purpose, and non-infringement.
            </p>
          </div>
        </div>

        {/* Section 6 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-bold">
              6
            </span>
            Limitation of liability
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              To the fullest extent permitted by law, we won't be liable for any indirect, incidental, special,
              consequential, exemplary, or punitive damages, or any loss of data, device failure, loss of use,
              or costs of substitute services, arising from or related to your use of the Project.
            </p>
          </div>
        </div>

        {/* Section 7 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-bold">
              7
            </span>
            Open source license governs the code
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              This ToS sits alongside the Project's open source license. If there's a direct conflict,
              the open source license controls for code licensing terms.
            </p>
          </div>
        </div>

        {/* Section 8 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-bold">
              8
            </span>
            Changes
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              We may update these terms by committing a new version to the repo. Continued use after changes
              means you accept the new terms.
            </p>
          </div>
        </div>

        {/* Section 9 */}
        <div className="surface p-8 md:p-10">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-bold">
              9
            </span>
            Contact
          </h2>
          <div className="ml-11 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              Questions about this ToS? Email{" "}
              <a
                href="mailto:cody@hackhouse.io"
                className="text-brand-600 dark:text-brand-400 hover:underline font-medium inline-flex items-center gap-1"
              >
                cody@hackhouse.io
                <Mail className="h-3.5 w-3.5" />
              </a>
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
            href="/privacy"
            className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
          >
            Privacy Policy
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
