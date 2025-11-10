"use client";

import Link from "next/link";
import { Heart, Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200/60 dark:border-zinc-800/60 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl pb-24 md:pb-0">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* About Section */}
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              No Longer Evil Thermostat
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Repurposing bricked Nest Gen 1 & 2 thermostats with custom software.
              Giving old hardware new life through open source innovation.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/about"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/codykociemba/NoLongerEvil-Thermostat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <Github className="h-3.5 w-3.5" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Open Source */}
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              Open Source
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
              This project is open source and available on GitHub. Contributions are welcome!
            </p>
            <a
              href="https://github.com/codykociemba/NoLongerEvil-Thermostat"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
            Made with <Heart className="h-4 w-4 text-red-500 fill-red-500" /> by{" "}
            <a
              href="https://hackhouse.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
            >
              Hack House
            </a>
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            © {new Date().getFullYear()} No Longer Evil Thermostat. Open Source Project.
          </p>
        </div>
      </div>
    </footer>
  );
}
