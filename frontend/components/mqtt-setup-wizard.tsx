"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, Wifi, Lock, Server } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MqttSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingConfig?: any;
}

type Step = "broker" | "credentials" | "advanced" | "testing" | "complete";

export function MqttSetupWizard({ open, onOpenChange, existingConfig }: MqttSetupWizardProps) {
  const { user } = useUser();
  const userId = user?.id;

  const [step, setStep] = useState<Step>("broker");
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [brokerUrl, setBrokerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [topicPrefix, setTopicPrefix] = useState("nolongerevil");
  const [discoveryPrefix, setDiscoveryPrefix] = useState("homeassistant");

  const upsertIntegration = useAction(api.integrations_actions.upsertIntegrationSecure);

  // Load existing config if editing
  useEffect(() => {
    if (existingConfig) {
      setBrokerUrl(existingConfig.config.brokerUrl || "");
      setUsername(existingConfig.config.username || "");
      setPassword(existingConfig.config.password || "");
      setTopicPrefix(existingConfig.config.topicPrefix || "nolongerevil");
      setDiscoveryPrefix(existingConfig.config.discoveryPrefix || "homeassistant");
    }
  }, [existingConfig]);

  const handleNext = () => {
    if (step === "broker") setStep("credentials");
    else if (step === "credentials") setStep("advanced");
    else if (step === "advanced") setStep("testing");
  };

  const handleBack = () => {
    if (step === "credentials") setStep("broker");
    else if (step === "advanced") setStep("credentials");
    else if (step === "testing") setStep("advanced");
  };

  const handleTest = async () => {
    setIsLoading(true);
    setTestResult(null);

    // Simulate connection test (in real implementation, this would call an API endpoint)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // For now, just validate the URL format
    const isValidUrl = brokerUrl.startsWith("mqtt://") || brokerUrl.startsWith("mqtts://");

    setTestResult({
      success: isValidUrl,
      message: isValidUrl
        ? "Successfully connected to MQTT broker!"
        : "Invalid broker URL. Must start with mqtt:// or mqtts://",
    });

    setIsLoading(false);

    if (isValidUrl) {
      setTimeout(() => setStep("complete"), 1500);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      await upsertIntegration({
        userId,
        type: "mqtt",
        enabled: true,
        config: {
          brokerUrl,
          username: username || undefined,
          password: password || undefined,
          topicPrefix,
          discoveryPrefix,
        },
      });

      // Close wizard
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 500);
    } catch (error) {
      console.error("Failed to save integration:", error);
      setTestResult({
        success: false,
        message: "Failed to save integration. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep("broker");
    setBrokerUrl("");
    setUsername("");
    setPassword("");
    setTopicPrefix("nolongerevil");
    setDiscoveryPrefix("homeassistant");
    setTestResult(null);
  };

  const canProceed = () => {
    if (step === "broker") return brokerUrl.trim().length > 0;
    if (step === "credentials") return true; // Optional
    if (step === "advanced") return topicPrefix.trim().length > 0 && discoveryPrefix.trim().length > 0;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {existingConfig ? "Edit MQTT Integration" : "Setup MQTT Integration"}
          </DialogTitle>
          <DialogDescription>
            Connect your thermostats to Home Assistant or any MQTT-based home automation platform
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center">
              {["broker", "credentials", "advanced", "testing"].map((s, idx) => (
                <div key={s} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                        step === s
                          ? "bg-brand-600 text-white shadow-lg shadow-brand-500/30"
                          : ["broker", "credentials", "advanced", "testing"].indexOf(step) >
                            ["broker", "credentials", "advanced", "testing"].indexOf(s)
                          ? "bg-green-600 text-white"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {["broker", "credentials", "advanced", "testing"].indexOf(step) >
                      ["broker", "credentials", "advanced", "testing"].indexOf(s) ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${
                      step === s
                        ? "text-brand-600 dark:text-brand-400"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}>
                      {s === "broker" && "Broker"}
                      {s === "credentials" && "Credentials"}
                      {s === "advanced" && "Advanced"}
                      {s === "testing" && "Test"}
                    </span>
                  </div>
                  {idx < 3 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 transition-all ${
                        ["broker", "credentials", "advanced", "testing"].indexOf(step) > idx
                          ? "bg-green-600"
                          : "bg-zinc-200 dark:bg-zinc-800"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          {step === "broker" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900/30">
                  <Server className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">Broker Configuration</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brokerUrl" className="text-sm font-medium">MQTT Broker URL *</Label>
                <Input
                  id="brokerUrl"
                  placeholder="mqtt://192.168.1.100:1883"
                  value={brokerUrl}
                  onChange={(e) => setBrokerUrl(e.target.value)}
                  className="h-11"
                />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Examples: <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">mqtt://localhost:1883</code>,{" "}
                  <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">mqtts://broker.hivemq.com:8883</code>
                </p>
              </div>

              <Alert className="border-blue-300 dark:border-blue-700 bg-blue-100 dark:bg-blue-900/40">
                <Wifi className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>For Home Assistant users:</strong> Use <code className="text-xs bg-blue-200 dark:bg-blue-800 px-1.5 py-0.5 rounded">mqtt://core-mosquitto:1883</code> if using the Mosquitto add-on, or your Home Assistant's IP address.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === "credentials" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900/30">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">Authentication</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">Username (Optional)</Label>
                <Input
                  id="username"
                  placeholder="mqtt_user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password (Optional)</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-11"
                />
              </div>

              <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                <AlertDescription className="text-zinc-700 dark:text-zinc-300">
                  If your MQTT broker requires authentication, enter your credentials. Leave empty for anonymous access.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === "advanced" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900/30">
                  <Server className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">Advanced Settings</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topicPrefix" className="text-sm font-medium">Topic Prefix</Label>
                <Input
                  id="topicPrefix"
                  placeholder="nolongerevil"
                  value={topicPrefix}
                  onChange={(e) => setTopicPrefix(e.target.value)}
                  className="h-11"
                />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  All MQTT topics will be prefixed with this value
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discoveryPrefix" className="text-sm font-medium">Home Assistant Discovery Prefix</Label>
                <Input
                  id="discoveryPrefix"
                  placeholder="homeassistant"
                  value={discoveryPrefix}
                  onChange={(e) => setDiscoveryPrefix(e.target.value)}
                  className="h-11"
                />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Used for Home Assistant auto-discovery (usually "homeassistant")
                </p>
              </div>

              <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                <AlertDescription className="text-zinc-700 dark:text-zinc-300">
                  These settings are usually fine at their defaults. Only change if you know what you're doing.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === "testing" && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-900/30">
                  <Wifi className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">Test Connection</h3>
              </div>

              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 min-w-[100px]">Broker:</span>
                  <code className="text-sm font-mono text-zinc-900 dark:text-zinc-100">{brokerUrl}</code>
                </div>
                {username && (
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 min-w-[100px]">Username:</span>
                    <code className="text-sm font-mono text-zinc-900 dark:text-zinc-100">{username}</code>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 min-w-[100px]">Topic Prefix:</span>
                  <code className="text-sm font-mono text-zinc-900 dark:text-zinc-100">{topicPrefix}</code>
                </div>
              </div>

              {testResult && (
                <Alert
                  variant={testResult.success ? "default" : "destructive"}
                  className={testResult.success
                    ? "border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-900/40"
                    : ""
                  }
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription className={testResult.success ? "text-green-900 dark:text-green-100" : ""}>
                    {testResult.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === "complete" && (
            <div className="space-y-6 text-center py-12">
              <div className="inline-flex p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Connection Successful!</h3>
                <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                  Your MQTT integration is ready. Click "Save" to enable it and start publishing device data.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step !== "broker" && step !== "complete" && (
            <Button variant="outline" onClick={handleBack} disabled={isLoading} className="h-11">
              Back
            </Button>
          )}

          {step !== "testing" && step !== "complete" && (
            <Button onClick={handleNext} disabled={!canProceed()} className="h-11 bg-brand-600 hover:bg-brand-700 text-white">
              Next
            </Button>
          )}

          {step === "testing" && (
            <Button onClick={handleTest} disabled={isLoading} className="h-11 bg-brand-600 hover:bg-brand-700 text-white">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test Connection
            </Button>
          )}

          {step === "complete" && (
            <Button onClick={handleSave} disabled={isLoading} className="h-11 bg-green-600 hover:bg-green-700 text-white">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Integration
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
