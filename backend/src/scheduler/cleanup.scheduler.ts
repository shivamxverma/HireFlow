import { prisma } from "../services/prisma.js";

const CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 Hours
const EXPIRATION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days (720 Hours)
let timerId: NodeJS.Timeout | null = null;

/**
 * Triggers the database cleanup query.
 * Deletes all jobs where lastSeenAt < 30 days ago.
 */
export async function triggerCleanupJob(): Promise<void> {
  const cutoffDate = new Date(Date.now() - EXPIRATION_PERIOD_MS);
  console.log(`\n=== [Cleanup Scheduler] Triggering database purge of stale jobs (not seen since ${cutoffDate.toISOString()}) ===`);

  try {
    const result = await prisma.job.deleteMany({
      where: {
        lastSeenAt: {
          lt: cutoffDate,
        },
      },
    });
    console.log(`=== [Cleanup Scheduler] Purge completed successfully. Removed ${result.count} stale job listings. ===\n`);
  } catch (error) {
    console.error("=== [Cleanup Scheduler] Stale job database purge failed:", error);
  }
}

/**
 * Starts the interval-based scheduler for cleaning up stale jobs.
 */
export function startCleanupScheduler(runImmediately: boolean = true): void {
  if (timerId) {
    console.warn("[Cleanup Scheduler] Scheduler is already running. Ignoring start request.");
    return;
  }

  console.log(`[Cleanup Scheduler] Initialized. Run Interval: every 12 hours (${CLEANUP_INTERVAL_MS}ms). Threshold: 30 days (${EXPIRATION_PERIOD_MS}ms).`);

  if (runImmediately) {
    // Run immediately on boot to clear out any old records right away
    triggerCleanupJob();
  }

  timerId = setInterval(() => {
    triggerCleanupJob();
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stops the scheduler interval cleanly.
 */
export function stopCleanupScheduler(): void {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log("[Cleanup Scheduler] Stopped successfully.");
  }
}
