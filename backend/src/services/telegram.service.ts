import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import { prisma } from "./prisma.js";
import { telegramExtractionQueue } from "../queues/queue.js";

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";
const session = process.env.TELEGRAM_SESSION || "";

export class TelegramService {
  private static client: TelegramClient | null = null;
  private static isListening = false;

  /**
   * Initializes and returns the GramJS client if credentials are configured
   */
  static async getClient(): Promise<TelegramClient | null> {
    if (this.client) {
      // Check if connected
      if (!this.client.connected) {
        await this.client.connect();
      }
      return this.client;
    }

    if (!apiId || !apiHash || !session) {
      console.warn("[Telegram Service] Telegram credentials or session are not set in .env. Telegram features disabled.");
      return null;
    }

    try {
      console.log("[Telegram Service] Initializing GramJS Telegram Client...");
      const stringSession = new StringSession(session);
      this.client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
      });
      await this.client.connect();
      console.log("[Telegram Service] Telegram Client connected successfully.");
      return this.client;
    } catch (err) {
      console.error("[Telegram Service] Failed to initialize/connect GramJS client:", err);
      this.client = null;
      return null;
    }
  }

  /**
   * Lists all channels and groups the user account has joined
   */
  static async getJoinedChannels(): Promise<any[]> {
    const client = await this.getClient();
    if (!client) {
      throw new Error("Telegram client is not configured. Please set credentials in .env.");
    }

    console.log("[Telegram Service] Fetching dialogs/channels...");
    const dialogs = await client.getDialogs();
    
    return dialogs
      .filter((dialog) => dialog.isChannel || dialog.isGroup)
      .map((dialog) => {
        const entity: any = dialog.entity;
        return {
          id: dialog.id?.toString() || "",
          title: dialog.title || "Unnamed Channel",
          username: entity?.username || null,
          isChannel: dialog.isChannel,
          isGroup: dialog.isGroup,
        };
      });
  }

  /**
   * Imports historical messages in a given date range
   */
  static async importHistory(
    channelId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<{ importedCount: number }> {
    const client = await this.getClient();
    if (!client) {
      throw new Error("Telegram client is not configured. Please set credentials in .env.");
    }

    console.log(`[Telegram Service] Initiating historical import for channel ${channelId} from ${fromDate.toISOString()} to ${toDate.toISOString()}`);

    const dialogs = await client.getDialogs();
    const matchingDialog = dialogs.find(
      (d) => d.id?.toString() === channelId || d.entity?.id?.toString() === channelId
    );

    if (!matchingDialog) {
      throw new Error(`Channel or Group with ID ${channelId} not found in user's list. Ensure the account has joined this channel.`);
    }

    const entity = matchingDialog.entity;
    const channelTitle = matchingDialog.title || "Unknown Channel";
    
    let offsetId = 0;
    let importedCount = 0;
    let hasMore = true;

    const fromUnix = Math.floor(fromDate.getTime() / 1000);
    const toUnix = Math.floor(toDate.getTime() / 1000);

    console.log(`[Telegram Service] Resolved channel "${channelTitle}". Loading history...`);

    while (hasMore) {
      const messages: any[] = await client.getMessages(entity, {
        limit: 100,
        offsetId: offsetId,
      });

      if (!messages || messages.length === 0) {
        console.log("[Telegram Service] No more messages found.");
        break;
      }

      for (const message of messages) {
        const msgDateUnix = message.date;
        offsetId = message.id; // update offset to page backward

        // If message is older than the start date, we stop crawling
        if (msgDateUnix < fromUnix) {
          hasMore = false;
          console.log(`[Telegram Service] Message date ${new Date(msgDateUnix * 1000).toISOString()} is older than fromDate ${fromDate.toISOString()}. Crawl complete.`);
          break;
        }

        // If message is newer than toDate, skip it and continue crawling backward
        if (msgDateUnix > toUnix) {
          continue;
        }

        const rawText = message.message || "";
        if (!rawText.trim()) continue;

        try {
          // Store raw message in DB
          const rawMessage = await prisma.telegramMessage.upsert({
            where: {
              channelId_messageId: {
                channelId: channelId,
                messageId: message.id,
              },
            },
            update: {},
            create: {
              channelId: channelId,
              channelName: channelTitle,
              messageId: message.id,
              messageText: rawText,
              postedAt: new Date(msgDateUnix * 1000),
              processed: false,
              status: "UNPROCESSED",
            },
          });

          // If rawMessage was created, queue it for Gemini processing
          if (rawMessage.status === "UNPROCESSED" && !rawMessage.processed) {
            await telegramExtractionQueue.add("extract-historical", {
              rawMessageId: rawMessage.id,
            });
            importedCount++;
          }
        } catch (dbErr) {
          console.error(`[Telegram Service] DB error saving message ${message.id}:`, dbErr);
        }
      }

      // Respect rate limits and sleep briefly
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`[Telegram Service] Historical import complete. Enqueued ${importedCount} messages for processing.`);
    return { importedCount };
  }

  /**
   * Enqueues recent message history for every monitored Telegram channel.
   * This keeps Telegram on the queue-based extraction path while allowing
   * the app to catch up shortly after boot.
   */
  static async syncRecentMonitoredChannels(
    hoursBack: number = 4,
  ): Promise<{ channelCount: number; importedCount: number }> {
    const monitoredChannels = await prisma.telegramChannel.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (monitoredChannels.length === 0) {
      console.log("[Telegram Service] No monitored Telegram channels configured. Skipping recent history sync.");
      return { channelCount: 0, importedCount: 0 };
    }

    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - hoursBack * 60 * 60 * 1000);
    let importedCount = 0;

    console.log(
      `[Telegram Service] Syncing recent Telegram history for ${monitoredChannels.length} monitored channels from ${fromDate.toISOString()} to ${toDate.toISOString()}.`,
    );

    for (const channel of monitoredChannels) {
      try {
        const result = await this.importHistory(channel.channelId, fromDate, toDate);
        importedCount += result.importedCount;
      } catch (err) {
        console.error(
          `[Telegram Service] Failed to sync recent history for monitored channel ${channel.title} (${channel.channelId}):`,
          err,
        );
      }
    }

    console.log(
      `[Telegram Service] Recent Telegram sync completed. Enqueued ${importedCount} messages across ${monitoredChannels.length} channels.`,
    );

    return {
      channelCount: monitoredChannels.length,
      importedCount,
    };
  }

  /**
   * Starts the real-time listener for monitored channels
   */
  static async startListener(): Promise<void> {
    if (this.isListening) {
      console.log("[Telegram Service] Real-time listener is already running.");
      return;
    }

    const client = await this.getClient();
    if (!client) {
      console.warn("[Telegram Service] GramJS client is not initialized. Listener cannot start.");
      return;
    }

    console.log("[Telegram Service] Registering real-time message listener event handler...");

    client.addEventHandler(async (event) => {
      const message = event.message;
      if (!message || !message.peerId) return;

      try {
        // Resolve Peer ID safely
        const peer = message.peerId as any;
        const peerIdStr = peer.channelId
          ? peer.channelId.toString()
          : peer.chatId
          ? peer.chatId.toString()
          : null;

        if (!peerIdStr) return;

        // Check if we are monitoring this channel
        // Support matching both standard ID and potentially prefixed IDs
        const monitoredChannel = await prisma.telegramChannel.findFirst({
          where: {
            OR: [
              { channelId: peerIdStr },
              { channelId: `-${peerIdStr}` },
              { channelId: `-100${peerIdStr}` },
            ],
          },
        });

        if (!monitoredChannel) {
          // Not in our monitor list, ignore
          return;
        }

        const rawText = message.message || "";
        if (!rawText.trim()) return;

        console.log(`[Telegram Listener] New message received in monitored channel: "${monitoredChannel.title}" (Msg ID: ${message.id})`);

        // Save raw message to DB
        const rawMessage = await prisma.telegramMessage.upsert({
          where: {
            channelId_messageId: {
              channelId: monitoredChannel.channelId,
              messageId: message.id,
            },
          },
          update: {},
          create: {
            channelId: monitoredChannel.channelId,
            channelName: monitoredChannel.title,
            messageId: message.id,
            messageText: rawText,
            postedAt: new Date(message.date * 1000),
            processed: false,
            status: "UNPROCESSED",
          },
        });

        console.log(`[Telegram Listener] Message saved to raw database (ID: ${rawMessage.id}). Enqueueing extraction...`);

        // Add to extraction queue
        await telegramExtractionQueue.add("extract-realtime", {
          rawMessageId: rawMessage.id,
        });

      } catch (err) {
        console.error("[Telegram Listener] Error handling incoming real-time update:", err);
      }
    }, new NewMessage({}));

    this.isListening = true;
    console.log("[Telegram Service] Real-time message listener is now active.");
  }
}
