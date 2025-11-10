"use client";

import { motion } from "framer-motion";
import { Github, Linkedin, Mail, ExternalLink, Code2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <motion.section
        className="surface p-12 md:p-16 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-zinc-900 via-zinc-700 to-zinc-600 dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-400 bg-clip-text text-transparent pb-2">
          About This Project
        </h1>
        <p className="mt-6 text-lg md:text-xl text-zinc-600 dark:text-zinc-300 max-w-3xl mx-auto leading-relaxed">
          Bringing new life to bricked thermostats through open source innovation
        </p>
      </motion.section>

      {/* Project Story */}
      <motion.section
        className="space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <div className="surface p-8 md:p-10">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
            The Story
          </h2>
          <div className="space-y-4 text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <p>
              When Google announced they were sunsetting Nest Gen 1 and Gen 2 thermostats, I knew I wanted to do something
              about it. But let's be real, wanting to do something and actually doing it are two different things. What really
              lit the fire under my ass was the FULU bounty announcement. I love a good challenge, and having a potential
              reward at the end makes it even better. So I dove in.
            </p>
            <p>
              My beef with Google goes way deeper than just bricked thermostats though. I'm an Android developer who got
              permanently banned from the Google Play Store. Not for malware. Not for stealing user data. I got three
              automated rejections from some vague-ass robot that couldn't tell me what was actually wrong. Three strikes
              and you're out, permanently. No human review, no real appeal process, just a "go fuck yourself" from the
              algorithm. The best part? I'm marked now. Anyone who works with me or connects through my network risks
              getting banned too. It's like Google gave me a digital plague. And now they're restricting sideloading,
              so even if I build an app for myself or a handful of users, I'd need to register through their system,
              which will just reject me because of my past ban. most likely. Basically, Google has decided I can never create an
              Android app again. Not for the Play Store, not for my own devices, not for anyone.
            </p>
            <p>
              So yeah, this project is personal. It's about my hatred for Google, sure. But it's bigger than that.
              When you buy a piece of hardware, you own it. You should be able to do whatever the fuck you want with it.
              Your thermostat shouldn't become e-waste because some corporation decided to flip the kill switch. Your
              phone shouldn't be locked down to prevent you from accessing your own device. This is about taking back control.
            </p>
            <p>
              This project gives you the tools to flash a custom firmware update onto your Nest Gen 1 and Gen 2 thermostat.
              Rip it free from Google's cloud bullshit. No more dependencies, no more forced obsolescence, no more
              corporate overlords deciding when your hardware stops working. It's your device. You paid for it.
              Now you actually control it.
            </p>
            <p>
              Everything here is open source. Fork it, modify it, break it, rebuild it, share it. That's the whole
              point. This Github repo and website will stay up and free for as long as I can keep them alive. If
              Google decides to hit me with legal action or a DMCA takedown, well, that's out of my hands. But until
              then, this code lives on, as does my hatred for Google and their bullshit tactics.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Creator Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="surface p-8 md:p-10">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8 text-center">
            Created By
          </h2>

          <div className="max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
              {/* Avatar */}
              <div className="shrink-0">
                <div className="h-32 w-32 rounded-2xl overflow-hidden shadow-xl shadow-brand-500/30 bg-gradient-to-br from-brand-500 to-brand-600">
                  <Image
                    src="https://hackhouse.io/_next/static/images/cody-image-e231169ca7eb0c3cf742493abc1567c9.webp"
                    alt="Cody Kociemba"
                    width={128}
                    height={128}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  Cody Kociemba
                </h3>
                <p className="text-brand-600 dark:text-brand-400 font-medium mb-4">
                  Security Researcher & Developer
                </p>
                <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6">
                  Cody is a security researcher and software developer passionate about hardware hacking,
                  reverse engineering, and fighting corporate control. He is the founder of Hack House,
                  a mobile app software development startup from Scottsdale, AZ. He is passionate about working on projects
                  that challenge the control of Google and other tech giants over the hardware we own, as well as breaking shit.
                </p>

                {/* Social Links */}
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <a
                    href="https://github.com/ckociemba"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <Github className="h-4 w-4" />
                      GitHub
                    </Button>
                  </a>
                  <a
                    href="https://www.linkedin.com/in/codykociemba/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </Button>
                  </a>
                  <a
                    href="mailto:cody@hackhouse.io"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Hack House Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="surface p-8 md:p-10 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-medium mb-6">
              <Heart className="h-4 w-4 fill-current" />
              Made with Love
            </div>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Powered by Hack House
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-8">
              Hack House is a collaborative space for hackers, makers, and security researchers to work
              on projects that matter. We believe in open source, right to repair, and giving users
              control over their own hardware.
            </p>
            <a
              href="https://hackhouse.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="gap-2">
                Visit Hack House
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </motion.section>

      {/* Open Source CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <div className="surface p-12 md:p-16 text-center relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 mb-6">
              <Code2 className="h-8 w-8 text-white dark:text-zinc-900" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Open Source & Community Driven
            </h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed mb-8">
              This project is completely open source. Fork it, improve it, share it. Together we can
              fight planned obsolescence and keep working hardware out of landfills.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://github.com/codykociemba/NoLongerEvil-Thermostat"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <Github className="h-5 w-5" />
                  View on GitHub
                </Button>
              </a>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
