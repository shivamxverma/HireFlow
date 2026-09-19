import { prisma } from "../../services/prisma.js";
import { triggerFetchJob } from "../../scheduler/fetch.scheduler.js";
import { triggerCleanupJob } from "../../scheduler/cleanup.scheduler.js";

export class JobService {
  static async getHealthData() {
    await prisma.$queryRaw`SELECT 1`;
    const totalJobs = await prisma.job.count();
    const jobsBySource = await prisma.job.groupBy({
      by: ["source"],
      _count: {
        id: true,
      },
    });

    return {
      connected: true,
      totalJobs,
      jobsBySource,
    };
  }

  static async getAllJobs() {
    return prisma.job.findMany({
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
    });
  }

  static triggerCrawl() {
    triggerFetchJob();
  }

  static triggerCleanup() {
    triggerCleanupJob();
  }
}
