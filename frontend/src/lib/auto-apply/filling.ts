import { Page } from "playwright";
import { MappedField } from "./mapping";
import { generateAiAnswer, UserProfileData } from "./ai-answer"; // Adjust imports
import fs from "fs";

export async function fillFormFields(
  page: Page, 
  mappedFields: MappedField[], 
  profile: UserProfileData
) {
  for (const { field, value, requiresAi } of mappedFields) {
    if (!field.id) continue;
    
    let textToFill = value || '';

    if (requiresAi && !value) {
      console.log(`Generating AI answer for: ${field.label}`);
      textToFill = await generateAiAnswer(field.label, profile);
    }

    try {
      if (field.type === 'file') {
        if (textToFill && fs.existsSync(textToFill)) {
           await page.setInputFiles(field.id, textToFill, { timeout: 3000 });
           console.log(`Uploaded resume: ${textToFill}`);
        } else {
           console.warn(`Resume file not found at ${textToFill}`);
        }
      } else if (field.type === 'radio' || field.type === 'checkbox') {
        // We could click the label or check the input
        await page.check(field.id, { force: true, timeout: 3000 });
        console.log(`Checked ${field.type}: ${field.label}`);
      } else if (field.type === 'select') {
        // Just select the first option or a mapped option
        if (field.options && field.options.length > 1) {
           await page.selectOption(field.id, { label: field.options[1] }, { timeout: 3000, force: true }); // hack: pick second option
        }
      } else {
        if (textToFill) {
          // Fill text input or textarea
          await page.fill(field.id, textToFill, { force: true, timeout: 3000 });
          console.log(`Filled ${field.label} with: ${textToFill.substring(0, 20)}...`);
        }
      }
    } catch (e) {
      console.error(`Failed to fill field ${field.label} (${field.id})`, e);
    }
  }
}
