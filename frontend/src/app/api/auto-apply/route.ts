import { NextResponse } from "next/server";
import { autoApplyQueue } from "@/lib/queue";
import { UserProfileData } from "@/lib/auto-apply/mapping";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Mock profile for now until we wire up the full Prisma user auth
    const profile: UserProfileData = {
      fullName: "Shivam Verma",
      email: "shivam@example.com",
      phone: "+1 555-0198",
      location: "San Francisco, CA",
      linkedinUrl: "https://linkedin.com/in/shivamverma",
      githubUrl: "https://github.com/shivamverma",
      portfolioUrl: "https://shivam.dev",
      resumeUrl: "/Users/shivamverma/Desktop/resume.pdf", 
    };

    const job = await autoApplyQueue.add("auto-apply", {
      url,
      profile,
    });

    return NextResponse.json({ success: true, jobId: job.id });
  } catch (error: any) {
    console.error("Auto Apply API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
