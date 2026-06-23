import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { TelegramService } from "../services/telegram.service.js";
import { GeminiService } from "../services/gemini.service.js";

const geminiService = new GeminiService();

async function main() {
  console.log("=== Testing Extraction on Last 15 Messages of SDE Premium Group ===");

  try {
    const client = await TelegramService.getClient();
    if (!client) {
      console.error("FAIL: Telegram client is not configured or failed to initialize.");
      return;
    }

    const targetChannelId = "-1003963315719";
    const dialogs = await client.getDialogs();
    const matchingDialog = dialogs.find(
      (d) => d.id?.toString() === targetChannelId || d.entity?.id?.toString() === targetChannelId
    );

    if (!matchingDialog) {
      console.error(`Target channel SDE Premium Group (${targetChannelId}) not found in dialogs.`);
      return;
    }

    console.log(`Fetching latest 15 messages from "${matchingDialog.title}"...`);
    const messages = await client.getMessages(matchingDialog.entity, {
      limit: 15,
    });

    console.log(`Fetched ${messages.length} messages. Processing extraction...\n`);

    for (const msg of messages) {
      const text = msg.message || "";
      console.log(`--------------------------------------------------`);
      console.log(`Message ID: ${msg.id} | Date: ${new Date(msg.date * 1000).toISOString()}`);
      
      if (!text.trim()) {
        console.log(`Message is empty or has no text content. Skipping extraction.`);
        continue;
      }

      console.log(`Message Preview: ${text.substring(0, 120).replace(/\n/g, " ")}...`);
      console.log(`Calling extraction...`);
      
      try {
        const extracted = await geminiService.extractJobFromText(text);
        console.log(`Extracted JSON:`, JSON.stringify(extracted, null, 2));
      } catch (err: any) {
        console.error(`Extraction failed: ${err.message || String(err)}`);
      }
      
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 200));
    }

  } catch (error) {
    console.error("Failed to run extraction test:", error);
  } finally {
    process.exit(0);
  }
}

main();
