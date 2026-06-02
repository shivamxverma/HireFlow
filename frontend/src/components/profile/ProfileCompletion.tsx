"use client";

import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";

export function ProfileCompletion() {
  // Mock data for completion status
  const sections = [
    { name: "Personal Information", completed: true },
    { name: "Professional Information", completed: true },
    { name: "Experience", completed: false },
    { name: "Education", completed: true },
    { name: "Skills", completed: false },
    { name: "Resume Uploaded", completed: true },
  ];

  const completedCount = sections.filter(s => s.completed).length;
  const percentage = Math.round((completedCount / sections.length) * 100);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-lg backdrop-blur-xs">
      <div className="flex justify-between items-end mb-3">
        <h3 className="text-sm font-medium text-foreground">Profile Completion</h3>
        <span className="text-2xl font-bold text-foreground">{percentage}%</span>
      </div>
      
      <Progress value={percentage} className="h-2 mb-5 bg-muted hover:bg-muted/80" />
      
      <div className="space-y-2.5">
        {sections.map((section, idx) => (
          <div key={idx} className="flex items-center gap-3 text-sm">
            {section.completed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground" />
            )}
            <span className={section.completed ? "text-foreground" : "text-muted-foreground"}>
              {section.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
