import { prisma } from "../../services/prisma.js";
import { EmailService } from "../../services/email.service.js";
import { GeminiService } from "../../services/gemini.service.js";
import { outreachQueue } from "../../queues/queue.js";
import env from "../../config/index.js";
// @ts-ignore
import { PDFParse } from "pdf-parse";

const emailService = new EmailService();
const geminiService = new GeminiService();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class OutreachFlowService {
  static async seedDefaultTemplates() {
    const count = await prisma.template.count();
    if (count === 0) {
      console.log("[OutreachFlow Service] Seeding default templates...");
      await prisma.template.createMany({
        data: [
          {
            name: "Direct Referral Request",
            type: "REFERRAL",
            prompt: "Write a polite, warm, and highly personalized referral request. State the role you are applying to, map your exact matching technical skills and B.Tech CSE background to the job description, and explain why you'd be a great fit. Make it easy for the employee to say yes and refer you.",
            active: true,
          },
          {
            name: "Informational Networking",
            type: "NETWORKING",
            prompt: "Write a friendly, professional networking request. Express curiosity about their career trajectory, ask for high-level technical guidance or industry advice, and seek to schedule a brief informational discussion. Avoid asking for a referral directly.",
            active: true,
          },
          {
            name: "Profile & Resume Feedback",
            type: "FEEDBACK",
            prompt: "Write a humble, specific message requesting feedback on your projects or resume profile. Briefly reference a shared technical area or project, explain that you are seeking to optimize your skills, and politely ask if they could review your profile.",
            active: true,
          },
          {
            name: "Startup Founder & CTO Outreach",
            type: "FOUNDER",
            prompt: "Write a high-signal startup-focused outreach message to a founder or CTO. Reference the company's mission and engineering challenges, highlight a matching high-impact project you have built, and express a strong desire to discuss potential opportunities.",
            active: true,
          },
        ],
      });
    }
  }

  static async getResumes() {
    return await prisma.resume.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  static async parseAndUploadResume(title: string, pdfBase64: string) {
    console.log(`[OutreachFlow Service] Parsing uploaded PDF resume: ${title}...`);
    const base64Data = pdfBase64.includes("base64,") ? pdfBase64.split("base64,")[1] : pdfBase64;
    const buffer = Buffer.from(base64Data, "base64");

    const pdfParser = new PDFParse({ data: buffer });
    const parsedTextResult = await pdfParser.getText();
    const parsedText = parsedTextResult.text || "";

    if (!parsedText.trim()) {
      throw new Error("Failed to extract text from PDF resume.");
    }

    console.log(`[OutreachFlow Service] Extracting structural skills from resume text...`);
    const skillsPrompt = `Analyze the following candidate resume text.
Extract a clean JSON array of the technical skills, frameworks, programming languages, and tools mentioned.
Format your output as a single, valid JSON array of strings:
[
  "TypeScript",
  "React",
  "Node.js"
]
Do NOT return markdown blocks. Output only the JSON.

Resume:
${parsedText}`;

    const extractRes = await geminiService.generateOutreachMessage(
      { name: "Parser", role: "Extractor", company: "System" },
      { parsedText: parsedText, skills: [] },
      null,
      skillsPrompt,
      "FEEDBACK"
    );

    let skills: string[] = [];
    try {
      skills = JSON.parse(extractRes.body);
    } catch (e) {
      skills = parsedText.match(/[A-Za-z+#.0-9]+/g)?.slice(0, 15) || [];
    }

    const resume = await prisma.resume.create({
      data: {
        title,
        parsedText,
        skills: Array.isArray(skills) ? skills : [],
      },
    });

    return resume;
  }

  static async deleteResume(id: string) {
    await prisma.resume.delete({ where: { id } });
  }

  static async getProfiles(userId: string) {
    return await prisma.profile.findMany({
      where: {
        OR: [
          { userId },
          { userId: "admin-api-key" },
        ],
      },
      include: {
        outboundMessages: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async importProfiles(userId: string, profilesData: any | any[]) {
    const profilesList = Array.isArray(profilesData) ? profilesData : [profilesData];
    const created = [];

    for (const p of profilesList) {
      const { name, role, company, companyUrl, linkedinUrl, email, notes, tags, source } = p;
      if (!name) {
        continue;
      }

      const finalRole = role ? role.trim() : "LinkedIn profile";
      const finalCompany = company ? company.trim() : "Unknown";

      const tagsArray = Array.isArray(tags) 
        ? tags 
        : typeof tags === "string" 
          ? tags.split(",").map((t: string) => t.trim()).filter(Boolean)
          : [];

      const normalizedLinkedinUrl = linkedinUrl ? linkedinUrl.trim() : null;
      const existingProfile = normalizedLinkedinUrl
        ? await prisma.profile.findFirst({
            where: {
              userId,
              linkedinUrl: normalizedLinkedinUrl,
            },
          })
        : null;

      const profile = existingProfile
        ? await prisma.profile.update({
            where: { id: existingProfile.id },
            data: {
              name: name.trim(),
              role: finalRole,
              company: finalCompany,
              companyUrl: companyUrl ? companyUrl.trim() : existingProfile.companyUrl,
              email: email ? email.trim().toLowerCase() : existingProfile.email,
              notes: notes ? notes.trim() : existingProfile.notes,
              tags: tagsArray.length > 0 ? Array.from(new Set([...existingProfile.tags, ...tagsArray])) : existingProfile.tags,
              source: source || existingProfile.source,
            },
          })
        : await prisma.profile.create({
            data: {
              userId,
              name: name.trim(),
              role: finalRole,
              company: finalCompany,
              companyUrl: companyUrl ? companyUrl.trim() : null,
              linkedinUrl: normalizedLinkedinUrl,
              email: email ? email.trim().toLowerCase() : null,
              notes: notes ? notes.trim() : null,
              tags: tagsArray,
              source: source || (profilesList.length > 1 ? "BULK_IMPORT" : "MANUAL"),
            },
          });
      created.push(profile);
    }

    return created;
  }

  static async deleteProfile(id: string) {
    await prisma.profile.delete({ where: { id } });
  }

  static async getManualJobs() {
    return await prisma.job.findMany({
      where: {
        platform: "MANUAL_ENTRY",
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createManualJob(title: string, company: string, description?: string, link?: string) {
    return await prisma.job.create({
      data: {
        source: "manual",
        externalId: `manual-${Date.now()}`,
        title,
        company,
        location: "Remote",
        applyUrl: link || null,
        description: description || null,
        platform: "MANUAL_ENTRY",
        status: "Manual",
      },
    });
  }

  static async deleteManualJob(id: string) {
    await prisma.job.delete({ where: { id } });
  }

  static async getTemplates() {
    return await prisma.template.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  static async upsertTemplate(id: string | undefined, name: string, type: string, prompt: string, active?: boolean) {
    if (id) {
      return await prisma.template.update({
        where: { id },
        data: { name, type, prompt, active: active ?? true },
      });
    } else {
      return await prisma.template.create({
        data: { name, type, prompt, active: active ?? true },
      });
    }
  }

  static async getQueueStatus() {
    return await prisma.generationJob.findMany({
      include: {
        profile: true,
        template: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  static async dispatchGenerations(profileIds: string[], resumeId: string, templateId: string, jobId?: string) {
    console.log(`[OutreachFlow Service] Dispatched BullMQ bulk outreach message generation for ${profileIds.length} profiles...`);
    const createdGenJobs = [];

    for (const profileId of profileIds) {
      const genJob = await prisma.generationJob.create({
        data: {
          profileId,
          resumeId,
          templateId,
          jobId: jobId || null,
          status: "PENDING",
        },
      });

      await outreachQueue.add(
        "outreach-generation-task",
        { generationJobId: genJob.id },
        {
          attempts: 2,
          removeOnComplete: true,
        }
      );

      createdGenJobs.push(genJob);
    }

    return createdGenJobs;
  }

  static async getApprovalQueue() {
    return await prisma.outboundMessage.findMany({
      where: { status: "DRAFT" },
      include: {
        profile: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async editDraft(id: string, subject: string, content: string) {
    return await prisma.outboundMessage.update({
      where: { id },
      data: {
        subject,
        content,
        status: "EDTIED", // Maintain exact db spelling state
      },
    });
  }

  static async approveDraft(id: string) {
    return await prisma.outboundMessage.update({
      where: { id },
      data: { status: "APPROVED" },
    });
  }

  static async rejectDraft(id: string) {
    return await prisma.outboundMessage.update({
      where: { id },
      data: { status: "REJECTED" },
    });
  }

  static async getOutboxMessages() {
    return await prisma.outboundMessage.findMany({
      include: {
        profile: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async sendApprovedOutbox() {
    const messages = await prisma.outboundMessage.findMany({
      where: {
        status: { in: ["APPROVED", "PENDING", "EDTIED"] },
      },
      include: {
        profile: true,
      },
    });

    let activeList = messages.filter((m) => m.profile.email);

    if (activeList.length === 0) {
      return { sentCount: 0, infoMsg: "No approved messages with email addresses found in outbox.", requiresError: false };
    }

    const maxDailyEmails = env.MAX_DAILY_EMAILS || 50;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const emailsSentToday = await prisma.outboundMessage.count({
      where: {
        status: "SENT",
        sentAt: {
          gte: startOfToday,
        },
      },
    });

    const allowedToday = Math.max(0, maxDailyEmails - emailsSentToday);

    let infoMsg = "";
    if (activeList.length > allowedToday) {
      const skippedCount = activeList.length - allowedToday;
      console.warn(`[OutreachFlow Service] Daily sending cap of ${maxDailyEmails} reached! Truncating from ${activeList.length} to ${allowedToday} emails.`);
      activeList = activeList.slice(0, allowedToday);
      infoMsg = ` Daily limit reached. Truncating outbox send list to ${allowedToday} emails to protect reputation (skipped ${skippedCount}).`;
      
      if (allowedToday === 0) {
        return { sentCount: 0, infoMsg: `Daily sending limit of ${maxDailyEmails} reached. No more emails can be sent today.`, requiresError: true };
      }
    }

    // Run sequentially in background
    (async () => {
      for (let i = 0; i < activeList.length; i++) {
        const msg = activeList[i];
        try {
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "SENDING" },
          });

          await emailService.sendEmail(msg.profile.email!, msg.subject, msg.content);

          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
            },
          });

          await prisma.conversationTracker.upsert({
            where: { profileId: msg.profileId },
            update: { lastContactedAt: new Date() },
            create: {
              profileId: msg.profileId,
              status: "ACTIVE",
              lastContactedAt: new Date(),
            },
          });
        } catch (err) {
          console.error(`[OutreachFlow Service] Outbox send failed for profile ${msg.profile.name}:`, err);
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "FAILED" },
          });
        }

        if (i < activeList.length - 1) {
          const delay = 60000 + Math.random() * 120000;
          console.log(`[OutreachFlow Service] Safe spacing active: pausing for ${(delay / 60000).toFixed(2)} minutes before the next email...`);
          await sleep(delay);
        }
      }
      console.log("[OutreachFlow Service] Outbox dispatch complete.");
    })().catch((err) => console.error("Outbox background executor error:", err));

    return { sentCount: activeList.length, infoMsg, requiresError: false };
  }

  static async getAnalytics() {
    const totalProfiles = await prisma.profile.count();
    const totalGenerated = await prisma.outboundMessage.count();
    const approvedCount = await prisma.outboundMessage.count({
      where: { status: { in: ["APPROVED", "SENT", "PENDING"] } },
    });
    const sentCount = await prisma.outboundMessage.count({
      where: { status: "SENT" },
    });
    const failedCount = await prisma.outboundMessage.count({
      where: { status: "FAILED" },
    });

    const conversationStats = await prisma.conversationTracker.findMany();
    const repliesCount = conversationStats.filter((c) => c.replyReceived).length;
    const positiveReplies = conversationStats.filter((c) => c.positiveResponse).length;

    const replyRate = sentCount > 0 ? Math.round((repliesCount / sentCount) * 100) : 0;
    const positiveReplyRate = repliesCount > 0 ? Math.round((positiveReplies / repliesCount) * 100) : 0;

    return {
      totalProfiles,
      totalGenerated,
      approvedCount,
      sentCount,
      failedCount,
      repliesCount,
      positiveReplies,
      replyRate,
      positiveReplyRate,
      referralsReceived: Math.round(positiveReplies * 0.7),
      interviewsScheduled: Math.round(positiveReplies * 0.4),
    };
  }
}
