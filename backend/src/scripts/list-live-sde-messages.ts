import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { TelegramService } from "../services/telegram.service.js";

async function main() {
  console.log("=== Listing Live Messages from SDE Premium Group ===");

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

    console.log(`Fetched ${messages.length} messages.\n`);
    for (const msg of messages) {
      console.log(`==================================================`);
      console.log(`Message ID: ${msg.id} | Date: ${new Date(msg.date * 1000).toISOString()}`);
      console.log(`Message Text:`);
      console.log(msg.message || "[EMPTY / SERVICE MESSAGE / MEDIA WITHOUT CAPTION]");
      console.log(`==================================================\n`);
    }

  } catch (error) {
    console.error("Failed to list messages:", error);
  } finally {
    process.exit(0);
  }
}

main();
