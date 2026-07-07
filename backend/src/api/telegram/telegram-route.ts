import { Router } from "express";
import {
  getJoinedChannels,
  getMonitoredChannels,
  addMonitoredChannel,
  removeMonitoredChannel,
  importHistory,
  getStats,
  getMessages,
  reprocessFailed
} from "./telegram-controller.js";
import { requireAuth } from "../../shared/middleware.js";

export const telegramRouter = Router();

telegramRouter.use(requireAuth);

telegramRouter.get("/api/v1/telegram/channels/joined", getJoinedChannels);
telegramRouter.get("/api/v1/telegram/channels/monitored", getMonitoredChannels);
telegramRouter.post("/api/v1/telegram/channels/monitored", addMonitoredChannel);
telegramRouter.delete("/api/v1/telegram/channels/monitored/:channelId", removeMonitoredChannel);
telegramRouter.post("/api/v1/telegram/import", importHistory);
telegramRouter.get("/api/v1/telegram/stats", getStats);
telegramRouter.get("/api/v1/telegram/messages", getMessages);
telegramRouter.post("/api/v1/telegram/reprocess-failed", reprocessFailed);
