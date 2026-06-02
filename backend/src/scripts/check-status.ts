import { prisma } from "../services/prisma.js";

async function main() {
  const total = await prisma.telegramMessage.count();
  const byStatusAndProcessed = await prisma.telegramMessage.groupBy({
    by: ["status", "processed"],
    _count: { id: true }
  });
  const withError = await prisma.telegramMessage.count({
    where: { errorMessage: { not: null } }
  });

  console.log("Total messages:", total);
  console.log("By status and processed:", byStatusAndProcessed);
  console.log("With errorMessage:", withError);
}

main().catch(console.error).finally(() => prisma.$disconnect());
