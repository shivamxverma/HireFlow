import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { TelegramService } from "../services/telegram.service.js";

async function main() {
  console.log("=== Testing Telegram Client Connection ===");

  try {
    const client = await TelegramService.getClient();
    if (!client) {
      console.error("FAIL: Telegram client is not configured or failed to initialize.");
      return;
    }

    console.log("Client connected. Checking authentication status...");
    const me = await client.getMe();
    console.log("Success! Authenticated as:", me.username || me.firstName || me.id);

    console.log("\nFetching dialogs (joined groups/channels)...");
    const channels = await TelegramService.getJoinedChannels();
    console.log(`Found ${channels.length} joined channels/groups.`);
    
    // Print first 5 joined channels
    console.log("First 5 joined channels:");
    for (const c of channels.slice(0, 5)) {
      console.log(`- Title: ${c.title} | ID: ${c.id} | Username: ${c.username}`);
    }

    // Try fetching recent messages from a channel (e.g. Opportunities - -1001856597251)
    const targetChannelId = "-1001856597251";
    console.log(`\nAttempting to fetch latest 3 messages from channel ${targetChannelId}...`);
    
    const dialogs = await client.getDialogs();
    const matchingDialog = dialogs.find(
      (d) => d.id?.toString() === targetChannelId || d.entity?.id?.toString() === targetChannelId
    );

    if (!matchingDialog) {
      console.warn(`Target channel ${targetChannelId} not found in dialogs.`);
      return;
    }

    const messages = await client.getMessages(matchingDialog.entity, {
      limit: 3,
    });

    console.log(`Fetched ${messages.length} messages:`);
    for (const msg of messages) {
      console.log(`- Message ID: ${msg.id} | Date: ${new Date(msg.date * 1000)}`);
      console.log(`  Preview: ${msg.message?.substring(0, 100).replace(/\n/g, " ")}...`);
    }

  } catch (error) {
    console.error("Test failed with error:", error);
  }
}

main().catch(console.error).finally(() => process.exit(0));
