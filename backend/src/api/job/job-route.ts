import { Router } from "express";
import { getHealth, getJobs, triggerCrawl, triggerCleanup } from "./job-controller.js";
import { requireAuth } from "../../shared/middleware.js";

export const jobRouter = Router();

jobRouter.get("/health", getHealth);
jobRouter.get("/api/v1/jobs", getJobs);
jobRouter.post("/jobs/trigger-crawl", requireAuth, triggerCrawl);
jobRouter.post("/jobs/trigger-cleanup", requireAuth, triggerCleanup);
