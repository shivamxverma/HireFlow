"use client";

import { ProfileCompletion } from "@/components/profile/ProfileCompletion";
import { PersonalInfo } from "@/components/profile/PersonalInfo";
import { ProfessionalInfo } from "@/components/profile/ProfessionalInfo";
import { EducationList } from "@/components/profile/EducationList";
import { ExperienceList } from "@/components/profile/ExperienceList";
import { SkillTags } from "@/components/profile/SkillTags";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import { ApplicationPreferences } from "@/components/profile/ApplicationPreferences";
import { PredefinedAnswers } from "@/components/profile/PredefinedAnswers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProfilePage() {
  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">User Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal information, experience, and preferences for Auto Apply.
          </p>
        </div>
        <div className="w-full md:w-64">
          <ProfileCompletion />
        </div>
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 h-auto mb-8 bg-muted/50 p-1 rounded-xl backdrop-blur-sm border border-border">
          <TabsTrigger value="personal" className="py-2.5 rounded-lg data-[state=active]:bg-muted hover:bg-muted/80 data-[state=active]:text-foreground">Personal</TabsTrigger>
          <TabsTrigger value="professional" className="py-2.5 rounded-lg data-[state=active]:bg-muted hover:bg-muted/80 data-[state=active]:text-foreground">Professional</TabsTrigger>
          <TabsTrigger value="education" className="py-2.5 rounded-lg data-[state=active]:bg-muted hover:bg-muted/80 data-[state=active]:text-foreground">Education</TabsTrigger>
          <TabsTrigger value="experience" className="py-2.5 rounded-lg data-[state=active]:bg-muted hover:bg-muted/80 data-[state=active]:text-foreground">Experience</TabsTrigger>
          <TabsTrigger value="skills" className="py-2.5 rounded-lg data-[state=active]:bg-muted hover:bg-muted/80 data-[state=active]:text-foreground">Skills</TabsTrigger>
          <TabsTrigger value="resume" className="py-2.5 rounded-lg data-[state=active]:bg-muted hover:bg-muted/80 data-[state=active]:text-foreground">Resume</TabsTrigger>
          <TabsTrigger value="preferences" className="py-2.5 rounded-lg data-[state=active]:bg-muted hover:bg-muted/80 data-[state=active]:text-foreground">Preferences</TabsTrigger>
          <TabsTrigger value="answers" className="py-2.5 rounded-lg data-[state=active]:bg-muted hover:bg-muted/80 data-[state=active]:text-foreground">Answers</TabsTrigger>
        </TabsList>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-xl shadow-black/50">
          <TabsContent value="personal" className="mt-0 outline-none">
            <PersonalInfo />
          </TabsContent>
          <TabsContent value="professional" className="mt-0 outline-none">
            <ProfessionalInfo />
          </TabsContent>
          <TabsContent value="education" className="mt-0 outline-none">
            <EducationList />
          </TabsContent>
          <TabsContent value="experience" className="mt-0 outline-none">
            <ExperienceList />
          </TabsContent>
          <TabsContent value="skills" className="mt-0 outline-none">
            <SkillTags />
          </TabsContent>
          <TabsContent value="resume" className="mt-0 outline-none">
            <ResumeUpload />
          </TabsContent>
          <TabsContent value="preferences" className="mt-0 outline-none">
            <ApplicationPreferences />
          </TabsContent>
          <TabsContent value="answers" className="mt-0 outline-none">
            <PredefinedAnswers />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
