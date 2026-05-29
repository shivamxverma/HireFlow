import { prisma } from "./services/prisma.js";

async function main() {
  try {
    const totalJobs = await prisma.job.count();
    const jobsBySource = await prisma.job.groupBy({
      by: ['source'],
      _count: {
        id: true,
      },
    });

    const recentJobs = await prisma.job.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log("=== DB STATS ===");
    console.log("Total Jobs:", totalJobs);
    console.log("By Source:", JSON.stringify(jobsBySource, null, 2));
    console.log("\n=== RECENT JOBS ===");
    recentJobs.forEach((job, index) => {
      console.log(`${index + 1}. [${job.source.toUpperCase()}] ${job.title} at ${job.company} (${job.location}) - Salary: ${job.salary || "N/A"}`);
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
