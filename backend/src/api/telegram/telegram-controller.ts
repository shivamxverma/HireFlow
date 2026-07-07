import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { TelegramService } from "./telegram-service.js";

export const getJoinedChannels = asyncHandler(async (req: Request, res: Response) => {
  const channels = await TelegramService.getJoinedChannels();
  res.status(200).json(new ApiResponse(200, channels, "Joined channels fetched successfully."));
});

export const getMonitoredChannels = asyncHandler(async (req: Request, res: Response) => {
  const monitored = await TelegramService.getMonitoredChannels();
  res.status(200).json(new ApiResponse(200, monitored, "Monitored channels fetched successfully."));
});

export const addMonitoredChannel = asyncHandler(async (req: Request, res: Response) => {
  const { channelId, title, username } = req.body;
  if (!channelId || !title) {
    res.status(400).json(new ApiResponse(400, null, "channelId and title are required."));
    return;
  }
  const newMonitored = await TelegramService.addMonitoredChannel(channelId, title, username);
  res.status(201).json(new ApiResponse(201, newMonitored, "Channel added to monitored list."));
});

export const removeMonitoredChannel = asyncHandler(async (req: Request, res: Response) => {
  const channelId = req.params.channelId as string;
  await TelegramService.removeMonitoredChannel(channelId);
  res.status(200).json(new ApiResponse(200, null, "Channel removed from monitoring list."));
});

export const importHistory = asyncHandler(async (req: Request, res: Response) => {
  const { channelId, fromDate, toDate } = req.body;
  if (!channelId || !fromDate || !toDate) {
    res.status(400).json(new ApiResponse(400, null, "channelId, fromDate, and toDate are required."));
    return;
  }

  const start = new Date(fromDate);
  const end = new Date(toDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    res.status(400).json(new ApiResponse(400, null, "Invalid fromDate or toDate formats."));
    return;
  }

  TelegramService.importHistory(channelId, start, end);
  res.status(202).json(new ApiResponse(202, null, "Historical import process initiated in the background."));
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await TelegramService.getStats();
  res.status(200).json(new ApiResponse(200, stats, "Telegram stats fetched successfully."));
});

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || "100");
  const offset = parseInt(req.query.offset as string || "0");
  const messages = await TelegramService.getMessages(limit, offset);
  res.status(200).json(new ApiResponse(200, messages, "Telegram messages fetched successfully."));
});

export const reprocessFailed = asyncHandler(async (req: Request, res: Response) => {
  const reprocessedCount = await TelegramService.reprocessFailed();
  if (reprocessedCount === 0) {
    res.status(200).json(new ApiResponse(200, null, "No failed or rejected messages to reprocess."));
    return;
  }
  res.status(200).json(new ApiResponse(200, null, `Enqueued ${reprocessedCount} failed messages for reprocessing.`));
});
