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
    const jobs = await prisma.job.findMany({
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        applications: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return jobs.map((job) => {
      const activeApp = job.applications?.[0];
      const effectiveStatus = activeApp?.status === "APPLIED" ? "Applied" : job.status;
      const effectiveAppliedAt = activeApp?.status === "APPLIED" ? activeApp.updatedAt : job.appliedAt;

      return {
        ...job,
        status: effectiveStatus,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        appliedAt: effectiveAppliedAt ? effectiveAppliedAt.toISOString() : null,
      };
    });
  }

  static triggerCrawl() {
    triggerFetchJob();
  }

  static triggerCleanup() {
    triggerCleanupJob();
  }
}
