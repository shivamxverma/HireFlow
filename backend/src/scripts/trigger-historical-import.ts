import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { TelegramService } from "../services/telegram.service.js";

async function main() {
  console.log("=== Triggering Historical Ingest for Monitored Channels ===");

  // Define date range: last 7 days to today
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);

  console.log(`Date range: ${fromDate.toISOString()} to ${toDate.toISOString()}`);

  const channelsToImport = [
    { name: "Premium Referrals", id: "-1002947896517" },
    { name: "MentorSetu.in | Job updates | resources", id: "-1002845471742" },
    { name: "Krishan Kumar - Jobs & Internships Updates", id: "-1001515619731" }
  ];

  for (const channel of channelsToImport) {
    console.log(`\nImporting messages from: "${channel.name}" (${channel.id})...`);
    try {
      const result = await TelegramService.importHistory(channel.id, fromDate, toDate);
      console.log(`SUCCESS: Enqueued ${result.importedCount} messages from "${channel.name}".`);
    } catch (error) {
      console.error(`ERROR importing from "${channel.name}":`, error);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
