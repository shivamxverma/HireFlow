import { Worker } from "bullmq";
import { redisConnectionOptions } from "./queue.js";
import { prisma } from "../services/prisma.js";
import { GeminiService } from "../services/gemini.service.js";
import crypto from "crypto";

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

export const telegramExtractionWorker = new Worker(
  "telegram-extraction",
  async (job) => {
    const { rawMessageId } = job.data;
    console.log(`[Telegram Extraction Worker] Processing job ${job.id} for raw message ${rawMessageId}`);

    const rawMessage = await prisma.telegramMessage.findUnique({
      where: { id: rawMessageId },
    });

    if (!rawMessage) {
      console.error(`[Telegram Extraction Worker] Message ${rawMessageId} not found in database.`);
      return;
    }

    if (rawMessage.processed) {
      console.log(`[Telegram Extraction Worker] Message ${rawMessageId} is already processed. Skipping.`);
      return;
    }

    try {
      // 1. Extract using Gemini
      console.log(`[Telegram Extraction Worker] Sleeping 12000ms to respect Gemini API rate limits...`);
      await new Promise((resolve) => setTimeout(resolve, 12000));

      console.log(`[Telegram Extraction Worker] Sending message text to Gemini for extraction...`);
      const extracted = await geminiService.extractJobFromText(rawMessage.messageText);
      console.log(`[Telegram Extraction Worker] Gemini response received for message ${rawMessageId}:`, JSON.stringify(extracted));

      // 2. Validate
      const { company, role, apply_url: applyUrl, location, salary, job_description: description } = extracted;

      const titleLower = (rawMessage.channelName || "").toLowerCase();
      const isSdePremium = titleLower.includes("sde premium");
      const isTechJobs = titleLower.includes("tech jobs") && (titleLower.includes("fresher") || titleLower.includes("exp"));

      // 2.1 Basic validation (company and role are always required)
      if (!company || !role) {
        const errorMsg = `Validation failed: ${!company ? "company " : ""}${!role ? "role " : ""}is missing.`;
        console.warn(`[Telegram Extraction Worker] Message ${rawMessageId} failed validation: ${errorMsg}`);
        
        await prisma.telegramMessage.update({
          where: { id: rawMessageId },
          data: {
            processed: true,
            status: "REJECTED",
            errorMessage: errorMsg,
          },
        });
        return;
      }

      // 2.2 applyUrl validation
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
          console.warn(`[Telegram Extraction Worker] Message ${rawMessageId} failed validation: ${errorMsg}`);
          
          await prisma.telegramMessage.update({
            where: { id: rawMessageId },
            data: {
              processed: true,
              status: "REJECTED",
              errorMessage: errorMsg,
            },
          });
          return;
        }
      }

      // 2.3 Experience check for "Tech Jobs: Freshers & Exp | Off Campus"
      if (isTechJobs) {
        const expStr = extracted.experience || "";
        if (!isExperienceSuitableForFresher(expStr)) {
          const skipMsg = `Skipped: Job requires experience (${expStr}) beyond 0-1 year range.`;
          console.info(`[Telegram Extraction Worker] Message ${rawMessageId} skipped: ${skipMsg}`);
          
          await prisma.telegramMessage.update({
            where: { id: rawMessageId },
            data: {
              processed: true,
              status: "REJECTED",
              errorMessage: skipMsg,
            },
          });
          return;
        }
      }

      // 3. Deduplication (Fingerprint hash)
      const fingerprintRaw = `${company.trim().toLowerCase()}|${role.trim().toLowerCase()}|${finalApplyUrl.trim().toLowerCase()}`;
      const fingerprintHash = crypto.createHash("sha256").update(fingerprintRaw).digest("hex");

      const existingJob = await prisma.job.findFirst({
        where: { fingerprint: fingerprintHash },
      });

      if (existingJob) {
        console.log(`[Telegram Extraction Worker] Duplicate job found (ID: ${existingJob.id}) for fingerprint. Skipping insertion.`);
        await prisma.telegramMessage.update({
          where: { id: rawMessageId },
          data: {
            processed: true,
            status: "SKIPPED_DUPLICATE",
          },
        });
        return;
      }

      // 4. Job Storage
      const derivedExternalId = `telegram-${rawMessage.channelId}-${rawMessage.messageId}`;
      
      await prisma.job.create({
        data: {
          source: "telegram",
          externalId: derivedExternalId,
          title: role,
          company: company,
          location: location || "Remote",
          salary: salary || null,
          applyUrl: finalApplyUrl || null,
          description: description || null,
          fingerprint: fingerprintHash,
          telegramMessageId: rawMessage.messageId.toString(),
          telegramChannelId: rawMessage.channelId,
          notes: JSON.stringify({
            channelName: rawMessage.channelName,
            postedAt: rawMessage.postedAt.toISOString(),
          }),
        },
      });

      // 5. Update raw message status
      await prisma.telegramMessage.update({
        where: { id: rawMessageId },
        data: {
          processed: true,
          status: "PROCESSED",
          errorMessage: null, // Clear any previous errors
        },
      });

      console.log(`[Telegram Extraction Worker] Job successfully extracted and saved in jobs table.`);
    } catch (error: any) {
      console.error(`[Telegram Extraction Worker] Error processing message ${rawMessageId}:`, error);
      await prisma.telegramMessage.update({
        where: { id: rawMessageId },
        data: {
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      throw error; // Re-throw to let BullMQ handle retries
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: 1, // Process sequentially to respect Gemini API rate limits
  }
);
