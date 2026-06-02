"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SkillTags() {
  const [skills, setSkills] = useState(["React", "Next.js", "TypeScript"]);
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (!skills.includes(inputValue.trim())) {
        setSkills([...skills, inputValue.trim()]);
      }
      setInputValue("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Skills</h2>
        <p className="text-sm text-muted-foreground">Add technologies and skills you are proficient in.</p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a skill and press Enter..." 
            className="pl-9 bg-muted/50 border-border h-11 text-base focus-visible:ring-emerald-500/50"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-4 border-t border-border/50">
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills added yet.</p>
          ) : (
            skills.map((skill) => (
              <Badge 
                key={skill} 
                variant="secondary" 
                className="bg-muted hover:bg-muted/80 hover:bg-zinc-700 text-foreground px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 transition-colors"
              >
                {skill}
                <button 
                  onClick={() => removeSkill(skill)}
                  className="hover:bg-zinc-600 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
