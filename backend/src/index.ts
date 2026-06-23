import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "./services/prisma.js";
import { triggerFetchJob } from "./scheduler/fetch.scheduler.js";
import { triggerCleanupJob } from "./scheduler/cleanup.scheduler.js";
import { resumeWorker } from "./queues/resume.worker.js";
import { applyWorker } from "./queues/apply.worker.js";
import { outreachWorker } from "./queues/outreach.worker.js";
import { telegramExtractionWorker } from "./queues/telegram-extraction.worker.js";
import { outreachRouter } from "./routes/outreach.routes.js";
import { outreachFlowRouter } from "./routes/outreach-flow.routes.js";
import { linkedinOutreachRouter } from "./routes/linkedin-outreach.routes.js";
import { telegramRouter } from "./routes/telegram.routes.js";
import authRouter from "./routes/auth.routes.js";
import { requireAuth } from "./routes/auth.middleware.js";
import { TelegramService } from "./services/telegram.service.js";


const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend API calls and support secure HTTP-only cookies (credentials)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, bypass-tunnel-reminder");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  console.log(`[Express] Incoming Request: ${req.method} ${req.url}`);
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/api/v1/auth", authRouter);
app.use(outreachRouter);
app.use(outreachFlowRouter);
app.use(linkedinOutreachRouter);
app.use(telegramRouter);



/**
 * Health Check & Status Endpoint
 * Returns statistics about the database and reports service health status.
 */
app.get("/health", async (req, res) => {
  try {
    // 1. Verify Database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // 2. Query total job count in Neon Postgres
    const totalJobs = await prisma.job.count();
    const jobsBySource = await prisma.job.groupBy({
      by: ["source"],
      _count: {
        id: true,
      },
    });

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        totalJobs,
        bySource: jobsBySource,
      },
      automation: {
        mode: "manual",
        fetchTriggerEndpoint: "POST /jobs/trigger-crawl",
        cleanupTriggerEndpoint: "POST /jobs/trigger-cleanup",
      },
    });
  } catch (error) {
    console.error("[Health Check] Database or check sequence failed:", error);
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/v1/jobs", async (req, res) => {
  try {
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

    res.status(200).json({
      success: true,
      message: "Jobs fetched successfully.",
      data: {
        jobs: jobs.map((job) => {
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
        }),
      },
      meta: {
        total: jobs.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Jobs API] Failed to fetch jobs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch jobs.",
    });
  }
});

/**
 * Manual Trigger Endpoints (for testing & admin manual overrides)
 */
app.post("/jobs/trigger-crawl", requireAuth, async (req, res) => {
  try {
    console.log("[Admin API] Manual fetch crawl triggered via POST /jobs/trigger-crawl.");
    // Run asynchronously to avoid blocking the HTTP response
    triggerFetchJob();
    res.status(202).json({
      message: "Job fetching pipeline triggered in background.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to trigger pipeline" });
  }
});

app.post("/jobs/trigger-cleanup", requireAuth, async (req, res) => {
  try {
    console.log("[Admin API] Manual stale job cleanup triggered via POST /jobs/trigger-cleanup.");
    // Run asynchronously to avoid blocking the HTTP response
    triggerCleanupJob();
    res.status(202).json({
      message: "Stale job database cleanup triggered in background.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to trigger cleanup" });
  }
});


/**
 * Start Server
 */
async function bootstrap() {
  console.log("=== STARTING JOB AGGREGATOR ENGINE ===");

  try {
    // Start Express health checking server
    app.listen(PORT, () => {
      console.log(`[Express Health Server] Listening and active on port ${PORT}`);
      console.log(`[Express Health Server] Endpoint check: http://localhost:${PORT}/health`);
      console.log(`[Express Health Server] Initializing background workers...`);
      console.log(`[Express Health Server] Resume Worker active: ${resumeWorker.name}`);
      console.log(`[Express Health Server] Apply Worker active: ${applyWorker.name}`);
      console.log(`[Express Health Server] Outreach Worker active: ${outreachWorker.name}`);
      console.log(`[Express Health Server] Telegram Extraction Worker active: ${telegramExtractionWorker.name}`);
    });

    // Start Telegram real-time listener
    await TelegramService.startListener();
    await TelegramService.syncRecentMonitoredChannels();

    console.log("[Bootstrap] Running one-time platform crawl on startup.");
    await triggerFetchJob();
    console.log("[Bootstrap] Automatic schedulers are disabled. Use the manual trigger endpoints when you want to fetch or clean jobs.");

  } catch (error) {
    console.error("[Bootstrap Error] Critical system failure during bootstrapping:", error);
    process.exit(1);
  }
}

bootstrap();
