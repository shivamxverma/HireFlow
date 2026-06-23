import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { prisma } from "../services/prisma.js";
import { TelegramService } from "../services/telegram.service.js";

async function main() {
  const channelId = "-1003963315719";
  const title = "SDE Premium Group";
  
  console.log(`=== Adding "${title}" (${channelId}) to Monitored List ===`);
  
  const monitored = await prisma.telegramChannel.upsert({
    where: { channelId },
    update: { title },
    create: { channelId, title },
  });
  
  console.log("Database entry updated:", monitored);

  // Set date range for historical import (past 7 days)
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);

  console.log(`\nTriggering historical import for "${title}" from ${fromDate.toISOString()} to ${toDate.toISOString()}...`);
  
  try {
    const result = await TelegramService.importHistory(channelId, fromDate, toDate);
    console.log(`SUCCESS: Imported and enqueued ${result.importedCount} messages from "${title}".`);
  } catch (error) {
    console.error("Error during historical import:", error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
