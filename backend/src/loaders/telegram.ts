import { TelegramService } from "../services/telegram.service.js";

export async function initTelegram(): Promise<void> {
  try {
    console.log("⚡ Starting Telegram real-time listener...");
    await TelegramService.startListener();
    await TelegramService.syncRecentMonitoredChannels();
    console.log("⚡ Telegram listener and channel sync initialized.");
  } catch (error) {
    console.error("❌ Failed to initialize Telegram listener:", error);
    throw error;
  }
}
