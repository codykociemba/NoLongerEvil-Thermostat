"use client";

import Link from "next/link";
import { ThemeSwitch } from "./theme-switch";
import { Flame } from "lucide-react";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

type HeaderProps = {
  showNav?: boolean;
};

export function Header({ showNav = true }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-950/80 shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-7xl">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 group-hover:shadow-xl group-hover:shadow-brand-500/40 transition-all group-hover:scale-105">
              <Flame className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
              No Longer Evil
            </span>
          </Link>

        </div>

        <div className="flex items-center gap-3">
          {showNav && (
            <>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className={`hidden md:block px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    pathname === "/dashboard" || pathname.startsWith("/dashboard/")
                      ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/schedule"
                  className={`hidden md:block px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    pathname === "/schedule"
                      ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  Schedule
                </Link>
              </SignedIn>
              <Link
                href="/about"
                className={`hidden md:block px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  pathname === "/about"
                    ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                }`}
              >
                About
              </Link>
              <SignedIn>
                <Link
                  href="/settings"
                  className={`hidden md:block px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    pathname === "/settings"
                      ? "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  Settings
                </Link>
              </SignedIn>
            </>
          )}
          <ThemeSwitch />
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="outline" size="sm">
                Sign in
              </Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
