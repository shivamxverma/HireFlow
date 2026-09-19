import { Router } from "express";
import { getHealth, getJobs, triggerCrawl, triggerCleanup } from "./job-controller.js";

export const jobRouter = Router();

jobRouter.get("/health", getHealth);
jobRouter.get("/api/v1/jobs", getJobs);
jobRouter.post("/jobs/trigger-crawl", triggerCrawl);
jobRouter.post("/jobs/trigger-cleanup", triggerCleanup);
