import { prisma } from "@/lib/prisma";
import { normalizeJobUrl } from "@/lib/job-url";
import type { Job } from "@/types/job";

export async function listJobs(): Promise<Job[]> {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        applications: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    return jobs.map((job) => {
      const activeApp = job.applications?.[0];
      const effectiveStatus = activeApp?.status === "APPLIED" ? "Applied" : job.status;
      const effectiveAppliedAt = activeApp?.status === "APPLIED" ? activeApp.updatedAt : job.appliedAt;

      // Omit applications from the returned Job object to match types, or ignore it if types complain.
      // But actually, we just spread it. The frontend might not care about applications array.
      return {
        ...job,
        status: effectiveStatus,
        applyUrl: job.applyUrl ? normalizeJobUrl(job.source, job.applyUrl) : null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        appliedAt: effectiveAppliedAt ? effectiveAppliedAt.toISOString() : null,
      };
    });
  } catch (error) {
    console.error("[listJobs Error] Database query failed:", error);
    return [];
  }
}
