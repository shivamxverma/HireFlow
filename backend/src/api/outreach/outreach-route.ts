import { Router } from "express";
import {
  verifyPasscode,
  connectGoogle,
  googleCallback,
  googleStatus,
  addLeads,
  extractImage,
  getLeads,
  deleteLead,
  editMessage,
  generateAll,
  sendSingle,
  sendAll,
  generateFollowups,
  sendFollowups
} from "./outreach-controller.js";
import { requireAuth, requireSendAuth } from "../../shared/middleware.js";

export const outreachRouter = Router();

// Apply requireAuth globally to this router as in original code
outreachRouter.use(requireAuth);

outreachRouter.get("/outreach/auth/verify", requireSendAuth, verifyPasscode);
outreachRouter.get("/outreach/auth/google", connectGoogle);
outreachRouter.get("/api/auth/callback/google", googleCallback);
outreachRouter.get("/outreach/auth/google/status", googleStatus);
outreachRouter.post("/outreach/leads", addLeads);
outreachRouter.post("/outreach/leads/extract-image", extractImage);
outreachRouter.get("/outreach/leads", getLeads);
outreachRouter.delete("/outreach/leads/:id", deleteLead);
outreachRouter.patch("/outreach/messages/:id", editMessage);
outreachRouter.post("/outreach/generate-all", generateAll);
outreachRouter.post("/outreach/send/:id", requireSendAuth, sendSingle);
outreachRouter.post("/outreach/send-all", requireSendAuth, sendAll);
outreachRouter.post("/outreach/followups/generate", generateFollowups);
outreachRouter.post("/outreach/followups/send", requireSendAuth, sendFollowups);
