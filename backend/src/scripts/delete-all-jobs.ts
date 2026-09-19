import { prisma } from "../services/prisma.js";

const confirmationFlag = "--confirm";

async function main() {
  if (!process.argv.includes(confirmationFlag)) {
    console.error(
      `Refusing to delete jobs. Run: pnpm delete:all-jobs ${confirmationFlag}`,
    );
    process.exitCode = 1;
    return;
  }

  const jobCount = await prisma.job.count();
  console.log(`Deleting ${jobCount} job(s)...`);

  const result = await prisma.job.deleteMany();
  console.log(`Deleted ${result.count} job(s).`);
}

main()
  .catch((error) => {
    console.error("Failed to delete jobs:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
