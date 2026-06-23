import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import OpenAI from "openai";

async function main() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  console.log("=== Testing new Gemini API Key ===");
  console.log("Key prefix:", geminiApiKey ? geminiApiKey.substring(0, 10) + "..." : "None");

  if (!geminiApiKey) {
    console.error("No Gemini API key found in .env.");
    return;
  }

  try {
    const openai = new OpenAI({
      apiKey: geminiApiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    });

    console.log("Sending simple test request to Gemini compatibility API...");
    const response = await openai.chat.completions.create({
      model: "gemini-2.5-flash-lite",
      messages: [{ role: "user", content: "Say hello!" }],
      temperature: 0.1,
    });

    console.log("SUCCESS! Response:", response.choices[0]?.message?.content);
  } catch (error: any) {
    console.error("FAILED with error:");
    console.error("Status Code:", error.status);
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    console.error("Full Error Object:", error);
  }
}

main().catch(console.error);
