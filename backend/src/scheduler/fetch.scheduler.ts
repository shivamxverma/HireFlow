import { runAllConnectors } from "../services/connector-runner.js";

const FETCH_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 Hours
let isRunning = false;
let timerId: NodeJS.Timeout | null = null;

/**
 * Triggers the job aggregation pipeline.
 * Incorporates overlap protection to prevent parallel crawl threads.
 */
export async function triggerFetchJob(): Promise<void> {
  if (isRunning) {
    console.warn("[Fetch Scheduler] Crawl cycle requested, but previous cycle is still active. Skipping to prevent collision.");
    return;
  }

  isRunning = true;
  const startTime = new Date();
  console.log(`\n=== [Fetch Scheduler] Triggered Job Ingestion at ${startTime.toISOString()} ===`);

  try {
    const stats = await runAllConnectors();
    const duration = ((Date.now() - startTime.getTime()) / 1000).toFixed(1);
    console.log(`=== [Fetch Scheduler] Job Ingestion Complete. Duration: ${duration}s. Fetched: ${stats.totalFetched}, Saved/Updated: ${stats.upserted}, Failures: ${stats.failed} ===\n`);
  } catch (error) {
    console.error("=== [Fetch Scheduler] Job Ingestion Pipeline encountered an uncaught error:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the interval-based scheduler for fetching jobs.
 */
export function startFetchScheduler(runImmediately: boolean = true): void {
  if (timerId) {
    console.warn("[Fetch Scheduler] Scheduler is already running. Ignoring start request.");
    return;
  }

  console.log(`[Fetch Scheduler] Initialized. Run Interval: every 3 hours (${FETCH_INTERVAL_MS}ms).`);

  if (runImmediately) {
    // Run immediately on boot to ensure immediate database sync
    triggerFetchJob();
  }

  timerId = setInterval(() => {
    triggerFetchJob();
  }, FETCH_INTERVAL_MS);
}

/**
 * Stops the scheduler interval cleanly.
 */
export function stopFetchScheduler(): void {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log("[Fetch Scheduler] Stopped successfully.");
  }
}
