import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function debug() {
  console.log("Starting debug script...");
  const browser = await chromium.launchPersistentContext('./playwright-profile', { headless: true });
  const page = await browser.newPage();
  
  const cookie = process.env.LINKEDIN_SESSION_COOKIE;
  if (cookie) {
    await browser.addCookies([{ name: "li_at", value: cookie, domain: ".www.linkedin.com", path: "/", httpOnly: true, secure: true, sameSite: "None" }]);
  }

  await page.goto("https://in.linkedin.com/jobs/view/net-software-engineer-remote-work-at-bairesdev-4422886712");
  await page.waitForTimeout(5000);
  
  await page.screenshot({ path: "debug-job-page.png", fullPage: true });
  console.log("Screenshot saved to debug-job-page.png");
  
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('debug-job-page.html', html);
  console.log("HTML saved to debug-job-page.html");
  
  await browser.close();
}
debug();
