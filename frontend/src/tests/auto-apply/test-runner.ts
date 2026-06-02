import { chromium } from "playwright";
import { runAutoApplyOrchestrator } from "../../lib/auto-apply/orchestrator";
import { UserProfileData } from "../../lib/auto-apply/mapping";

// Load environment variables for local testing
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MOCK_PROFILE: UserProfileData = {
  fullName: "Shivam Verma",
  email: "shivam@example.com",
  phone: "+1 555-0198",
  location: "San Francisco, CA",
  linkedinUrl: "https://linkedin.com/in/shivamverma",
  githubUrl: "https://github.com/shivamverma",
  portfolioUrl: "https://shivam.dev",
  resumeUrl: "/Users/shivamverma/Desktop/resume.pdf", // Mock path
};

async function runTest() {
  console.log("Starting Auto Apply Test...");

  // We use headed mode so you can see the magic happen!
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Use our local sample form to demonstrate the extraction and filling
  const testUrl = "file:///Users/shivamverma/Desktop/personal-work/Job-Scraper/frontend/src/tests/auto-apply/sample-form.html";

  console.log(`Navigating to ${testUrl}`);
  await page.goto(testUrl);

  // Run the orchestrator
  await runAutoApplyOrchestrator(page, MOCK_PROFILE);

  console.log("Waiting 10 seconds before closing so you can review...");
  await page.waitForTimeout(10000);

  await browser.close();
  console.log("Test Completed.");
}

runTest().catch(console.error);
