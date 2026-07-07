import { Express } from "express";
import { verifyDatabaseConnection } from "./postgres.js";
import { initTelegram } from "./telegram.js";
import { initWorkers } from "./workers.js";
import { initExpress } from "./express.js";
import { triggerFetchJob } from "../scheduler/fetch.scheduler.js";

export default async function loaders({ expressApp }: { expressApp: Express }): Promise<void> {
  console.log("=== RUNNING SYSTEM LOADERS ===");

  // 1. Verify DB Connection
  await verifyDatabaseConnection();

  // 2. Initialize Telegram listener
  await initTelegram();

  // 3. Initialize background workers
  initWorkers();

  // 4. Initialize Express setups
  initExpress({ expressApp });

  // 5. Trigger one-time platform crawl on startup
  console.log("[Bootstrap] Running one-time platform crawl on startup.");
  try {
    await triggerFetchJob();
  } catch (error) {
    console.error("[Bootstrap] Failed to run initial job fetch crawl:", error);
  }
  
  console.log("[Bootstrap] Automatic schedulers are disabled. Use the manual trigger endpoints when you want to fetch or clean jobs.");
  console.log("=== LOADERS LOADED SUCCESSFULLY ===");
}
