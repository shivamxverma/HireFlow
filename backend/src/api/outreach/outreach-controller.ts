import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { OutreachService } from "./outreach-service.js";
import { AuthenticatedRequest } from "../../shared/middleware.js";

export const verifyPasscode = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(new ApiResponse(200, null, "Passcode successfully verified."));
});

export const connectGoogle = asyncHandler(async (req: Request, res: Response) => {
  console.log(`[Outreach Router] GET /outreach/auth/google route hit! Host: ${req.headers.host}`);
  const redirectUri = `${req.protocol}://${req.headers.host}/api/auth/callback/google`;
  const url = OutreachService.getGmailAuthUrl(redirectUri);
  res.redirect(url);
});

export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code) {
    res.status(400).send("Authorization code is missing.");
    return;
  }

  if (state) {
    try {
      const jwt = await import("jsonwebtoken");
      const env = (await import("../../config/index.js")).default;
      jwt.default.verify(state, env.ACCESS_TOKEN_SECRET);
      res.redirect(`/api/v1/auth/google/callback?code=${code}&state=${state}`);
      return;
    } catch (jwtErr) {
      // Proceed to legacy Gmail callback
    }
  }

  const redirectUri = `${req.protocol}://${req.headers.host}/api/auth/callback/google`;
  await OutreachService.exchangeGmailCode(code, redirectUri);

  res.send(`
    <html>
      <head>
        <title>Google Authentication Successful</title>
        <script>
          window.opener?.postMessage("oauth-success", "*");
          window.close();
        </script>
      </head>
      <body style="font-family: sans-serif; text-align: center; padding: 3rem; background: #0f172a; color: #fff;">
        <h2 style="color: #34d399;">Authentication Successful ✅</h2>
        <p>Google Account connected. You can close this window now.</p>
        <script>
          setTimeout(() => { window.close(); }, 2000);
        </script>
      </body>
    </html>
  `);
});

export const googleStatus = asyncHandler(async (req: Request, res: Response) => {
  const status = await OutreachService.getGmailStatus();
  res.status(200).json(status);
});

export const addLeads = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { leads } = req.body;
  const userId = req.user?.id || "default-user";

  if (!leads) {
    res.status(400).json(new ApiResponse(400, null, "Missing leads data."));
    return;
  }

  const createdLeads = await OutreachService.addLeads(userId, leads);
  res.status(201).json(new ApiResponse(201, createdLeads, `Successfully added ${createdLeads.length} lead(s).`));
});

export const extractImage = asyncHandler(async (req: Request, res: Response) => {
  const { image, mimeType } = req.body;
  if (!image || !mimeType) {
    res.status(400).json(new ApiResponse(400, null, "Missing base64 image or mimeType."));
    return;
  }

  const extracted = await OutreachService.extractLeadFromImage(image, mimeType);
  res.status(200).json(new ApiResponse(200, extracted, "Successfully extracted lead details from image."));
});

export const getLeads = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || "default-user";
  const leads = await OutreachService.getLeads(userId);
  res.status(200).json(new ApiResponse(200, leads, "Leads fetched successfully."));
});

export const deleteLead = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await OutreachService.deleteLead(id);
  res.status(200).json(new ApiResponse(200, null, "Lead successfully deleted."));
});

export const editMessage = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { subject, body } = req.body;

  if (!subject || !body) {
    res.status(400).json(new ApiResponse(400, null, "Subject and body are required."));
    return;
  }

  const updatedMessage = await OutreachService.updateMessage(id, subject, body);
  res.status(200).json(new ApiResponse(200, updatedMessage, "Email message saved successfully."));
});

export const generateAll = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || "default-user";
  const result = await OutreachService.generateInitialEmails(userId);
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export const sendSingle = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await OutreachService.sendSingleEmail(id);
  res.status(200).json(new ApiResponse(200, null, "Email sent successfully."));
});

export const sendAll = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || "default-user";
  const result = await OutreachService.sendAllReadyEmails(userId);

  if (result.requiresError) {
    res.status(429).json(new ApiResponse(429, null, result.infoMsg));
    return;
  }

  res.status(202).json(
    new ApiResponse(202, null, `Sequentially sending ${result.sentCount} cold emails with safe 1-3 min delays.${result.infoMsg}`)
  );
});

export const generateFollowups = asyncHandler(async (req: Request, res: Response) => {
  const { leadIds } = req.body;
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400).json(new ApiResponse(400, null, "Missing or invalid leadIds array."));
    return;
  }

  const result = await OutreachService.generateFollowups(leadIds);
  res.status(200).json(
    new ApiResponse(200, result, `Follow-up generation complete. Success: ${result.successCount}, Failed: ${result.failCount}`)
  );
});

export const sendFollowups = asyncHandler(async (req: Request, res: Response) => {
  const { leadIds } = req.body;
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400).json(new ApiResponse(400, null, "Missing or invalid leadIds array."));
    return;
  }

  const result = await OutreachService.sendFollowups(leadIds);
  res.status(202).json(
    new ApiResponse(202, null, `Sequentially sending ${result.sentCount} follow-up email(s).`)
  );
});
