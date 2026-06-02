import { Router } from "express";
import { requireAuth } from "./auth.middleware.js";
import { TelegramService } from "../services/telegram.service.js";
import { prisma } from "../services/prisma.js";
import { telegramExtractionQueue } from "../queues/queue.js";

export const telegramRouter = Router();

/**
 * GET /api/v1/telegram/channels/joined
 * Lists all channels/groups the authenticated Telegram account is member of
 */
telegramRouter.get("/api/v1/telegram/channels/joined", requireAuth, async (req, res) => {
  try {
    const channels = await TelegramService.getJoinedChannels();
    res.status(200).json({
      success: true,
      data: channels,
    });
  } catch (err: any) {
    console.error("[Telegram Routes] Error fetching joined channels:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch joined channels.",
    });
  }
});

/**
 * GET /api/v1/telegram/channels/monitored
 * Lists all channels currently monitored by the admin
 */
telegramRouter.get("/api/v1/telegram/channels/monitored", requireAuth, async (req, res) => {
  try {
    const monitored = await prisma.telegramChannel.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({
      success: true,
      data: monitored,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch monitored channels.",
    });
  }
});

/**
 * POST /api/v1/telegram/channels/monitored
 * Adds a channel to the monitoring list
 */
telegramRouter.post("/api/v1/telegram/channels/monitored", requireAuth, async (req, res) => {
  try {
    const { channelId, title, username } = req.body;
    if (!channelId || !title) {
      res.status(400).json({
        success: false,
        message: "channelId and title are required.",
      });
      return;
    }

    const newMonitored = await prisma.telegramChannel.upsert({
      where: { channelId },
      update: { title, username },
      create: { channelId, title, username },
    });

    res.status(201).json({
      success: true,
      data: newMonitored,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to add channel to monitored list.",
    });
  }
});

/**
 * DELETE /api/v1/telegram/channels/monitored/:channelId
 * Removes a channel from the monitoring list
 */
telegramRouter.delete("/api/v1/telegram/channels/monitored/:channelId", requireAuth, async (req, res) => {
  try {
    const channelId = req.params.channelId as string;

    await prisma.telegramChannel.delete({
      where: { channelId },
    });

    res.status(200).json({
      success: true,
      message: "Channel removed from monitoring list.",
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to remove channel.",
    });
  }
});

/**
 * POST /api/v1/telegram/import
 * Triggers historical import of messages for a channel in a date range
 */
telegramRouter.post("/api/v1/telegram/import", requireAuth, async (req, res) => {
  try {
    const { channelId, fromDate, toDate } = req.body;
    if (!channelId || !fromDate || !toDate) {
      res.status(400).json({
        success: false,
        message: "channelId, fromDate, and toDate are required.",
      });
      return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        message: "Invalid fromDate or toDate formats.",
      });
      return;
    }

    // Trigger asynchronously so it does not block Express HTTP response
    TelegramService.importHistory(channelId, start, end)
      .then((result) => {
        console.log(`[Telegram Routes] Async historical import finished. Imported and enqueued: ${result.importedCount}`);
      })
      .catch((err) => {
        console.error("[Telegram Routes] Async historical import failed:", err);
      });

    res.status(202).json({
      success: true,
      message: "Historical import process initiated in the background.",
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to trigger historical import.",
    });
  }
});

/**
 * GET /api/v1/telegram/stats
 * Returns overview statistics of the raw messages processing status
 */
telegramRouter.get("/api/v1/telegram/stats", requireAuth, async (req, res) => {
  try {
    const total = await prisma.telegramMessage.count();
    
    const statusCounts = await prisma.telegramMessage.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    const stats = {
      total,
      unprocessed: 0,
      processed: 0,
      rejected: 0,
      skipped: 0,
    };

    for (const group of statusCounts) {
      if (group.status === "UNPROCESSED") {
        stats.unprocessed = group._count.id;
      } else if (group.status === "PROCESSED") {
        stats.processed = group._count.id;
      } else if (group.status === "REJECTED") {
        stats.rejected = group._count.id;
      } else if (group.status === "SKIPPED_DUPLICATE") {
        stats.skipped = group._count.id;
      }
    }

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch stats.",
    });
  }
});

/**
 * GET /api/v1/telegram/messages
 * Returns a list of recent raw messages with their processing status
 */
telegramRouter.get("/api/v1/telegram/messages", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || "100");
    const offset = parseInt(req.query.offset as string || "0");

    const messages = await prisma.telegramMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch messages.",
    });
  }
});

/**
 * POST /api/v1/telegram/reprocess-failed
 * Allows manually re-enqueueing any rejected or errored messages back to the worker queue
 */
telegramRouter.post("/api/v1/telegram/reprocess-failed", requireAuth, async (req, res) => {
  try {
    const failedMessages = await prisma.telegramMessage.findMany({
      where: {
        processed: false,
      },
      select: { id: true },
    });

    if (failedMessages.length === 0) {
      res.status(200).json({
        success: true,
        message: "No failed or rejected messages to reprocess.",
      });
      return;
    }

    const failedIds = failedMessages.map(m => m.id);

    // 1. Bulk update status in DB
    await prisma.telegramMessage.updateMany({
      where: {
        id: { in: failedIds },
      },
      data: {
        processed: false,
        status: "UNPROCESSED",
        errorMessage: null,
      },
    });

    // 2. Bulk add to BullMQ queue
    const jobs = failedIds.map(id => ({
      name: "reprocess-failed",
      data: { rawMessageId: id },
    }));

    await telegramExtractionQueue.addBulk(jobs);

    res.status(200).json({
      success: true,
      message: `Enqueued ${failedIds.length} failed messages for reprocessing.`,
    });
  } catch (err: any) {
    console.error("[Telegram Routes] Error in reprocess-failed:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to reprocess messages.",
    });
  }
});
