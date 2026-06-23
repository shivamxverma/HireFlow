import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { prisma } from "../services/prisma.js";

async function main() {
  console.log("=== Checking Telegram Messages Status & Errors ===");
  
  // 1. Get unique error messages
  const failedMessages = await prisma.telegramMessage.findMany({
    where: { errorMessage: { not: null } },
    select: { status: true, errorMessage: true, channelName: true },
    take: 50,
  });

  const errorCounts: Record<string, number> = {};
  for (const msg of failedMessages) {
    const err = msg.errorMessage || "Unknown";
    errorCounts[err] = (errorCounts[err] || 0) + 1;
  }

  console.log("\nError Message Counts:");
  console.log(errorCounts);

  // 2. Look at a few unprocessed messages
  const unprocessed = await prisma.telegramMessage.findMany({
    where: { processed: false, status: "UNPROCESSED" },
    select: { id: true, channelName: true, messageText: true, createdAt: true },
    take: 5,
  });

  console.log(`\nUnprocessed Messages (Total Unprocessed Sample of ${unprocessed.length}):`);
  for (const msg of unprocessed) {
    console.log(`- ID: ${msg.id} | Channel: ${msg.channelName} | Created: ${msg.createdAt}`);
    console.log(`  Text preview: ${msg.messageText.substring(0, 150).replace(/\n/g, " ")}...`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
