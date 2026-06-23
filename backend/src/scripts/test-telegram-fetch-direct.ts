import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { TelegramService } from "../services/telegram.service.js";
import { GeminiService } from "../services/gemini.service.js";
import { prisma } from "../services/prisma.js";

const geminiService = new GeminiService();

async function main() {
  console.log("=== Direct Telegram Fetch & Extraction (Bypassing Redis Queue) ===");

  try {
    const client = await TelegramService.getClient();
    if (!client) {
      console.error("FAIL: Telegram client is not configured or failed to initialize.");
      return;
    }

    const monitoredChannels = await prisma.telegramChannel.findMany();
    console.log(`Found ${monitoredChannels.length} monitored channels in database.`);

    const dialogs = await client.getDialogs();

    for (const channel of monitoredChannels) {
      console.log(`\n--------------------------------------------------`);
      console.log(`Processing monitored channel: "${channel.title}" (${channel.channelId})...`);

      const matchingDialog = dialogs.find(
        (d) => d.id?.toString() === channel.channelId || d.entity?.id?.toString() === channel.channelId
      );

      if (!matchingDialog) {
        console.warn(`Channel "${channel.title}" not found in user's list. Skipping.`);
        continue;
      }

      console.log(`Fetching latest 3 messages from "${channel.title}"...`);
      const messages = await client.getMessages(matchingDialog.entity, {
        limit: 3,
      });

      console.log(`Fetched ${messages.length} messages.`);
      for (const msg of messages) {
        const text = msg.message || "";
        if (!text.trim()) {
          console.log(`- Message ID ${msg.id} is empty. Skipping.`);
          continue;
        }

        console.log(`\n- Message ID ${msg.id} Preview: ${text.substring(0, 100).replace(/\n/g, " ")}...`);
        console.log(`  Extracting job details using Azure OpenAI Responses API...`);

        try {
          const extracted = await geminiService.extractJobFromText(text);
          console.log(`  Extracted JSON:`, JSON.stringify(extracted, null, 2));
        } catch (err) {
          console.error(`  Extraction failed for message ${msg.id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error("Fetch and extract failed with error:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
