import { Router } from "express";
import {
  getResumes,
  uploadResume,
  deleteResume,
  getProfiles,
  importProfiles,
  deleteProfile,
  getManualJobs,
  createManualJob,
  deleteManualJob,
  getTemplates,
  upsertTemplate,
  getQueueStatus,
  dispatchGenerations,
  getApprovalQueue,
  editDraft,
  approveDraft,
  rejectDraft,
  getOutboxMessages,
  sendApprovedOutbox,
  getAnalytics
} from "./outreach-flow-controller.js";
import { requireAuth, requireSendAuth } from "../../shared/middleware.js";

export const outreachFlowRouter = Router();

outreachFlowRouter.use(requireAuth);

// Resume Routes
outreachFlowRouter.get("/outreach-flow/resumes", getResumes);
outreachFlowRouter.post("/outreach-flow/resumes", uploadResume);
outreachFlowRouter.delete("/outreach-flow/resumes/:id", deleteResume);

// Profile Routes
outreachFlowRouter.get("/outreach-flow/profiles", getProfiles);
outreachFlowRouter.post("/outreach-flow/profiles", importProfiles);
outreachFlowRouter.delete("/outreach-flow/profiles/:id", deleteProfile);

// Manual Jobs Routes
outreachFlowRouter.get("/outreach-flow/jobs", getManualJobs);
outreachFlowRouter.post("/outreach-flow/jobs", createManualJob);
outreachFlowRouter.delete("/outreach-flow/jobs/:id", deleteManualJob);

// Template Routes
outreachFlowRouter.get("/outreach-flow/templates", getTemplates);
outreachFlowRouter.post("/outreach-flow/templates", upsertTemplate);

// Queue Routes
outreachFlowRouter.get("/outreach-flow/queue/status", getQueueStatus);
outreachFlowRouter.post("/outreach-flow/generate", dispatchGenerations);

// Approval Queue Routes
outreachFlowRouter.get("/outreach-flow/approval", getApprovalQueue);
outreachFlowRouter.patch("/outreach-flow/approval/:id", editDraft);
outreachFlowRouter.post("/outreach-flow/approval/:id/approve", approveDraft);
outreachFlowRouter.post("/outreach-flow/approval/:id/reject", rejectDraft);

// Outbox Routes
outreachFlowRouter.get("/outreach-flow/messages", getOutboxMessages);
outreachFlowRouter.post("/outreach-flow/outbox/send", requireSendAuth, sendApprovedOutbox);

// Analytics Route
outreachFlowRouter.get("/outreach-flow/analytics", getAnalytics);
