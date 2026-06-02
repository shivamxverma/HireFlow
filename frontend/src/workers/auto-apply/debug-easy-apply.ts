import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function debug() {
  console.log("Starting Easy Apply debug script...");
  const browser = await chromium.launchPersistentContext('./playwright-profile', { headless: true });
  const page = await browser.newPage();
  
  const cookie = process.env.LINKEDIN_SESSION_COOKIE;
  if (cookie) {
    await browser.addCookies([{ name: "li_at", value: cookie, domain: ".www.linkedin.com", path: "/", httpOnly: true, secure: true, sameSite: "None" }]);
  }

  await page.goto("https://in.linkedin.com/jobs/view/software-engineer-at-scoutit-4423912348");
  await page.waitForTimeout(5000);
  
  await page.screenshot({ path: "debug-easy-apply.png", fullPage: true });
  console.log("Screenshot saved to debug-easy-apply.png");
  
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('debug-easy-apply.html', html);
  console.log("HTML saved to debug-easy-apply.html");
  
  await browser.close();
}
debug();
