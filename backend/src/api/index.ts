import { Router } from "express";
import { jobRouter } from "./job/job-route.js";

export const apiRouter = Router();

apiRouter.use(jobRouter);
