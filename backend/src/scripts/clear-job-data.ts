import { prisma } from "../services/prisma.js";

async function main() {
  console.log("=== Clearing job data ===");

  const applicationCount = await prisma.application.count();
  const resumeVersionCount = await prisma.resumeVersion.count();
  const jobCount = await prisma.job.count();
  const telegramMessageCount = await prisma.telegramMessage.count();

  await prisma.$transaction([
    prisma.resumeVersion.deleteMany(),
    prisma.application.deleteMany(),
    prisma.job.deleteMany(),
    prisma.telegramMessage.deleteMany(),
  ]);

  console.log(`Deleted ${resumeVersionCount} resume versions.`);
  console.log(`Deleted ${applicationCount} applications.`);
  console.log(`Deleted ${jobCount} jobs.`);
  console.log(`Deleted ${telegramMessageCount} telegram messages.`);
}

main()
  .catch((error) => {
    console.error("Failed to clear job data:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
