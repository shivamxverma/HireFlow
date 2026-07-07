import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { OutreachFlowService } from "./outreach-flow-service.js";
import { AuthenticatedRequest } from "../../shared/middleware.js";

// Resume Controller
export const getResumes = asyncHandler(async (req: Request, res: Response) => {
  const resumes = await OutreachFlowService.getResumes();
  res.status(200).json(new ApiResponse(200, resumes, "Resumes fetched successfully."));
});

export const uploadResume = asyncHandler(async (req: Request, res: Response) => {
  const { title, pdfBase64 } = req.body;
  if (!title || !pdfBase64) {
    res.status(400).json(new ApiResponse(400, null, "Missing title or pdfBase64 data."));
    return;
  }
  const resume = await OutreachFlowService.parseAndUploadResume(title, pdfBase64);
  res.status(201).json(new ApiResponse(201, resume, "Resume uploaded and parsed successfully."));
});

export const deleteResume = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await OutreachFlowService.deleteResume(id);
  res.status(200).json(new ApiResponse(200, null, "Resume deleted successfully."));
});

// Profile Controller
export const getProfiles = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || "default-user";
  const profiles = await OutreachFlowService.getProfiles(userId);
  res.status(200).json(new ApiResponse(200, profiles, "Profiles fetched successfully."));
});

export const importProfiles = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { profiles } = req.body;
  const userId = req.user?.id || "default-user";
  if (!profiles) {
    res.status(400).json(new ApiResponse(400, null, "Missing profiles payload."));
    return;
  }
  const created = await OutreachFlowService.importProfiles(userId, profiles);
  res.status(201).json(new ApiResponse(201, created, `Successfully imported ${created.length} profile(s).`));
});

export const deleteProfile = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await OutreachFlowService.deleteProfile(id);
  res.status(200).json(new ApiResponse(200, null, "Profile deleted successfully."));
});

// Manual Job Controller
export const getManualJobs = asyncHandler(async (req: Request, res: Response) => {
  const jobs = await OutreachFlowService.getManualJobs();
  res.status(200).json(new ApiResponse(200, jobs, "Manual jobs fetched successfully."));
});

export const createManualJob = asyncHandler(async (req: Request, res: Response) => {
  const { title, company, description, link } = req.body;
  if (!title || !company) {
    res.status(400).json(new ApiResponse(400, null, "Title and Company are required."));
    return;
  }
  const job = await OutreachFlowService.createManualJob(title, company, description, link);
  res.status(201).json(new ApiResponse(201, job, "Manual job created successfully."));
});

export const deleteManualJob = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await OutreachFlowService.deleteManualJob(id);
  res.status(200).json(new ApiResponse(200, null, "Manual job deleted successfully."));
});

// Template Controller
export const getTemplates = asyncHandler(async (req: Request, res: Response) => {
  const templates = await OutreachFlowService.getTemplates();
  res.status(200).json(new ApiResponse(200, templates, "Templates fetched successfully."));
});

export const upsertTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id, name, type, prompt, active } = req.body;
  if (!name || !type || !prompt) {
    res.status(400).json(new ApiResponse(400, null, "Missing template name, type, or prompt."));
    return;
  }
  const template = await OutreachFlowService.upsertTemplate(id, name, type, prompt, active);
  res.status(200).json(new ApiResponse(200, template, "Template saved successfully."));
});

// Queue Controller
export const getQueueStatus = asyncHandler(async (req: Request, res: Response) => {
  const jobs = await OutreachFlowService.getQueueStatus();
  res.status(200).json(new ApiResponse(200, jobs, "Queue status fetched successfully."));
});

export const dispatchGenerations = asyncHandler(async (req: Request, res: Response) => {
  const { profileIds, resumeId, templateId, jobId } = req.body;
  if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0 || !resumeId || !templateId) {
    res.status(400).json(new ApiResponse(400, null, "Missing profileIds, resumeId, or templateId."));
    return;
  }
  const createdGenJobs = await OutreachFlowService.dispatchGenerations(profileIds, resumeId, templateId, jobId);
  res.status(202).json(new ApiResponse(202, createdGenJobs, `Enqueued ${createdGenJobs.length} outreach message generation jobs into BullMQ.`));
});

// Approval Controller
export const getApprovalQueue = asyncHandler(async (req: Request, res: Response) => {
  const drafts = await OutreachFlowService.getApprovalQueue();
  res.status(200).json(new ApiResponse(200, drafts, "Approval queue fetched successfully."));
});

export const editDraft = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { subject, content } = req.body;
  if (!subject || !content) {
    res.status(400).json(new ApiResponse(400, null, "Subject and content are required."));
    return;
  }
  const updated = await OutreachFlowService.editDraft(id, subject, content);
  res.status(200).json(new ApiResponse(200, updated, "Draft message updated successfully."));
});

export const approveDraft = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const updated = await OutreachFlowService.approveDraft(id);
  res.status(200).json(new ApiResponse(200, updated, "Message approved and ready to send."));
});

export const rejectDraft = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const updated = await OutreachFlowService.rejectDraft(id);
  res.status(200).json(new ApiResponse(200, updated, "Message rejected."));
});

// Outbox Messages
export const getOutboxMessages = asyncHandler(async (req: Request, res: Response) => {
  const messages = await OutreachFlowService.getOutboxMessages();
  res.status(200).json(new ApiResponse(200, messages, "Outbox messages fetched successfully."));
});

export const sendApprovedOutbox = asyncHandler(async (req: Request, res: Response) => {
  const result = await OutreachFlowService.sendApprovedOutbox();

  if (result.requiresError) {
    res.status(429).json(new ApiResponse(429, null, result.infoMsg));
    return;
  }

  res.status(202).json(new ApiResponse(202, null, `Sequentially sending ${result.sentCount} approved emails with safe 1-3 min delays.${result.infoMsg}`));
});

// Analytics Controller
export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const analytics = await OutreachFlowService.getAnalytics();
  res.status(200).json(new ApiResponse(200, analytics, "Analytics fetched successfully."));
});
