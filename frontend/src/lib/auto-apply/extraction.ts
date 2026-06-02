import { Page } from "playwright";

export interface FormField {
  id: string; // The CSS selector or ID to locate it later
  type: string;
  label: string;
  required: boolean;
  options?: string[]; // for select or radio
}

export async function extractFormFields(page: Page): Promise<FormField[]> {
  const fields = await page.evaluate(() => {
    const extracted: FormField[] = [];
    const elements = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
    
    elements.forEach((el, index) => {
      const tag = el.tagName.toLowerCase();
      let type = 'text';
      if (tag === 'input') {
        type = (el as HTMLInputElement).type.toLowerCase();
      } else if (tag === 'textarea') {
        type = 'textarea';
      } else if (tag === 'select') {
        type = 'select';
      }

      // Find an identifier that can be used as a playwright locator.
      // Easiest is to generate a unique selector.
      let id = '';
      if (el.id) {
        id = `[id="${el.id.replace(/"/g, '\\"')}"]`;
      } else if (el.getAttribute('name')) {
        id = `[name="${el.getAttribute('name')}"]`;
      } else {
        // Fallback: we could add a temporary attribute to uniquely identify it later
        const uniqueId = `hireflow-field-${index}`;
        el.setAttribute('data-hireflow-id', uniqueId);
        id = `[data-hireflow-id="${uniqueId}"]`;
      }

      const required = (el as HTMLInputElement).required || el.hasAttribute('aria-required');
      
      // Attempt to find a label
      let labelText = '';
      
      // 1. Check aria-label
      if (el.hasAttribute('aria-label')) {
        labelText = el.getAttribute('aria-label') || '';
      }
      
      // 2. Check associated <label> via id
      if (!labelText && el.id) {
        const labelEl = document.querySelector(`label[for="${el.id}"]`);
        if (labelEl) labelText = labelEl.textContent || '';
      }
      
      // 3. Check if wrapped inside a <label>
      if (!labelText && el.closest('label')) {
        const clone = el.closest('label')?.cloneNode(true) as HTMLElement;
        const inputInside = clone.querySelector('input, textarea, select');
        if (inputInside) inputInside.remove();
        labelText = clone.textContent || '';
      }

      // 4. Check placeholder
      if (!labelText && el.hasAttribute('placeholder')) {
        labelText = el.getAttribute('placeholder') || '';
      }
      
      // 5. Fallback to name or id (remove # or brackets)
      if (!labelText) {
        labelText = el.getAttribute('name') || el.id || '';
      }

      const cleanLabel = labelText.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();

      let options: string[] | undefined;
      if (type === 'select') {
        const optElements = Array.from((el as HTMLSelectElement).options);
        options = optElements.map(o => o.text.trim());
      } else if (type === 'radio' || type === 'checkbox') {
        // For radio/checkbox, the label is usually a sibling or wrapper
        const wrapper = el.closest('label') || el.parentElement;
        if (wrapper) {
           const clone = wrapper.cloneNode(true) as HTMLElement;
           const inputInside = clone.querySelector('input');
           if (inputInside) inputInside.remove();
           labelText = clone.textContent?.trim() || cleanLabel;
        }
      }

      extracted.push({
        id,
        type,
        label: cleanLabel || labelText || 'Unknown Field',
        required,
        options,
      });
    });

    return extracted;
  });

  return fields;
}
