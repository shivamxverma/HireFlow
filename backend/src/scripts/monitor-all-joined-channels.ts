import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { prisma } from "../services/prisma.js";
import { TelegramService } from "../services/telegram.service.js";

async function main() {
  const daysBackArg = Number(process.argv[2] ?? "3");
  const daysBack = Number.isFinite(daysBackArg) && daysBackArg > 0 ? daysBackArg : 3;

  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

  console.log("=== Monitoring All Joined Telegram Channels ===");
  console.log(`Import window: ${fromDate.toISOString()} -> ${toDate.toISOString()}`);

  const joinedChannels = await TelegramService.getJoinedChannels();
  console.log(`Found ${joinedChannels.length} joined channels/groups.`);

  let monitoredCount = 0;
  let importedCount = 0;
  let failureCount = 0;

  for (const channel of joinedChannels) {
    try {
      const monitored = await prisma.telegramChannel.upsert({
        where: { channelId: channel.id },
        update: {
          title: channel.title,
          username: channel.username,
        },
        create: {
          channelId: channel.id,
          title: channel.title,
          username: channel.username,
        },
      });

      monitoredCount += 1;
      console.log(`Monitoring: ${monitored.title} (${monitored.channelId})`);

      const result = await TelegramService.importHistory(channel.id, fromDate, toDate);
      importedCount += result.importedCount;
      console.log(`Imported ${result.importedCount} message(s) from ${channel.title}`);
    } catch (error) {
      failureCount += 1;
      console.error(`Failed for ${channel.title} (${channel.id}):`, error);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Monitored channels: ${monitoredCount}`);
  console.log(`Imported messages: ${importedCount}`);
  console.log(`Failures: ${failureCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
