"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";

export function ApplicationPreferences() {
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    authorizedToWork: true,
    needVisaSponsorship: false,
    openToRelocation: true,
    openToRemoteRoles: true,
  });

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences({ ...preferences, [key]: !preferences[key] });
  };

  const handleSave = async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Application Preferences</h2>
        <p className="text-sm text-muted-foreground">Set your preferences for auto-filling application forms.</p>
      </div>

      <div className="space-y-6 bg-muted/30 p-6 rounded-xl border border-border/50">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Authorized To Work</Label>
            <p className="text-sm text-muted-foreground">Are you legally authorized to work in the country you are applying in?</p>
          </div>
          <Switch checked={preferences.authorizedToWork} onCheckedChange={() => handleToggle('authorizedToWork')} />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Need Visa Sponsorship</Label>
            <p className="text-sm text-muted-foreground">Do you now or in the future require visa sponsorship?</p>
          </div>
          <Switch checked={preferences.needVisaSponsorship} onCheckedChange={() => handleToggle('needVisaSponsorship')} />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Open To Relocation</Label>
            <p className="text-sm text-muted-foreground">Are you willing to relocate for the right opportunity?</p>
          </div>
          <Switch checked={preferences.openToRelocation} onCheckedChange={() => handleToggle('openToRelocation')} />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Open To Remote Opportunities</Label>
            <p className="text-sm text-muted-foreground">Are you interested in fully remote roles?</p>
          </div>
          <Switch checked={preferences.openToRemoteRoles} onCheckedChange={() => handleToggle('openToRemoteRoles')} />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
