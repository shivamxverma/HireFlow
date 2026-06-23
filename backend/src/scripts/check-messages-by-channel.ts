import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { prisma } from "../services/prisma.js";

async function main() {
  console.log("=== Telegram Messages Grouped by Channel ===");
  const counts = await prisma.telegramMessage.groupBy({
    by: ["channelName", "channelId"],
    _count: { id: true },
  });

  console.log("Ingested messages count by channel in DB:");
  for (const c of counts) {
    console.log(`- Channel: "${c.channelName}" | ID: ${c.channelId} | Message Count: ${c._count.id}`);
  }

  console.log("\n=== Checking Monitored Channels vs Messages Ingested ===");
  const monitoredChannels = await prisma.telegramChannel.findMany();
  for (const mc of monitoredChannels) {
    const count = await prisma.telegramMessage.count({
      where: { channelId: mc.channelId },
    });
    console.log(`- Monitored: "${mc.title}" | ID: ${mc.channelId} | Ingested Messages: ${count}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
