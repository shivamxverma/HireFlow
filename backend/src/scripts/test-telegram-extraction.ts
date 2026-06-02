import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { prisma } from "../services/prisma.js";
import { telegramExtractionQueue } from "../queues/queue.js";
import { telegramExtractionWorker } from "../queues/telegram-extraction.worker.js";

async function main() {
  console.log("=== Testing Telegram Job Ingestion Pipeline ===");

  // 1. Create mock message text
  const mockMessageText = `
    We are hiring!
    Company: TechCorp India
    Role: Backend Developer (Node.js/TypeScript)
    Location: Bangalore, India (Hybrid)
    Salary: ₹12,00,000 - ₹18,00,000 per annum
    Skills: Node.js, TS, Express, PostgreSQL, Redis
    Job Type: Full-time
    Apply here: https://techcorp.jobs/apply/backend-dev-123
    
    Responsibilities include building APIs and background task queues.
  `;

  // 2. Save raw message
  console.log("Saving raw mock message to database...");
  const mockMessageId = Math.floor(Math.random() * 1000000);
  const rawMsg = await prisma.telegramMessage.create({
    data: {
      channelId: "test-channel-123",
      channelName: "Test Jobs India",
      messageId: mockMessageId,
      messageText: mockMessageText,
      processed: false,
      status: "UNPROCESSED",
      postedAt: new Date(),
    },
  });

  console.log(`Saved mock message with DB ID: ${rawMsg.id}`);

  // 3. Push to queue
  console.log("Adding extraction task to BullMQ telegramExtractionQueue...");
  const job = await telegramExtractionQueue.add("test-extract", {
    rawMessageId: rawMsg.id,
  });
  console.log(`Task enqueued. Job ID: ${job.id}`);

  // 4. Wait and poll status
  console.log("Polling database for raw message status updates (max 30 seconds)...");
  let attempts = 0;
  let success = false;
  while (attempts < 15) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts++;

    const updatedMsg = await prisma.telegramMessage.findUnique({
      where: { id: rawMsg.id },
    });

    console.log(`[Attempt ${attempts}] Status: ${updatedMsg?.status}, Error: ${updatedMsg?.errorMessage || "None"}`);

    if (updatedMsg?.processed) {
      if (updatedMsg.status === "PROCESSED") {
        console.log("Success! Message marked as PROCESSED.");
        success = true;
      } else {
        console.log(`Message processed but status is: ${updatedMsg.status}`);
      }
      break;
    }
  }

  if (success) {
    // Verify if Job was created
    const derivedExternalId = `telegram-test-channel-123-${mockMessageId}`;
    const jobRecord = await prisma.job.findFirst({
      where: { externalId: derivedExternalId },
    });

    if (jobRecord) {
      console.log("\n=== Extracted Job Record found in DB ===");
      console.log("ID:", jobRecord.id);
      console.log("Company:", jobRecord.company);
      console.log("Role:", jobRecord.title);
      console.log("Location:", jobRecord.location);
      console.log("Salary:", jobRecord.salary);
      console.log("Apply URL:", jobRecord.applyUrl);
      console.log("Fingerprint Hash:", jobRecord.fingerprint);
      console.log("=========================================\n");
      console.log("Deduplication test: Enqueueing same message again...");

      // Enqueue same message to test deduplication
      const rawMsgDup = await prisma.telegramMessage.create({
        data: {
          channelId: "test-channel-123",
          channelName: "Test Jobs India",
          messageId: mockMessageId + 1, // different message ID
          messageText: mockMessageText, // same text
          processed: false,
          status: "UNPROCESSED",
          postedAt: new Date(),
        },
      });

      console.log(`Enqueued duplicate message with DB ID: ${rawMsgDup.id}`);
      await telegramExtractionQueue.add("test-extract-dup", {
        rawMessageId: rawMsgDup.id,
      });

      // Poll duplicate msg
      let dupAttempts = 0;
      let dupSuccess = false;
      while (dupAttempts < 10) {
        await new Promise((r) => setTimeout(r, 2000));
        dupAttempts++;
        const updatedMsgDup = await prisma.telegramMessage.findUnique({
          where: { id: rawMsgDup.id },
        });
        console.log(`[Duplicate Attempt ${dupAttempts}] Status: ${updatedMsgDup?.status}`);
        if (updatedMsgDup?.processed) {
          if (updatedMsgDup.status === "SKIPPED_DUPLICATE") {
            console.log("Success! Duplicate message correctly SKIPPED_DUPLICATE.");
            dupSuccess = true;
          } else {
            console.error("FAIL: Duplicate message was not skipped!");
          }
          break;
        }
      }

      // Cleanup test records
      console.log("Cleaning up test records...");
      await prisma.job.deleteMany({
        where: { telegramChannelId: "test-channel-123" },
      });
      await prisma.telegramMessage.deleteMany({
        where: { channelId: "test-channel-123" },
      });
      console.log("Cleanup finished.");

      if (dupSuccess) {
        console.log("\n>>> ALL TEST PASSED SUCCESSFULLY <<<");
      }
    } else {
      console.error("FAIL: Job record was not found in database.");
    }
  } else {
    console.error("FAIL: Pipeline timed out or message failed processing.");
  }

  try {
    await telegramExtractionWorker.close();
    await telegramExtractionQueue.close();
  } catch (closeErr) {
    console.warn("Warning closing connections:", closeErr);
  }

  process.exit(0);
}

main().catch(async (err) => {
  console.error("Test failed with error:", err);
  try {
    await telegramExtractionWorker.close();
    await telegramExtractionQueue.close();
  } catch (closeErr) {}
  process.exit(1);
});
