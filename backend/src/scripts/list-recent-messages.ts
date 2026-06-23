import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { prisma } from "../services/prisma.js";

async function main() {
  console.log("=== Listing Recent Telegram Messages ===");
  const messages = await prisma.telegramMessage.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  console.log(`Recent messages (Count: ${messages.length}):`);
  for (const msg of messages) {
    console.log(`- ID: ${msg.id}`);
    console.log(`  Channel: ${msg.channelName}`);
    console.log(`  Message ID: ${msg.messageId}`);
    console.log(`  Status: ${msg.status} | Processed: ${msg.processed}`);
    console.log(`  Posted At: ${msg.postedAt}`);
    console.log(`  Ingested At (createdAt): ${msg.createdAt}`);
    console.log(`  Error: ${msg.errorMessage}`);
    console.log(`  Preview: ${msg.messageText.substring(0, 100).replace(/\n/g, " ")}...`);
    console.log("---");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
