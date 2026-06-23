import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { prisma } from "../services/prisma.js";

async function main() {
  console.log("=== Monitored Telegram Channels ===");
  const channels = await prisma.telegramChannel.findMany();
  console.log(`Count: ${channels.length}`);
  for (const c of channels) {
    console.log(`- Title: ${c.title} | Channel ID: ${c.channelId} | Username: ${c.username}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
