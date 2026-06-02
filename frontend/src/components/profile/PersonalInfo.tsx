"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";

export function PersonalInfo() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "John Doe",
    email: "john@example.com",
    phone: "+1 234 567 890",
    location: "San Francisco, CA",
    linkedinUrl: "https://linkedin.com/in/johndoe",
    githubUrl: "https://github.com/johndoe",
    portfolioUrl: "https://johndoe.com"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setIsLoading(true);
    // Mock save delay
    await new Promise(r => setTimeout(r, 1000));
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Personal Information</h2>
        <p className="text-sm text-muted-foreground">Update your basic contact details and professional links.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input 
            id="fullName" 
            name="fullName" 
            value={formData.fullName} 
            onChange={handleChange} 
            placeholder="Jane Doe" 
            className="bg-muted/50 border-border focus-visible:ring-emerald-500/50" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input 
            id="email" 
            name="email" 
            type="email" 
            value={formData.email} 
            onChange={handleChange} 
            placeholder="jane@example.com" 
            className="bg-muted/50 border-border focus-visible:ring-emerald-500/50" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input 
            id="phone" 
            name="phone" 
            type="tel" 
            value={formData.phone} 
            onChange={handleChange} 
            placeholder="+1 (555) 000-0000" 
            className="bg-muted/50 border-border focus-visible:ring-emerald-500/50" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Current Location</Label>
          <Input 
            id="location" 
            name="location" 
            value={formData.location} 
            onChange={handleChange} 
            placeholder="City, State" 
            className="bg-muted/50 border-border focus-visible:ring-emerald-500/50" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="linkedinUrl">LinkedIn Profile URL</Label>
          <Input 
            id="linkedinUrl" 
            name="linkedinUrl" 
            type="url" 
            value={formData.linkedinUrl} 
            onChange={handleChange} 
            placeholder="https://linkedin.com/in/..." 
            className="bg-muted/50 border-border focus-visible:ring-emerald-500/50" 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="githubUrl">GitHub URL</Label>
          <Input 
            id="githubUrl" 
            name="githubUrl" 
            type="url" 
            value={formData.githubUrl} 
            onChange={handleChange} 
            placeholder="https://github.com/..." 
            className="bg-muted/50 border-border focus-visible:ring-emerald-500/50" 
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="portfolioUrl">Portfolio Website</Label>
          <Input 
            id="portfolioUrl" 
            name="portfolioUrl" 
            type="url" 
            value={formData.portfolioUrl} 
            onChange={handleChange} 
            placeholder="https://..." 
            className="bg-muted/50 border-border focus-visible:ring-emerald-500/50" 
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border/50">
        <Button onClick={handleSave} disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
