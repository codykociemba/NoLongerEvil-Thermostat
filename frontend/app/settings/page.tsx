"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Settings2, Plug, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignedIn, SignedOut, RedirectToSignIn, useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

import dynamic from 'next/dynamic';

const IntegrationsContent = dynamic(() => import('../dashboard/integrations/page').then(mod => ({ default: mod.default })), { ssr: false });

export default function SettingsPage() {
  return (
    <>
      <SignedIn>
        <SettingsContent />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn redirectUrl="/settings" />
      </SignedOut>
    </>
  );
}

type Tab = "general" | "integrations";

function SettingsContent() {
  const { user } = useUser();
  const userId = user?.id;
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const structureAddress = useQuery(
    api.users.getUserStructureAddress,
    userId ? { userId } : "skip"
  );

  const updateAddress = useMutation(api.users.updateStructureAddress);

  useEffect(() => {
    if (structureAddress) {
      setAddress(structureAddress.address || "");
      setCity(structureAddress.city || "");
      setState(structureAddress.state || "");
      setCountry(structureAddress.country || "");
      setPostalCode(structureAddress.postalCode || "");
    }
  }, [structureAddress]);

  const handleSaveAddress = async () => {
    if (!userId) return;
    if (!country || !postalCode) {
      setSaveMessage("Country and Postal Code are required");
      setTimeout(() => setSaveMessage(""), 3000);
      return;
    }

    setIsSaving(true);
    try {
      await updateAddress({
        userId,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        country,
        postalCode,
      });
      setSaveMessage("Address saved successfully");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (error) {
      setSaveMessage("Failed to save address");
      setTimeout(() => setSaveMessage(""), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="rounded-full"
            >
              <Link href="/dashboard">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 bg-clip-text text-transparent">
                Settings
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Manage your account preferences
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("general")}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === "general"
                ? "surface text-brand-600 dark:text-brand-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <Settings2 className="h-4 w-4" />
            General
          </button>
          <button
            onClick={() => setActiveTab("integrations")}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
              activeTab === "integrations"
                ? "surface text-brand-600 dark:text-brand-400 shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <Plug className="h-4 w-4" />
            Integrations
          </button>
        </div>

        {activeTab === "general" && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Location Settings</CardTitle>
                <CardDescription>
                  Update your location information for weather and regional settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-sm font-medium">Address (Optional)</Label>
                  <Input
                    id="address"
                    placeholder="123 Main St"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-sm font-medium">City (Optional)</Label>
                    <Input
                      id="city"
                      placeholder="San Francisco"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-sm font-medium">State/Province (Optional)</Label>
                    <Input
                      id="state"
                      placeholder="California"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="country" className="text-sm font-medium">Country *</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="DE">Germany</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                        <SelectItem value="IT">Italy</SelectItem>
                        <SelectItem value="ES">Spain</SelectItem>
                        <SelectItem value="NL">Netherlands</SelectItem>
                        <SelectItem value="SE">Sweden</SelectItem>
                        <SelectItem value="NO">Norway</SelectItem>
                        <SelectItem value="DK">Denmark</SelectItem>
                        <SelectItem value="FI">Finland</SelectItem>
                        <SelectItem value="BE">Belgium</SelectItem>
                        <SelectItem value="CH">Switzerland</SelectItem>
                        <SelectItem value="AT">Austria</SelectItem>
                        <SelectItem value="PL">Poland</SelectItem>
                        <SelectItem value="CZ">Czech Republic</SelectItem>
                        <SelectItem value="IE">Ireland</SelectItem>
                        <SelectItem value="PT">Portugal</SelectItem>
                        <SelectItem value="NZ">New Zealand</SelectItem>
                        <SelectItem value="JP">Japan</SelectItem>
                        <SelectItem value="KR">South Korea</SelectItem>
                        <SelectItem value="SG">Singapore</SelectItem>
                        <SelectItem value="HK">Hong Kong</SelectItem>
                        <SelectItem value="IN">India</SelectItem>
                        <SelectItem value="BR">Brazil</SelectItem>
                        <SelectItem value="MX">Mexico</SelectItem>
                        <SelectItem value="AR">Argentina</SelectItem>
                        <SelectItem value="CL">Chile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postalCode" className="text-sm font-medium">Postal Code *</Label>
                    <Input
                      id="postalCode"
                      placeholder="94102"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="h-11"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  {saveMessage && (
                    <p className={`text-sm ${saveMessage.includes("success") ? "text-green-600" : "text-red-600"}`}>
                      {saveMessage}
                    </p>
                  )}
                  <Button
                    onClick={handleSaveAddress}
                    disabled={isSaving || !country || !postalCode}
                    className="ml-auto h-11 bg-brand-600 hover:bg-brand-700 text-white"
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Location
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === "integrations" && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <IntegrationsContent />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
