import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { prisma } from "../services/prisma.js";
import { telegramExtractionQueue } from "../queues/queue.js";

async function main() {
  console.log("=== Enqueuing Unprocessed Telegram Messages ===");

  const unprocessed = await prisma.telegramMessage.findMany({
    where: {
      processed: false,
    },
    select: { id: true, channelName: true },
  });

  if (unprocessed.length === 0) {
    console.log("No unprocessed messages found in the database.");
    return;
  }

  console.log(`Found ${unprocessed.length} unprocessed messages.`);
  
  const jobs = unprocessed.map((msg) => ({
    name: "reprocess",
    data: { rawMessageId: msg.id },
  }));

  console.log("Adding jobs to telegram-extraction queue...");
  await telegramExtractionQueue.addBulk(jobs);
  console.log(`Successfully enqueued ${jobs.length} messages.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await telegramExtractionQueue.close();
    process.exit(0);
  });
