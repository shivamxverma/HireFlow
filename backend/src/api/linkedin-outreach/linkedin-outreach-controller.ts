import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { LinkedinOutreachService } from "./linkedin-outreach-service.js";

export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  const status = await LinkedinOutreachService.checkSessionStatus();
  res.status(200).json(status);
});

export const connectLinkedin = asyncHandler(async (req: Request, res: Response) => {
  res.write("Launching headed browser for manual login...");
  await LinkedinOutreachService.connectLinkedin();
  res.end("\nConnection process complete. Session saved.");
});

export const importCookies = asyncHandler(async (req: Request, res: Response) => {
  const { cookies } = req.body;
  if (!cookies || !Array.isArray(cookies)) {
    res.status(400).json(new ApiResponse(400, null, "Missing or invalid cookies array."));
    return;
  }

  try {
    const count = LinkedinOutreachService.importCookies(cookies);
    res.status(200).json(new ApiResponse(200, null, `Successfully imported ${count} LinkedIn session cookies.`));
  } catch (error: any) {
    res.status(400).json(new ApiResponse(400, null, error.message || "Cookie import failed."));
  }
});

export const generateColdNote = asyncHandler(async (req: Request, res: Response) => {
  const { profileId, resumeId, templateId } = req.body;
  if (!profileId || !resumeId || !templateId) {
    res.status(400).json(new ApiResponse(400, null, "Missing profileId, resumeId, or templateId."));
    return;
  }

  const draft = await LinkedinOutreachService.generateColdNote(profileId, resumeId, templateId);
  res.status(201).json(new ApiResponse(201, draft, "Successfully generated LinkedIn cold outreach note draft."));
});

export const extractProfileFile = asyncHandler(async (req: Request, res: Response) => {
  const { fileData, mimeType } = req.body;
  if (!fileData || !mimeType) {
    res.status(400).json(new ApiResponse(400, null, "Missing base64 fileData or mimeType."));
    return;
  }

  const extracted = await LinkedinOutreachService.extractProfileFromFile(fileData, mimeType);
  res.status(200).json(new ApiResponse(200, extracted, "Successfully extracted profile details from file."));
});

export const sendLinkedinMessages = asyncHandler(async (req: Request, res: Response) => {
  const { messageIds } = req.body;
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    res.status(400).json(new ApiResponse(400, null, "Missing or invalid messageIds array."));
    return;
  }

  const count = await LinkedinOutreachService.sendLinkedinMessages(messageIds);
  res.status(202).json(new ApiResponse(202, null, `Sequentially dispatching ${count} LinkedIn DMs in the background.`));
});
