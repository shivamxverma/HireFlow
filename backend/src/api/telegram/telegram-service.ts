import { TelegramService as ExtTelegramService } from "../../services/telegram.service.js";
import { prisma } from "../../services/prisma.js";
import { telegramExtractionQueue } from "../../queues/queue.js";

export class TelegramService {
  static async getJoinedChannels() {
    return await ExtTelegramService.getJoinedChannels();
  }

  static async getMonitoredChannels() {
    return await prisma.telegramChannel.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  static async addMonitoredChannel(channelId: string, title: string, username?: string) {
    return await prisma.telegramChannel.upsert({
      where: { channelId },
      update: { title, username },
      create: { channelId, title, username },
    });
  }

  static async removeMonitoredChannel(channelId: string) {
    await prisma.telegramChannel.delete({
      where: { channelId },
    });
  }

  static importHistory(channelId: string, fromDate: Date, toDate: Date) {
    ExtTelegramService.importHistory(channelId, fromDate, toDate)
      .then((result) => {
        console.log(`[Telegram Service] Async historical import finished. Imported and enqueued: ${result.importedCount}`);
      })
      .catch((err) => {
        console.error("[Telegram Service] Async historical import failed:", err);
      });
  }

  static async getStats() {
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

    return stats;
  }

  static async getMessages(limit: number, offset: number) {
    return await prisma.telegramMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  static async reprocessFailed() {
    const failedMessages = await prisma.telegramMessage.findMany({
      where: {
        processed: false,
      },
      select: { id: true },
    });

    if (failedMessages.length === 0) {
      return 0;
    }

    const failedIds = failedMessages.map(m => m.id);

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

    const jobs = failedIds.map(id => ({
      name: "reprocess-failed",
      data: { rawMessageId: id },
    }));

    await telegramExtractionQueue.addBulk(jobs);

    return failedIds.length;
  }
}
