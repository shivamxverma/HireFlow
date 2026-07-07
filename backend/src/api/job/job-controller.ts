import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { JobService } from "./job-service.js";

export const getHealth = asyncHandler(async (req: Request, res: Response) => {
  const healthData = await JobService.getHealthData();
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: healthData,
    automation: {
      mode: "manual",
      fetchTriggerEndpoint: "POST /jobs/trigger-crawl",
      cleanupTriggerEndpoint: "POST /jobs/trigger-cleanup",
    },
  });
});

export const getJobs = asyncHandler(async (req: Request, res: Response) => {
  const jobs = await JobService.getAllJobs();
  res.status(200).json({
    ...new ApiResponse(200, { jobs }, "Jobs fetched successfully."),
    meta: {
      total: jobs.length,
      fetchedAt: new Date().toISOString(),
    },
  });
});

export const triggerCrawl = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Admin API] Manual fetch crawl triggered via POST /jobs/trigger-crawl.");
  JobService.triggerCrawl();
  res.status(202).json(
    new ApiResponse(202, { timestamp: new Date().toISOString() }, "Job fetching pipeline triggered in background.")
  );
});

export const triggerCleanup = asyncHandler(async (req: Request, res: Response) => {
  console.log("[Admin API] Manual stale job cleanup triggered via POST /jobs/trigger-cleanup.");
  JobService.triggerCleanup();
  res.status(202).json(
    new ApiResponse(202, { timestamp: new Date().toISOString() }, "Stale job database cleanup triggered in background.")
  );
});
