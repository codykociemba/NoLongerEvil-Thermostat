"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Plug, Power, Settings, Trash2, Wifi } from "lucide-react";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { MqttSetupWizard } from "@/components/mqtt-setup-wizard";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

export default function IntegrationsPage() {
  return (
    <>
      <SignedIn>
        <IntegrationsContent />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn redirectUrl="/dashboard/integrations" />
      </SignedOut>
    </>
  );
}

function IntegrationsContent() {
  const { user } = useUser();
  const userId = user?.id;

  const [mqttWizardOpen, setMqttWizardOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<any>(null);
  const [deleteIntegrationId, setDeleteIntegrationId] = useState<string | null>(null);

  // Fetch user's integrations
  const integration = useQuery(
    api.integrations.getIntegration,
    userId ? { userId, type: "mqtt" } : "skip"
  );

  const toggleIntegration = useMutation(api.integrations.toggleIntegration);
  const deleteIntegration = useMutation(api.integrations.deleteIntegration);

  const handleToggle = async (integrationId: string, currentEnabled: boolean) => {
    if (!userId) return;
    try {
      await toggleIntegration({
        userId,
        type: "mqtt",
        enabled: !currentEnabled,
      });
    } catch (error) {
      console.error("Failed to toggle integration:", error);
    }
  };

  const handleDelete = async () => {
    if (!userId || !deleteIntegrationId) return;
    try {
      await deleteIntegration({
        userId,
        type: "mqtt",
      });
      setDeleteIntegrationId(null);
    } catch (error) {
      console.error("Failed to delete integration:", error);
    }
  };

  const handleEdit = () => {
    if (integration) {
      setEditingIntegration(integration);
      setMqttWizardOpen(true);
    }
  };

  const handleWizardClose = () => {
    setMqttWizardOpen(false);
    setEditingIntegration(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Integrations</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Connect your thermostats to home automation platforms and third-party services
        </p>
      </div>

      {/* Available Integrations */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Available Integrations</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* MQTT Integration Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="h-5 w-5" />
                    MQTT
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Connect to Home Assistant and other MQTT-based home automation platforms
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {integration ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={integration.enabled ? "default" : "secondary"}>
                      {integration.enabled ? "Active" : "Inactive"}
                    </Badge>
                    <Switch
                      checked={integration.enabled}
                      onCheckedChange={() => handleToggle(integration._id, integration.enabled)}
                    />
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    <p>Broker: {integration.config.brokerUrl}</p>
                    <p className="text-xs mt-1">Updated {formatDate(integration.updatedAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="flex-1"
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteIntegrationId(integration._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setMqttWizardOpen(true)}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Setup MQTT
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Webhook Integration (Coming Soon) */}
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                Webhooks
                <Badge variant="outline" className="ml-auto">Coming Soon</Badge>
              </CardTitle>
              <CardDescription className="mt-2">
                Receive real-time device events via HTTP webhooks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled className="w-full">
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          {/* WebSocket Integration (Coming Soon) */}
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Power className="h-5 w-5" />
                WebSocket
                <Badge variant="outline" className="ml-auto">Coming Soon</Badge>
              </CardTitle>
              <CardDescription className="mt-2">
                Real-time bidirectional communication for custom applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled className="w-full">
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MQTT Setup Wizard */}
      <MqttSetupWizard
        open={mqttWizardOpen}
        onOpenChange={handleWizardClose}
        existingConfig={editingIntegration}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteIntegrationId} onOpenChange={() => setDeleteIntegrationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all communication with your MQTT broker. Your devices will no longer be accessible via MQTT.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Integration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
