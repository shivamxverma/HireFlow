import { Worker } from "bullmq";
import { chromium } from "playwright";
import dotenv from "dotenv";

// Load environment variables before anything else
dotenv.config({ path: ".env.local" });
import { runAutoApplyOrchestrator } from "../../lib/auto-apply/orchestrator";
import { redisConnectionOptions } from "../../lib/queue";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
console.log("Starting Auto Apply Worker...");

const autoApplyWorker = new Worker(
  "auto-apply-queue",
  async (job) => {
    console.log(`Processing Job ${job.id}: ${job.data.url}`);
    
    // Use a persistent context so the user only has to log in once!
    // The cookies/session will be saved in a local folder called playright-profile
    // We add slowMo: 500 so the user can literally watch the bot type and click in real-time.
    const userDataDir = './playwright-profile';
    const browserContext = await chromium.launchPersistentContext(userDataDir, { 
      headless: false,
      slowMo: 500 // 500ms delay between every action (typing, clicking)
    });
    
    // If the user has provided a LinkedIn session cookie in their .env, inject it!
    const sessionCookie = process.env.LINKEDIN_SESSION_COOKIE;
    if (sessionCookie) {
      console.log("Found LINKEDIN_SESSION_COOKIE in environment! Injecting...");
      await browserContext.addCookies([
        {
          name: 'li_at',
          value: sessionCookie,
          domain: '.www.linkedin.com',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'None'
        }
      ]);
    }

    try {
      const page = browserContext.pages().length > 0 ? browserContext.pages()[0] : await browserContext.newPage();

      let targetUrl = job.data.url;
      // If the URL is a search results page, rewrite it to the clean, dedicated job page!
      // This prevents the bot from clicking search filters instead of the real Easy Apply button!
      if (targetUrl.includes('search-results') && targetUrl.includes('currentJobId=')) {
        const jobIdMatch = targetUrl.match(/currentJobId=(\d+)/);
        if (jobIdMatch) {
          targetUrl = `https://www.linkedin.com/jobs/view/${jobIdMatch[1]}/`;
          console.log(`Rewrote search results URL to dedicated job page: ${targetUrl}`);
        }
      }
      
      await page.goto(targetUrl);
      
      // Quick sanity check: If we're redirected to a login page, pause and wait for the user to log in manually!
      const url = page.url();
      if (url.includes('linkedin.com/login') || url.includes('linkedin.com/signup') || url.includes('linkedin.com/checkpoint') || url.includes('authwall')) {
        console.log("Login page detected! Waiting up to 3 minutes for user to manually log in...");
        try {
          // Wait until the URL no longer contains any login/auth related strings
          await page.waitForFunction(
            () => !window.location.href.includes('login') && !window.location.href.includes('signup') && !window.location.href.includes('checkpoint') && !window.location.href.includes('authwall'),
            { timeout: 180000 }
          );
          console.log("Manual login detected! Re-navigating to job page...");
          await page.goto(job.data.url);
          // Small delay to let the real job page load
          await page.waitForTimeout(3000);
        } catch {
          throw new Error("Timeout waiting for manual login. The browser was closed. Please try again.");
        }
      }

      // Wait a few seconds for LinkedIn's React app to fetch and render the job card
      await page.waitForTimeout(3000);

      // Use multiple resilient locators to find the Easy Apply button (can be button or a tag)
      const easyApplyBtn = page.locator('button:has-text("Easy Apply"), a:has-text("Easy Apply"), [role="button"]:has-text("Easy Apply")').first();
      // External Apply is usually an <a> tag without "Easy Apply"
      const externalApplyBtn = page.locator('a:has-text("Apply"), [role="link"]:has-text("Apply"), button:has-text("Apply")').filter({ hasNotText: /Easy Apply/i }).first();

      let targetPage = page;

      if (await easyApplyBtn.isVisible()) {
        console.log("Found Easy Apply button! Clicking to open modal...");
        await easyApplyBtn.click();
        // Wait for the modal to pop up
        await page.waitForTimeout(2500);
      } else if (await externalApplyBtn.isVisible()) {
        console.log("Found external Apply button! Catching new tab...");
        const [newPage] = await Promise.all([
          browserContext.waitForEvent('page'),
          externalApplyBtn.click()
        ]);
        console.log("New tab opened! Switching orchestrator to the external career site...");
        targetPage = newPage;
        await targetPage.waitForLoadState('domcontentloaded');
        await targetPage.waitForTimeout(3000); // Give external ATS time to render
      } else {
        console.log("Could not find an Apply button. Maybe already applied?");
        throw new Error("Could not find an Apply or Easy Apply button on this page. You may have already applied, or the page didn't load correctly.");
      }

      // Assume job.data.profile contains the user's fetched profile
      await runAutoApplyOrchestrator(targetPage, job.data.profile);
      
      // Save screenshot for tracking
      await targetPage.screenshot({ path: `screenshots/job-${job.id}.png` });

      // Update Prisma Status to APPLIED
      if (job.data.applicationId) {
        await prisma.application.update({
          where: { id: job.data.applicationId },
          data: { status: "APPLIED" }
        });
      }

      console.log(`Job ${job.id} completed successfully.`);
      return { success: true, screenshot: `screenshots/job-${job.id}.png` };
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Update Prisma Status to FAILED
      if (job.data.applicationId) {
        await prisma.application.update({
          where: { id: job.data.applicationId },
          data: { status: "FAILED", errorMessage }
        });
      }

      throw error;
    } finally {
      await browserContext.close();
    }
  },
  {
    connection: redisConnectionOptions,
    concurrency: 1, // Keep concurrency low to avoid CPU/Memory overload from browsers
  }
);

autoApplyWorker.on("completed", (job) => {
  console.log(`Worker completed job ${job.id}`);
});

autoApplyWorker.on("failed", (job, err) => {
  console.error(`Worker failed job ${job?.id} with error ${err.message}`);
});
