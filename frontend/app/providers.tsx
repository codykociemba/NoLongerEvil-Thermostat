"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/lib/theme-provider";
import { QueryProvider } from "@/lib/query-client";
import { ReactNode } from "react";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ClerkProvider>
      <ThemeProvider>
        <QueryProvider>{children}</QueryProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}

