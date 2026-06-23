import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { prisma } from "../services/prisma.js";

async function main() {
  console.log("=== Listing Telegram Jobs in DB ===");
  const jobs = await prisma.job.findMany({
    where: {
      source: "telegram",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`Total Telegram Jobs: ${jobs.length}`);
  for (const job of jobs) {
    console.log(`- ID: ${job.id} | Title: ${job.title} | Company: ${job.company} | CreatedAt: ${job.createdAt}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
