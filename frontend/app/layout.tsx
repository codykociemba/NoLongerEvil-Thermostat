import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";
import { Footer } from "@/components/footer";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "No Longer Evil Thermostat",
  description: "Repurposing bricked and outdated Nest Generation 1 & 2 thermostats with custom software to breathe new life into them",
  manifest: "/manifest.json",
  keywords: ["thermostat", "nest", "repurpose", "upcycle", "smart home", "IoT", "custom firmware", "generation 1", "generation 2"],
  authors: [{ name: "No Longer Evil Team" }],
  openGraph: {
    title: "No Longer Evil Thermostat",
    description: "Repurposing bricked and outdated Nest Generation 1 & 2 thermostats with custom software",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "No Longer Evil Thermostat",
    description: "Repurposing bricked and outdated Nest Generation 1 & 2 thermostats with custom software",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover", // For iOS notch/safe areas
  themeColor: "#0EA5E9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen overflow-x-hidden`}
      >
        <Providers>
          <Header />
          <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">{children}</main>
          <Footer />
          <BottomNav />
          <PWAInstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
