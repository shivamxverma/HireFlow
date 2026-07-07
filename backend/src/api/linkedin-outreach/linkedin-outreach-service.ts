import { 
  hasLinkedinSession, 
  validateLinkedinSession, 
  saveLinkedinSession, 
  getLinkedinSessionPath 
} from "../../connectors/linkedin/session.js";
import { launchStealthBrowser } from "../../services/stealth-browser.js";
import { prisma } from "../../services/prisma.js";
import { GeminiService } from "../../services/gemini.service.js";
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const geminiService = new GeminiService();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class LinkedinOutreachService {
  static async locateProfileCardButton(page: any, text: string, defaultSelectors: string[]) {
    for (const selector of defaultSelectors) {
      const locator = page.locator(selector);
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        if (await el.isVisible()) {
          const rect = await el.boundingBox();
          if (rect && rect.y > 100 && rect.x < 1000) {
            console.log(`[LinkedIn Outreach] Found "${text}" button via selector: "${selector}"`);
            return el;
          }
        }
      }
    }
    const fallback = page.locator(defaultSelectors.join(', ')).first();
    if (await fallback.isVisible()) {
      console.log(`[LinkedIn Outreach] Found "${text}" button via fallback selector`);
      return fallback;
    }
    return null;
  }

  static checkSessionStatus() {
    const sessionFileExists = hasLinkedinSession();
    if (!sessionFileExists) {
      return { authenticated: false };
    }
    return validateLinkedinSession().then((isValid) => ({ authenticated: isValid }));
  }

  static async connectLinkedin() {
    console.log("[LinkedIn Outreach] Starting headed login browser session...");
    await saveLinkedinSession();
  }

  static importCookies(cookies: any[]) {
    const mapSameSite = (value: string | undefined): "Strict" | "Lax" | "None" => {
      const normalized = value?.toLowerCase();
      if (normalized === "strict") return "Strict";
      if (normalized === "none" || normalized === "no_restriction") return "None";
      return "Lax";
    };

    const mappedCookies = cookies
      .filter((cookie: any) => cookie.domain?.includes("linkedin.com"))
      .map((cookie: any) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path ?? "/",
        expires: cookie.expirationDate ?? cookie.expires ?? Math.floor(Date.now() / 1000) + 86400 * 30,
        httpOnly: cookie.httpOnly ?? false,
        secure: cookie.secure ?? true,
        sameSite: mapSameSite(cookie.sameSite),
      }));

    if (mappedCookies.length === 0) {
      throw new Error("No valid linkedin.com cookies found in the payload.");
    }

    const outputPath = getLinkedinSessionPath();
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ cookies: mappedCookies, origins: [] }, null, 2), "utf-8");

    console.log(`[LinkedIn Session] Successfully imported ${mappedCookies.length} cookies directly.`);
    return mappedCookies.length;
  }

  static async generateColdNote(profileId: string, resumeId: string, templateId: string) {
    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    const template = await prisma.template.findUnique({ where: { id: templateId } });

    if (!profile || !resume || !template) {
      throw new Error("Recruiter profile, resume, or template not found.");
    }

    console.log(`[LinkedIn Outreach] Generating cold note for profile: ${profile.name}...`);
    const lengthInstructions = `${template.prompt}\n\nSTRICT REQUIREMENT: The generated message MUST be extremely concise and direct. It MUST fit within a strict 300 character count limit (including spaces and punctuation) so it can be sent inside a connection request note. Maximum 2-3 sentences.`;

    const generated = await geminiService.generateOutreachMessage(
      {
        name: profile.name,
        role: profile.role,
        company: profile.company,
        notes: profile.notes
      },
      {
        parsedText: resume.parsedText,
        skills: resume.skills,
        experience: resume.experience,
        projects: resume.projects
      },
      null,
      lengthInstructions,
      "LINKEDIN_CONNECTION_NOTE"
    );

    const draft = await prisma.outboundMessage.create({
      data: {
        profileId,
        channel: "LINKEDIN",
        subject: generated.subject || "Connection Request Note",
        content: generated.body,
        status: "DRAFT"
      }
    });

    return draft;
  }

  static async extractProfileFromFile(fileData: string, mimeType: string) {
    let base64Data = fileData;
    if (fileData.includes("base64,")) {
      base64Data = fileData.split("base64,")[1];
    }
    return await geminiService.extractProfileFromFile(base64Data, mimeType);
  }

  static async sendLinkedinMessages(messageIds: string[]) {
    const messages = await prisma.outboundMessage.findMany({
      where: {
        id: { in: messageIds },
        channel: "LINKEDIN"
      },
      include: {
        profile: true
      }
    });

    if (messages.length === 0) {
      throw new Error("No valid pending LinkedIn messages found.");
    }

    // Run Playwright Automation sequentially in the background
    (async () => {
      const sessionPath = getLinkedinSessionPath();
      const sessionFileExists = hasLinkedinSession();

      if (!sessionFileExists) {
        console.warn("[LinkedIn Outreach] Missing cached browser session cookies. Aborting dispatch.");
        for (const msg of messages) {
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "FAILED" }
          });
        }
        return;
      }

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        try {
          if (!msg.profile.linkedinUrl) {
            throw new Error("Recruiter target has no LinkedIn profile URL registered.");
          }

          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "SENDING" }
          });

          console.log(`[LinkedIn Outreach] Starting Playwright stealth browser to send DM to ${msg.profile.name}...`);
          
          let browser: any;
          let context: any;
          let isCDP = false;

          try {
            console.log("[LinkedIn Outreach] Attempting to connect to your active Chrome browser via CDP (port 9222)...");
            browser = await chromium.connectOverCDP("http://localhost:9222");
            const contexts = browser.contexts();
            context = contexts[0] || browser;
            isCDP = true;
            console.log("[LinkedIn Outreach] Connected successfully to your active Chrome browser!");
          } catch (cdpErr) {
            console.log("[LinkedIn Outreach] Active Chrome remote debugging port 9222 not available. Spawning dedicated headed stealth browser...");
            const stealth = await launchStealthBrowser({
              headless: false,
              sessionStatePath: sessionPath
            });
            browser = stealth.browser;
            context = stealth.context;
          }

          const page = await context.newPage();
          try {
            console.log(`[LinkedIn Outreach] Navigating to: ${msg.profile.linkedinUrl}`);
            await page.goto(msg.profile.linkedinUrl, {
              waitUntil: "domcontentloaded",
              timeout: 45000
            });

            try {
              await page.waitForSelector('main, .scaffold-layout__main, .pv-profile-card, .ph5', { timeout: 15000 });
              console.log("[LinkedIn Outreach] Profile page mounted successfully. Allowing assets to settle...");
              await page.waitForTimeout(4000 + Math.random() * 4000);
            } catch (e) {
              console.warn("[LinkedIn Outreach] Profile scaffold layout timed out. Using basic settle fallback.");
              await page.waitForTimeout(6000);
            }

            const currentUrl = page.url();
            if (!currentUrl.includes("linkedin.com/in/")) {
              throw new Error("Failed to load profile. Blocked or redirect detected.");
            }

            let messaged = false;

            const messageBtn = await LinkedinOutreachService.locateProfileCardButton(page, "Message", [
              'main#workspace > div > div > section a:has-text("Message")',
              'main#workspace > div > div > section button:has-text("Message")',
              'main a:has-text("Message")',
              'main button:has-text("Message")',
              'button.pvs-profile-actions__action:has-text("Message")',
              'button:has-text("Message")',
              'a:has-text("Message")'
            ]);

            if (messageBtn) {
              console.log("[LinkedIn Outreach] Direct Message button visible. Initiating chat window...");
              await messageBtn.click({ force: true });
              await page.waitForTimeout(3000 + Math.random() * 2000);

              const inmailModal = page.locator('div[role="dialog"]:has-text("InMail"), .premium-upsell-link, button:has-text("InMail")').first();
              const isPremiumLocked = await inmailModal.isVisible();

              if (isPremiumLocked) {
                console.log("[LinkedIn Outreach] Premium InMail paywall detected. Dismissing and pivoting to Connection invitation note...");
                const dismissBtn = page.locator('button[aria-label="Dismiss"], button[aria-label="Close"], button.artdeco-modal__dismiss').first();
                if (await dismissBtn.isVisible()) {
                  await dismissBtn.click({ force: true });
                  await page.waitForTimeout(1500);
                }
              } else {
                const chatInput = page.locator('div.msg-form__contenteditable[contenteditable="true"], div[role="textbox"], .msg-form__placeholder').first();
                if (await chatInput.isVisible()) {
                  await chatInput.focus();
                  await page.waitForTimeout(1000 + Math.random() * 1000);
                  await chatInput.type(msg.content, { delay: 60 + Math.random() * 60, timeout: 120000 });
                  await page.waitForTimeout(2000 + Math.random() * 2000);

                  const sendBtn = page.locator('button.msg-form__send-button, button[type="submit"]:has-text("Send")').first();
                  await sendBtn.click({ force: true });
                  await page.waitForTimeout(3000 + Math.random() * 2000);
                  messaged = true;
                  console.log("[LinkedIn Outreach] Direct message dispatched successfully!");
                }
              }
            }

            if (!messaged) {
              console.log("[LinkedIn Outreach] Direct Message not possible. Attempting Connection Invitation note...");
              
              let connectBtn = await LinkedinOutreachService.locateProfileCardButton(page, "Connect", [
                'main#workspace > div > div > section button:has-text("Connect")',
                'main#workspace > div > div > section a:has-text("Connect")',
                'main button:has-text("Connect")',
                'main a:has-text("Connect")',
                'button.pvs-profile-actions__action:has-text("Connect")',
                'button:has-text("Connect")'
              ]);

              if (!connectBtn || !(await connectBtn.isVisible())) {
                const moreBtn = await LinkedinOutreachService.locateProfileCardButton(page, "More Actions", [
                  'main#workspace > div > div > section button[aria-label*="more actions"]',
                  'main#workspace > div > div > section button:has-text("More")',
                  'main button[aria-label*="more actions"]',
                  'main button:has-text("More")',
                  'button[aria-label*="more actions"]',
                  'button:has-text("More")',
                  'button.artdeco-dropdown__trigger'
                ]);

                if (moreBtn && await moreBtn.isVisible()) {
                  await moreBtn.click({ force: true });
                  await page.waitForTimeout(1000 + Math.random() * 1500);
                  connectBtn = page.locator('span:has-text("Connect"), div[role="button"]:has-text("Connect"), button:has-text("Connect"), button[aria-label*="Connect"]').first();
                }
              }

              if (connectBtn && await connectBtn.isVisible()) {
                await connectBtn.click({ force: true });
                await page.waitForTimeout(3000 + Math.random() * 2000);

                const addNoteBtn = page.locator('button[aria-label="Add a note"], button:has-text("Add a note"), button.artdeco-button--secondary:has-text("note")').first();
                if (await addNoteBtn.isVisible()) {
                  await addNoteBtn.click({ force: true });
                  await page.waitForTimeout(1500 + Math.random() * 1500);

                  const noteArea = page.locator('textarea[name="message"], textarea#custom-message, textarea').first();
                  if (await noteArea.isVisible()) {
                    await noteArea.focus();
                    await page.waitForTimeout(1000 + Math.random() * 1000);
                    await noteArea.type(msg.content, { delay: 60 + Math.random() * 60, timeout: 120000 });
                    await page.waitForTimeout(2000 + Math.random() * 2000);

                    const sendInvitationBtn = page.locator('button[aria-label="Send now"], button:has-text("Send"), button.artdeco-button--primary:has-text("Send")').first();
                    await sendInvitationBtn.click({ force: true });
                    await page.waitForTimeout(3000 + Math.random() * 2000);
                    messaged = true;
                    console.log("[LinkedIn Outreach] Connection request invitation sent with personalized note!");
                  }
                } else {
                  console.log("[LinkedIn Outreach] Add a note restricted. Sending direct invitation...");
                  const sendInvitationBtn = page.locator('button[aria-label="Send now"], button:has-text("Send now"), button:has-text("Send")').first();
                  if (await sendInvitationBtn.isVisible()) {
                    await sendInvitationBtn.click({ force: true });
                    await page.waitForTimeout(3000 + Math.random() * 2000);
                    messaged = true;
                  }
                }
              }
            }

            if (messaged) {
              await prisma.outboundMessage.update({
                where: { id: msg.id },
                data: {
                  status: "SENT",
                  sentAt: new Date()
                }
              });

              await prisma.conversationTracker.upsert({
                where: { profileId: msg.profileId },
                update: { lastContactedAt: new Date() },
                create: {
                  profileId: msg.profileId,
                  status: "ACTIVE",
                  lastContactedAt: new Date()
                }
              });
            } else {
              throw new Error("Unable to locate direct Message or Connect action buttons on target profile.");
            }
          } finally {
            if (page && !page.isClosed()) {
              await page.close();
            }
            if (isCDP) {
              if (browser) {
                await browser.close();
              }
            } else {
              if (context) await context.close();
              if (browser) await browser.close();
            }
          }
        } catch (err) {
          console.error(`[LinkedIn Outreach] Send failed for recruiter ${msg.profile.name}:`, err);
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: { status: "FAILED" }
          });
        }

        if (i < messages.length - 1) {
          const delay = 45000 + Math.random() * 30000;
          console.log(`[LinkedIn Outreach] Applying account protection campaign delay: ${Math.round(delay / 1000)}s before next DM...`);
          await sleep(delay);
        }
      }
      console.log("[LinkedIn Outreach] Sequential background DM outreach campaign completed.");
    })().catch((err) => console.error("Outbox background executor error:", err));

    return messages.length;
  }
}
