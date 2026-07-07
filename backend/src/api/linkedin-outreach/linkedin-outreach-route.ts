import { Router } from "express";
import {
  getStatus,
  connectLinkedin,
  importCookies,
  generateColdNote,
  extractProfileFile,
  sendLinkedinMessages
} from "./linkedin-outreach-controller.js";
import { requireAuth, requireSendAuth } from "../../shared/middleware.js";

export const linkedinOutreachRouter = Router();

linkedinOutreachRouter.use(requireAuth);

linkedinOutreachRouter.get("/outreach/linkedin/status", getStatus);
linkedinOutreachRouter.get("/outreach/linkedin/connect", connectLinkedin);
linkedinOutreachRouter.post("/outreach/linkedin/import-cookies", importCookies);
linkedinOutreachRouter.post("/outreach/linkedin/generate", generateColdNote);
linkedinOutreachRouter.post("/outreach/linkedin/extract-file", extractProfileFile);
linkedinOutreachRouter.post("/outreach/linkedin/send", requireSendAuth, sendLinkedinMessages);
