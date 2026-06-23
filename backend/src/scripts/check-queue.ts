import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { telegramExtractionQueue } from "../queues/queue.js";

async function main() {
  console.log("=== Checking BullMQ Telegram Extraction Queue Status ===");
  
  const [waiting, active, delayed, failed, completed] = await Promise.all([
    telegramExtractionQueue.getWaitingCount(),
    telegramExtractionQueue.getActiveCount(),
    telegramExtractionQueue.getDelayedCount(),
    telegramExtractionQueue.getFailedCount(),
    telegramExtractionQueue.getCompletedCount(),
  ]);

  console.log("Queue counts:");
  console.log(`- Waiting: ${waiting}`);
  console.log(`- Active: ${active}`);
  console.log(`- Delayed: ${delayed}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Completed: ${completed}`);

  // Fetch some failed jobs
  const failedJobs = await telegramExtractionQueue.getFailed(0, 10);
  console.log(`\nSample of failed jobs (${failedJobs.length}):`);
  for (const job of failedJobs) {
    console.log(`- Job ID: ${job.id} | Name: ${job.name} | Failed Reason: ${job.failedReason}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await telegramExtractionQueue.close();
    process.exit(0);
  });
