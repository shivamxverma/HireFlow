import { TelegramService } from "../../services/telegram.service.js";
import { prisma } from "../../services/prisma.js";
import { GeminiService } from "../../services/gemini.service.js";
import crypto from "crypto";
import type { Job } from "../types.js";

const geminiService = new GeminiService();

function isExperienceSuitableForFresher(expStr: string | null | undefined): boolean {
  if (!expStr) return true; // Default to true if not specified
  const lower = expStr.toLowerCase().trim();
  if (
    lower.includes("fresher") ||
    lower.includes("intern") ||
    lower.includes("graduate") ||
    lower.includes("entry") ||
    lower.includes("0-1") ||
    lower.includes("0 to 1")
  ) {
    return true;
  }

  // Extract numbers
  const matches = lower.match(/\d+/g);
  if (matches) {
    const numbers = matches.map(Number);
    // If the minimum required experience is > 1, then it's not suitable
    const minExp = Math.min(...numbers);
    if (minExp > 1) {
      return false;
    }
  }
  return true;
}

export async function searchTelegramJobs(): Promise<Job[]> {
  try {
    console.log("[Telegram Connector] Starting job scraping pipeline...");

    // 1. Get monitored channels from database
    const monitoredChannels = await prisma.telegramChannel.findMany();
    if (monitoredChannels.length === 0) {
      console.log("[Telegram Connector] No monitored channels configured in database. Skipping.");
      return [];
    }

    // 2. Initialize Telegram Client
    const client = await TelegramService.getClient();
    if (!client) {
      console.warn("[Telegram Connector] Telegram Client is not initialized or credentials are missing. Skipping.");
      return [];
    }

    // Compute the fromDate for the last 3.5 hours (to allow 3 hour cron with 30 min overlap safety)
    const fromDate = new Date(Date.now() - 3.5 * 60 * 60 * 1000);
    const fromUnix = Math.floor(fromDate.getTime() / 1000);

    console.log(`[Telegram Connector] Fetching user dialogs to resolve ${monitoredChannels.length} monitored channels...`);
    const dialogs = await client.getDialogs();
    const normalizedJobs: Job[] = [];

    for (const channel of monitoredChannels) {
      const channelId = channel.channelId;
      console.log(`[Telegram Connector] Processing channel "${channel.title}" (${channelId})...`);

      const matchingDialog = dialogs.find(
        (d) => d.id?.toString() === channelId || d.entity?.id?.toString() === channelId
      );

      if (!matchingDialog) {
        console.warn(`[Telegram Connector] Monitored channel/group "${channel.title}" (${channelId}) not found in joined user dialogs. Skipping.`);
        continue;
      }

      const entity = matchingDialog.entity;
      const channelTitle = matchingDialog.title || channel.title;

      let offsetId = 0;
      let hasMore = true;
      const channelMessages: any[] = [];

      while (hasMore) {
        const messages: any[] = await client.getMessages(entity, {
          limit: 50,
          offsetId: offsetId,
        });

        if (!messages || messages.length === 0) {
          break;
        }

        for (const message of messages) {
          offsetId = message.id; // page backward
          const msgDateUnix = message.date;

          // If message is older than 3.5 hours, stop paging backward for this channel
          if (msgDateUnix < fromUnix) {
            hasMore = false;
            break;
          }

          const rawText = message.message || "";
          if (!rawText.trim()) continue;

          channelMessages.push(message);
        }

        // Respect Telegram API limits
        await new Promise((r) => setTimeout(r, 200));
      }

      console.log(`[Telegram Connector] Fetched ${channelMessages.length} messages from "${channelTitle}" since ${fromDate.toISOString()}`);

      for (const message of channelMessages) {
        const rawText = message.message || "";
        try {
          // Store raw message in DB if not already present
          const rawMessage = await prisma.telegramMessage.upsert({
            where: {
              channelId_messageId: {
                channelId: channelId,
                messageId: message.id,
              },
            },
            update: {},
            create: {
              channelId: channelId,
              channelName: channelTitle,
              messageId: message.id,
              messageText: rawText,
              postedAt: new Date(message.date * 1000),
              processed: false,
              status: "UNPROCESSED",
            },
          });

          // Only process and extract if status is UNPROCESSED (or newly created)
          if (rawMessage.status === "UNPROCESSED" && !rawMessage.processed) {
            console.log(`[Telegram Connector] Extracting job from message ID ${message.id} in "${channelTitle}"...`);
            
            // Respect API rate limits
            await new Promise((resolve) => setTimeout(resolve, 200));

            const extracted = await geminiService.extractJobFromText(rawText);
            const { company, role, apply_url: applyUrl, location, salary, job_description: description } = extracted;

            const titleLower = channelTitle.toLowerCase();
            const isSdePremium = titleLower.includes("sde premium");
            const isTechJobs = titleLower.includes("tech jobs") && (titleLower.includes("fresher") || titleLower.includes("exp"));

            // 1. Basic validation (company and role are always required)
            if (!company || !role) {
              const errorMsg = `Validation failed: ${!company ? "company " : ""}${!role ? "role " : ""}is missing.`;
              console.warn(`[Telegram Connector] Message ID ${message.id} validation failed: ${errorMsg}`);
              
              await prisma.telegramMessage.update({
                where: { id: rawMessage.id },
                data: {
                  processed: true,
                  status: "REJECTED",
                  errorMessage: errorMsg,
                },
              });
              continue;
            }

            // 2. applyUrl validation
            let finalApplyUrl = applyUrl ? applyUrl.trim() : "";
            
            if (isSdePremium) {
              // SDE Premium Group: apply_url is optional. If it's an email address, prepend mailto:
              if (finalApplyUrl) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (emailRegex.test(finalApplyUrl)) {
                  finalApplyUrl = `mailto:${finalApplyUrl}`;
                }
              }
            } else {
              // Other groups: apply_url is required
              if (!finalApplyUrl) {
                const errorMsg = "Validation failed: apply_url is missing.";
                console.warn(`[Telegram Connector] Message ID ${message.id} validation failed: ${errorMsg}`);
                
                await prisma.telegramMessage.update({
                  where: { id: rawMessage.id },
                  data: {
                    processed: true,
                    status: "REJECTED",
                    errorMessage: errorMsg,
                  },
                });
                continue;
              }
            }

            // 3. Experience check for "Tech Jobs: Freshers & Exp | Off Campus"
            if (isTechJobs) {
              const expStr = extracted.experience || "";
              if (!isExperienceSuitableForFresher(expStr)) {
                const skipMsg = `Skipped: Job requires experience (${expStr}) beyond 0-1 year range.`;
                console.info(`[Telegram Connector] Message ID ${message.id} skipped: ${skipMsg}`);
                
                await prisma.telegramMessage.update({
                  where: { id: rawMessage.id },
                  data: {
                    processed: true,
                    status: "REJECTED",
                    errorMessage: skipMsg,
                  },
                });
                continue;
              }
            }

            // Deduplication (fingerprint hash)
            // Use finalApplyUrl in the fingerprint raw calculation. If finalApplyUrl is empty, use empty string.
            const fingerprintRaw = `${company.trim().toLowerCase()}|${role.trim().toLowerCase()}|${finalApplyUrl.trim().toLowerCase()}`;
            const fingerprintHash = crypto.createHash("sha256").update(fingerprintRaw).digest("hex");

            const existingJob = await prisma.job.findFirst({
              where: { fingerprint: fingerprintHash },
            });

            if (existingJob) {
              console.log(`[Telegram Connector] Duplicate job found (ID: ${existingJob.id}) for fingerprint. Skipping.`);
              await prisma.telegramMessage.update({
                where: { id: rawMessage.id },
                data: {
                  processed: true,
                  status: "SKIPPED_DUPLICATE",
                },
              });
              continue;
            }

            const derivedExternalId = `telegram-${channelId}-${message.id}`;
            const notesText = JSON.stringify({
              channelName: channelTitle,
              postedAt: new Date(message.date * 1000).toISOString(),
            });

            normalizedJobs.push({
              source: "telegram",
              externalId: derivedExternalId,
              title: role,
              company: company,
              location: location || "Remote",
              salary: salary || undefined,
              applyUrl: finalApplyUrl || null,
              experienceLevel: extracted.experience || undefined,
              
              // Custom fields for ingestion mapping
              fingerprint: fingerprintHash,
              telegramMessageId: message.id.toString(),
              telegramChannelId: channelId,
              notes: notesText,
            });

            // Update raw message status
            await prisma.telegramMessage.update({
              where: { id: rawMessage.id },
              data: {
                processed: true,
                status: "PROCESSED",
                errorMessage: null,
              },
            });
            
            console.log(`[Telegram Connector] Successfully extracted job: "${role}" at "${company}"`);
          }
        } catch (msgErr: any) {
          console.error(`[Telegram Connector] Error processing message ${message.id} from "${channelTitle}":`, msgErr);
        }
      }
    }

    return normalizedJobs;
  } catch (error) {
    console.error("[Telegram Connector] Telegram connector failed:", error);
    throw error;
  }
}
