"use client";

import { useCallback, useState, useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type LinkDeviceCardProps = {
  onLinked?: () => Promise<void> | void;
};

export function LinkDeviceCard({ onLinked }: LinkDeviceCardProps) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { getToken, isSignedIn } = useAuth();

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setMessage(null);

      const normalized = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (normalized.length !== 7) {
        setError("Entry key must be 7 characters (e.g. 123-ABCD).");
        return;
      }

      startTransition(async () => {
        try {
          if (!isSignedIn) {
            throw new Error("You must be signed in to claim an entry key.");
          }

          const token = await getToken();
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }

          const response = await fetch("/api/entry-key/claim", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ code: normalized }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || payload.message || "Failed to claim entry key");
          }

          const payload = await response.json().catch(() => ({}));
          setMessage(
            payload?.serial
              ? `Linked thermostat ${payload.serial} successfully.`
              : "Entry key accepted. Device link established."
          );
          setCode("");
          if (onLinked) {
            await onLinked();
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unable to claim entry key";
          setError(msg);
        }
      });
    },
    [code, onLinked]
  );

  return (
    <Card className="border-brand-200/60 dark:border-brand-900/50 bg-white/60 dark:bg-zinc-950/60 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Link Your Thermostat
        </CardTitle>
        <CardDescription className="text-sm text-zinc-600 dark:text-zinc-300 space-y-3">
          <p className="font-medium">Follow these steps to connect your thermostat:</p>
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>Make sure your thermostat is connected to Wi-Fi</li>
            <li>On your thermostat screen, press the display to wake it up</li>
            <li>Navigate to <span className="font-semibold">Settings</span> by pressing the settings icon</li>
            <li>Scroll down and select <span className="font-semibold">Nest App</span></li>
            <li>Select <span className="font-semibold">GET ENTRY KEY</span></li>
            <li>Wait a moment for the key to appear on screen (format: <span className="font-semibold">###-XXXX</span>)</li>
            <li>Enter the key in the box below within 60 minutes</li>
          </ol>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Entry Key
            </label>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123-ABCD"
              maxLength={8}
              autoComplete="off"
              spellCheck={false}
              disabled={isPending}
              className="uppercase tracking-[0.3em] text-center text-lg"
            />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Linking..." : "Link Device"}
          </Button>
        </form>

        {(error || message) && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            {error ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{error || message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
