import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { searchTelegramJobs } from "../connectors/telegram/index.js";
import { prisma } from "../services/prisma.js";

async function main() {
  console.log("=== Running Live Telegram Fetch & Extraction ===");
  try {
    const jobs = await searchTelegramJobs();
    console.log(`\n=== Fetch Completed. Returned ${jobs.length} jobs. ===`);
    console.log(JSON.stringify(jobs, null, 2));
  } catch (error) {
    console.error("Fetch failed:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
