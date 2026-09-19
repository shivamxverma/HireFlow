import { Router } from "express";
import { authRouter } from "./auth/auth-route.js";
import { jobRouter } from "./job/job-route.js";

export const apiRouter = Router();

// Mount resources
apiRouter.use("/api/v1/auth", authRouter);
apiRouter.use(jobRouter);
