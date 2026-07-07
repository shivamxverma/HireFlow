import { resumeWorker } from "../queues/resume.worker.js";
import { applyWorker } from "../queues/apply.worker.js";
import { outreachWorker } from "../queues/outreach.worker.js";
import { telegramExtractionWorker } from "../queues/telegram-extraction.worker.js";

export function initWorkers(): void {
  console.log("⚙️ Initializing background workers...");
  console.log(`⚙️ Resume Worker active: ${resumeWorker.name}`);
  console.log(`⚙️ Apply Worker active: ${applyWorker.name}`);
  console.log(`⚙️ Outreach Worker active: ${outreachWorker.name}`);
  console.log(`⚙️ Telegram Extraction Worker active: ${telegramExtractionWorker.name}`);
}
