import { prisma } from "../../services/prisma.js";
import { GeminiService } from "../../services/gemini.service.js";
import { EmailService } from "../../services/email.service.js";
import { GmailService } from "../../services/gmail.service.js";
import env from "../../config/index.js";

const geminiService = new GeminiService();
const emailService = new EmailService();
const gmailService = new GmailService();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class OutreachService {
  static getGmailAuthUrl(redirectUri: string) {
    return gmailService.getAuthUrl(redirectUri);
  }

  static async exchangeGmailCode(code: string, redirectUri: string) {
    await gmailService.exchangeCodeForTokens(code, redirectUri);
  }

  static async getGmailStatus() {
    const token = await prisma.googleToken.findUnique({ where: { id: "singleton" } });
    if (!token) {
      return { authenticated: false, email: null };
    }
    try {
      const accessToken = await gmailService.getValidAccessToken();
      const email = await gmailService.getAuthenticatedUserEmail(accessToken);
      return { authenticated: true, email };
    } catch (err) {
      return { authenticated: false, email: null };
    }
  }

  static async addLeads(userId: string, leadsData: any | any[]) {
    const leadsArray = Array.isArray(leadsData) ? leadsData : [leadsData];
    const validatedLeads = [];

    for (const lead of leadsArray) {
      const { companyName, recipientEmail, jobDescription } = lead;
      if (!companyName || !recipientEmail || !jobDescription) {
        throw new Error("Each lead must have companyName, recipientEmail, and jobDescription.");
      }
      validatedLeads.push({
        userId,
        companyName: companyName.trim(),
        recipientEmail: recipientEmail.trim().toLowerCase(),
        jobDescription: jobDescription.trim(),
        status: "READY",
      });
    }

    const createdLeads = await prisma.$transaction(
      validatedLeads.map((l) =>
        prisma.lead.create({
          data: {
            userId: l.userId,
            companyName: l.companyName,
            recipientEmail: l.recipientEmail,
            jobDescription: l.jobDescription,
            status: l.status,
          },
        })
      )
    );

    return createdLeads;
  }

  static async extractLeadFromImage(base64Image: string, mimeType: string) {
    let base64Data = base64Image;
    if (base64Image.includes("base64,")) {
      base64Data = base64Image.split("base64,")[1];
    }
    return await geminiService.extractLeadFromImage(base64Data, mimeType);
  }

  static async getLeads(userId: string) {
    return await prisma.lead.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async deleteLead(id: string) {
    await prisma.lead.delete({
      where: { id },
    });
  }

  static async updateMessage(id: string, subject: string, body: string) {
    return await prisma.message.update({
      where: { id },
      data: { subject, body },
    });
  }

  static async generateInitialEmails(userId: string) {
    const leads = await prisma.lead.findMany({
      where: { userId },
      include: {
        messages: {
          where: { type: "INITIAL" },
        },
      },
    });

    const pendingLeads = leads.filter((l) => l.messages.length === 0);

    if (pendingLeads.length === 0) {
      return { successCount: 0, failCount: 0, message: "All existing leads already have generated initial cold emails." };
    }

    console.log(`[Outreach Service] Starting bulk generation for ${pendingLeads.length} lead(s)...`);
    let successCount = 0;
    let failCount = 0;

    for (const lead of pendingLeads) {
      try {
        const generated = await geminiService.generateInitialEmail(
          lead.companyName,
          lead.jobDescription
        );

        await prisma.message.create({
          data: {
            leadId: lead.id,
            type: "INITIAL",
            subject: generated.subject,
            body: generated.body,
          },
        });

        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "READY" },
        });

        successCount++;
      } catch (err) {
        console.error(`[Outreach Service] Failed email generation for lead ${lead.companyName}:`, err);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "FAILED" },
        });
        failCount++;
      }
    }

    return { successCount, failCount, message: `Cold email generation complete. Success: ${successCount}, Failed: ${failCount}` };
  }

  static async sendSingleEmail(id: string) {
    let activeMessage = (await prisma.message.findUnique({
      where: { id },
      include: { lead: true },
    })) as any;

    if (!activeMessage) {
      const lead = (await prisma.lead.findUnique({
        where: { id },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
          },
        },
      })) as any;

      if (!lead || lead.messages.length === 0) {
        throw new Error("Lead or unsent message not found.");
      }

      const unsent = lead.messages.find((m: any) => !m.sentAt);
      if (!unsent) {
        throw new Error("No unsent email message found for this lead.");
      }
      activeMessage = { ...unsent, lead };
    }

    const lead = activeMessage.lead;

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "SENDING" },
    });

    try {
      const isFollowup = activeMessage.type.startsWith("FOLLOWUP_");
      let threadIdParam = undefined;
      let parentMsgIdParam = undefined;

      if (isFollowup) {
        threadIdParam = lead.threadId || undefined;
        const sentMessages = lead.messages.filter((m: any) => m.sentAt && m.gmailMessageId);
        sentMessages.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        parentMsgIdParam = sentMessages[0]?.gmailMessageId || undefined;
      }

      const result = await gmailService.sendEmail(
        lead.recipientEmail,
        activeMessage.subject,
        activeMessage.body,
        threadIdParam,
        parentMsgIdParam
      );

      await prisma.message.update({
        where: { id: activeMessage.id },
        data: { 
          sentAt: new Date(),
          gmailMessageId: result.gmailMessageId
        },
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: { 
          status: "SENT",
          threadId: result.threadId
        },
      });
    } catch (err) {
      console.error("[Outreach Service] Send failed:", err);
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "FAILED" },
      });
      throw err;
    }
  }

  static async sendAllReadyEmails(userId: string) {
    const leads = await prisma.lead.findMany({
      where: {
        userId,
        status: { in: ["READY", "FAILED"] },
      },
      include: {
        messages: {
          where: {
            type: "INITIAL",
            sentAt: null,
          },
        },
      },
    });

    let activeLeads = leads.filter((l) => l.messages.length > 0);

    if (activeLeads.length === 0) {
      return { sentCount: 0, infoMsg: "No unsent INITIAL emails ready to send.", requiresError: false };
    }

    const maxDailyEmails = env.MAX_DAILY_EMAILS || 50;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const emailsSentToday = await prisma.message.count({
      where: {
        sentAt: {
          gte: startOfToday,
        },
      },
    });

    const allowedToday = Math.max(0, maxDailyEmails - emailsSentToday);

    let infoMsg = "";
    if (activeLeads.length > allowedToday) {
      const skippedCount = activeLeads.length - allowedToday;
      console.warn(`[Outreach Service] Daily sending cap of ${maxDailyEmails} reached! Truncating from ${activeLeads.length} to ${allowedToday} emails.`);
      activeLeads = activeLeads.slice(0, allowedToday);
      infoMsg = ` Daily limit reached. Truncating send list to ${allowedToday} emails to protect reputation (skipped ${skippedCount}).`;
      
      if (allowedToday === 0) {
        return { sentCount: 0, infoMsg: `Daily sending limit of ${maxDailyEmails} reached. No more emails can be sent today.`, requiresError: true };
      }
    }

    // Run sequentially in background, returning status info immediately
    (async () => {
      for (let i = 0; i < activeLeads.length; i++) {
        const lead = activeLeads[i];
        const message = lead.messages[0];

        try {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "SENDING" },
          });

          const result = await gmailService.sendEmail(lead.recipientEmail, message.subject, message.body);

          await prisma.message.update({
            where: { id: message.id },
            data: { 
              sentAt: new Date(),
              gmailMessageId: result.gmailMessageId
            },
          });

          await prisma.lead.update({
            where: { id: lead.id },
            data: { 
              status: "SENT",
              threadId: result.threadId
            },
          });
        } catch (err) {
          console.error(`[Outreach Service] Sequential send failed for ${lead.companyName}:`, err);
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "FAILED" },
          });
        }

        if (i < activeLeads.length - 1) {
          const delay = 60000 + Math.random() * 120000;
          console.log(`[Outreach Service] Safe spacing active: pausing for ${(delay / 60000).toFixed(2)} minutes before the next email...`);
          await sleep(delay);
        }
      }
      console.log("[Outreach Service] Sequential cold outreach sending finished.");
    })().catch((err) => console.error("[Outreach Service] Critical sequential sending background exception:", err));

    return { sentCount: activeLeads.length, infoMsg, requiresError: false };
  }

  static async generateFollowups(leadIds: string[]) {
    console.log(`[Outreach Service] Starting manual follow-up generation for ${leadIds.length} lead(s)...`);
    let successCount = 0;
    let failCount = 0;

    for (const leadId of leadIds) {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          include: { messages: true },
        });

        if (!lead) {
          console.warn(`[Outreach Service] Lead ${leadId} not found.`);
          failCount++;
          continue;
        }

        const sentMessages = lead.messages.filter((m) => m.sentAt);
        const initialEmail = sentMessages.find((m) => m.type === "INITIAL");

        if (!initialEmail) {
          console.warn(`[Outreach Service] Lead ${lead.companyName} has not been sent an INITIAL email yet. Skipping.`);
          failCount++;
          continue;
        }

        const previousFollowups = sentMessages
          .filter((m) => m.type.startsWith("FOLLOWUP_"))
          .map((m) => m.body);

        const followupNumber = previousFollowups.length + 1;
        const followupType = `FOLLOWUP_${followupNumber}`;

        const alreadyGenerated = lead.messages.find((m) => m.type === followupType && !m.sentAt);
        if (alreadyGenerated) {
          console.log(`[Outreach Service] Follow-up ${followupType} already exists for ${lead.companyName}. Skipping.`);
          successCount++;
          continue;
        }

        const generated = await geminiService.generateFollowUpEmail(
          lead.companyName,
          lead.jobDescription,
          initialEmail.body,
          previousFollowups,
          followupNumber
        );

        await prisma.message.create({
          data: {
            leadId: lead.id,
            type: followupType,
            subject: generated.subject,
            body: generated.body,
          },
        });

        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "READY" },
        });

        successCount++;
      } catch (err) {
        console.error(`[Outreach Service] Failed follow-up generation for lead ID ${leadId}:`, err);
        failCount++;
      }
    }

    return { successCount, failCount };
  }

  static async sendFollowups(leadIds: string[]) {
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const sendableList = [];
    for (const lead of leads) {
      const unsentFollowup = lead.messages.find((m) => m.type.startsWith("FOLLOWUP_") && !m.sentAt);
      if (unsentFollowup) {
        sendableList.push({ lead, message: unsentFollowup });
      }
    }

    if (sendableList.length === 0) {
      return { sentCount: 0 };
    }

    // Run background queue
    (async () => {
      for (let i = 0; i < sendableList.length; i++) {
        const { lead, message } = sendableList[i];

        try {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "SENDING" },
          });

          const threadIdParam = lead.threadId || undefined;
          const sentMessages = lead.messages.filter((m: any) => m.sentAt && m.gmailMessageId);
          sentMessages.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const parentMsgIdParam = sentMessages[0]?.gmailMessageId || undefined;

          const result = await gmailService.sendEmail(
            lead.recipientEmail,
            message.subject,
            message.body,
            threadIdParam,
            parentMsgIdParam
          );

          await prisma.message.update({
            where: { id: message.id },
            data: { 
              sentAt: new Date(),
              gmailMessageId: result.gmailMessageId
            },
          });

          await prisma.lead.update({
            where: { id: lead.id },
            data: { 
              status: "SENT",
              threadId: result.threadId
            },
          });
        } catch (err) {
          console.error(`[Outreach Service] Sequential send failed for followup at ${lead.companyName}:`, err);
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: "FAILED" },
          });
        }

        if (i < sendableList.length - 1) {
          const delay = 2000 + Math.random() * 3000;
          await sleep(delay);
        }
      }
      console.log("[Outreach Service] Sequential follow-up email sending finished.");
    })().catch((err) => console.error("[Outreach Service] Background sequential followup sending crash:", err));

    return { sentCount: sendableList.length };
  }
}
