import { chromium } from "playwright";

async function main() {
  console.log("=== DEBUG CHAT SEND BUTTON ===");
  try {
    const browser = await chromium.connectOverCDP("http://localhost:9222");
    const contexts = browser.contexts();
    const context = contexts[0] || browser;
    const pages = context.pages();
    
    let page = pages.find(p => p.url().includes("linkedin.com/in/"));
    if (!page) {
      console.log("No active LinkedIn profile page found.");
      return;
    }

    console.log("Found page:", page.url());
    
    // Check if chat overlay is open
    const chatInput = page.locator('div.msg-form__contenteditable[contenteditable="true"], div[role="textbox"], .msg-form__placeholder').first();
    const isChatVisible = await chatInput.isVisible();
    console.log("Chat input visible:", isChatVisible);
    
    if (isChatVisible) {
      // Type something if empty
      const currentText = await chatInput.innerText();
      console.log("Current text in input:", JSON.stringify(currentText));
      
      if (!currentText.trim()) {
        console.log("Typing test message...");
        await chatInput.focus();
        await chatInput.type("Hello from automated test!");
        await page.waitForTimeout(2000);
      }
      
      // Locate send button
      const sendBtn = page.locator('button.msg-form__send-button, button[type="submit"]:has-text("Send")').first();
      const isSendVisible = await sendBtn.isVisible();
      console.log("Send button visible:", isSendVisible);
      
      if (isSendVisible) {
        const isEnabled = await sendBtn.isEnabled();
        console.log("Send button enabled:", isEnabled);
        console.log("Send button Outer HTML:", await sendBtn.evaluate((el: any) => el.outerHTML));
        
        // Try clicking it
        console.log("Clicking Send button...");
        await sendBtn.click({ force: true });
        console.log("Send button clicked!");
      }
    } else {
      console.log("Please click 'Message' manually in your browser first to open the chat window.");
    }
  } catch (err) {
    console.error("Error in send button debug:", err);
  }
}

main();
