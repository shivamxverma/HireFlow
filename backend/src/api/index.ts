import { Router } from "express";
import { authRouter } from "./auth/auth-route.js";
import { outreachRouter } from "./outreach/outreach-route.js";
import { outreachFlowRouter } from "./outreach-flow/outreach-flow-route.js";
import { linkedinOutreachRouter } from "./linkedin-outreach/linkedin-outreach-route.js";
import { telegramRouter } from "./telegram/telegram-route.js";
import { jobRouter } from "./job/job-route.js";

export const apiRouter = Router();

// Mount resources
apiRouter.use("/api/v1/auth", authRouter);
apiRouter.use(outreachRouter);
apiRouter.use(outreachFlowRouter);
apiRouter.use(linkedinOutreachRouter);
apiRouter.use(telegramRouter);
apiRouter.use(jobRouter);
