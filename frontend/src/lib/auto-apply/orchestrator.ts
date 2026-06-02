import { Page } from "playwright";
import { extractFormFields } from "./extraction";
import { mapFieldsToProfile, UserProfileData } from "./mapping";
import { fillFormFields } from "./filling";

export async function runAutoApplyOrchestrator(
  page: Page, 
  profile: UserProfileData,
  maxSteps: number = 5
) {
  let step = 0;
  
  while (step < maxSteps) {
    console.log(`\n--- Auto Apply Step ${step + 1} ---`);
    // Wait for the DOM to load, then give it a short explicit delay to let React render forms.
    // DO NOT use 'networkidle' on LinkedIn because background tracking pixels never stop polling!
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    // 1. Extract
    const fields = await extractFormFields(page);
    console.log(`Extracted ${fields.length} fields.`);
    if (fields.length === 0) {
      console.log("No form fields found on this page. Looking for an 'Apply' or 'Next' button to proceed...");
      // Try to find an apply/next button to navigate to the actual form
      const continueBtns = await page.$$('a:has-text("Apply"), button:has-text("Apply"), a:has-text("Next"), button:has-text("Next")');
      let clickedContinue = false;
      for (const btn of continueBtns) {
         if (await btn.isVisible()) {
             console.log("Found an Apply/Next button! Clicking it to reach the form...");
             try {
                 await btn.click({ timeout: 5000, force: true });
                 clickedContinue = true;
                 break;
             } catch (e) {
                 console.warn("Click failed, trying another button...");
             }
         }
      }
      if (clickedContinue) {
         await page.waitForTimeout(3000);
         step++;
         continue; // Loop again to extract fields on the new page
      } else {
         console.log("No more fields found and no Apply button found. Form might be completed or error.");
         break;
      }
    }

    // 2. Map
    const mapped = mapFieldsToProfile(fields, profile);

    // 3. Fill
    await fillFormFields(page, mapped, profile);

    // 4. Submit / Next
    // Look for a submit or next button
    const nextButtons = await page.$$('button[type="submit"], button:has-text("Next"), button:has-text("Continue"), button:has-text("Submit"), button:has-text("Apply")');
    
    let clicked = false;
    for (const btn of nextButtons) {
       if (await btn.isVisible()) {
           console.log("Found visible navigation button. Clicking...");
           try {
               await btn.click({ timeout: 5000, force: true });
               clicked = true;
               break;
           } catch (e) {
               console.warn("Click failed, trying next button...", e);
           }
       }
    }

    if (clicked) {
       // wait for navigation or dom change
       await page.waitForTimeout(3000); 
    } else {
       console.log("No visible next/submit button found. Ending workflow.");
       break;
    }

    step++;
  }

  console.log("Auto Apply Workflow Completed.");
}
