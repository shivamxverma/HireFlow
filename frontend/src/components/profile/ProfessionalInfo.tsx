"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";

export function ProfessionalInfo() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentRole: "Software Engineer",
    currentCompany: "Tech Corp",
    experienceYears: "5",
    currentSalary: "$120,000",
    expectedSalary: "$150,000",
    noticePeriod: "30 Days",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (value: string) => {
    setFormData({ ...formData, noticePeriod: value });
  };

  const handleSave = async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Professional Information</h2>
        <p className="text-sm text-muted-foreground">Update your current role, salary expectations, and availability.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="currentRole">Current Role</Label>
          <Input id="currentRole" name="currentRole" value={formData.currentRole} onChange={handleChange} placeholder="e.g. Frontend Developer" className="bg-muted/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentCompany">Current Company</Label>
          <Input id="currentCompany" name="currentCompany" value={formData.currentCompany} onChange={handleChange} placeholder="e.g. Google" className="bg-muted/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="experienceYears">Total Experience (Years)</Label>
          <Input id="experienceYears" name="experienceYears" type="number" value={formData.experienceYears} onChange={handleChange} placeholder="e.g. 3" className="bg-muted/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="noticePeriod">Notice Period</Label>
          <Select value={formData.noticePeriod} onValueChange={handleSelectChange}>
            <SelectTrigger className="bg-muted/50 border-border">
              <SelectValue placeholder="Select notice period" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="Immediate">Immediate</SelectItem>
              <SelectItem value="15 Days">15 Days</SelectItem>
              <SelectItem value="30 Days">30 Days</SelectItem>
              <SelectItem value="60 Days">60 Days</SelectItem>
              <SelectItem value="90 Days">90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentSalary">Current Salary</Label>
          <Input id="currentSalary" name="currentSalary" value={formData.currentSalary} onChange={handleChange} placeholder="e.g. $100k" className="bg-muted/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expectedSalary">Expected Salary</Label>
          <Input id="expectedSalary" name="expectedSalary" value={formData.expectedSalary} onChange={handleChange} placeholder="e.g. $120k" className="bg-muted/50 border-border" />
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
