import dotenv from "dotenv";
import path from "path";
// @ts-ignore
import { TelegramClient } from "telegram";
// @ts-ignore
import { StringSession } from "telegram/sessions/index.js";
import readline from "readline";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const apiId = parseInt(process.env.TELEGRAM_API_ID || "");
const apiHash = process.env.TELEGRAM_API_HASH || "";

if (!apiId || !apiHash) {
  console.error("ERROR: Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in your backend/.env file first!");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  console.log("=== Telegram Login Session Generator ===");
  console.log("Initializing GramJS Client with empty session...");

  const stringSession = new StringSession(""); // Start with empty session
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await askQuestion("Enter your Telegram phone number (with country code, e.g. +123456789): "),
    password: async () => await askQuestion("Enter your 2FA password (if enabled, otherwise press Enter): "),
    phoneCode: async () => await askQuestion("Enter the code sent to your Telegram app: "),
    onError: (err: any) => console.error("Error during authentication:", err),
  });

  console.log("\nAuthentication successful!");
  const sessionString = client.session.save() as unknown as string;
  console.log("\n=================== TELEGRAM_SESSION ===================");
  console.log(sessionString);
  console.log("========================================================\n");
  console.log("INSTRUCTIONS:");
  console.log("1. Copy the long session string above.");
  console.log("2. Paste it in your backend/.env as: TELEGRAM_SESSION=<string>");
  console.log("3. Restart your backend server.");
  
  rl.close();
  await client.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error during login script:", err);
  rl.close();
  process.exit(1);
});
