import * as cheerio from "cheerio";
import { RawJob } from "./types.js";

/**
 * Extracts raw job card listings from Wellfound HTML via Cheerio.
 * Wellfound typically groups listings under "Startup cards", where one company
 * lists one or more active roles. We parse these groups and individual job rows.
 */
export function parseWellfoundJobs(html: string): RawJob[] {
  const $ = cheerio.load(html);
  const rawJobs: RawJob[] = [];
  const seenCards = new Set<cheerio.Element>();
  const isRealJobHref = (href: string) =>
    href.includes("/jobs/") &&
    !href.endsWith("/jobs/home") &&
    !href.endsWith("/jobs") &&
    !href.includes("/jobs/dashboard") &&
    !href.includes("/jobs/saved") &&
    !href.includes("/jobs/matches") &&
    !href.includes("/jobs/messages") &&
    !href.includes("/jobs/applications");

  // Selector 1: Wellfound Startup Cards (grouped by company)
  const startupCards = $('[data-testid="startup-header"]')
    .map((_, element) =>
      $(element)
        .closest('div.mb-6.w-full.rounded.border.border-gray-400.bg-white, div.mb-6.w-full.rounded, article, section')
        .get(0) || element,
    )
    .get()
    .filter((element) => {
      if (seenCards.has(element)) {
        return false;
      }
      seenCards.add(element);
      return true;
    });

  console.log(`[Wellfound Parser] Found ${startupCards.length} potential company cards.`);

  if (startupCards.length > 0) {
    startupCards.forEach((card) => {
      const $card = $(card);

      // Extract Company Name
      // Look for data-test, headings, or class containing company/header/name
      let company = $card
        .find('a[href*="/company/"] h2, a[href*="/startup/"] h2, [class*="styles_name__"], [class*="companyName"], h2, h3')
        .first()
        .text()
        .trim();
      if (!company) {
        // Fallback to finding the company avatar or main title link
        company = $card.find('a[href*="/startup/"]').first().text().trim();
      }

      // If still not found, search for any bold text or fallback header
      if (!company) {
        company = $card.find("strong, b").first().text().trim() || "Unknown Company";
      }

      // Clean company name (sometimes contains logo alt texts or multiple lines)
      company = company.split("\n")[0].trim();

      // Find Job Listings under this company
      // Listings are usually elements containing "/jobs/" or having class matching jobListing/listing
      const jobRows = $card
        .find('a[href*="/jobs/"]')
        .filter((_, link) => isRealJobHref($(link).attr("href") || ""))
        .map((_, link) =>
          $(link).closest('div.mb-4.w-full, div.min-h-[50px], li, article, section').get(0) || link,
        )
        .get();

      jobRows.forEach((row) => {
        const $row = $(row);

        // Extract Title and URL
        const titleLink = $row.find('a[href*="/jobs/"], [class*="styles_title__"], a').first();
        const title = titleLink.text().trim();
        const jobUrl = titleLink.attr("href") || "";

        if (!title || !jobUrl || !isRealJobHref(jobUrl)) return; // Skip if no title or link

        // Extract Location and Salary
        // They are typically in metadata tags/divs or inline list items
        let location = "";
        let salary = "";
        const metaTexts = $row
          .find("span")
          .map((_, item) => $(item).text().replace(/\s+/g, " ").trim())
          .get()
          .filter(Boolean);

        for (const text of metaTexts) {
          if (!salary && (text.includes("$") || text.includes("£") || text.includes("€") || text.includes("₹") || /^[0-9]+k/i.test(text))) {
            salary = text;
            continue;
          }

          if (
            !location &&
            !text.toLowerCase().includes("save") &&
            !text.toLowerCase().includes("apply") &&
            !text.toLowerCase().includes("full-time") &&
            !text.toLowerCase().includes("part-time") &&
            !text.toLowerCase().includes("contract") &&
            !text.toLowerCase().includes("today") &&
            !text.toLowerCase().includes("week") &&
            !text.toLowerCase().includes("month") &&
            (text.toLowerCase().includes("remote") ||
              text.toLowerCase().includes("hybrid") ||
              text.toLowerCase().includes("in office") ||
              text.toLowerCase().includes("india") ||
              /^[A-Za-z].+/.test(text))
          ) {
            location = text;
          }
        }

        // Clean up extracted metadata
        const cleanSalary = salary.replace(/\s+/g, " ").trim();
        const cleanLocation = location.replace(/\s+/g, " ").trim() || "Remote / Specified Inside";

        rawJobs.push({
          title,
          company,
          location: cleanLocation,
          salary: cleanSalary || undefined,
          jobUrl,
        });
      });
    });
  }

  // Fallback Selector 2: Direct job rows/cards if not grouped by company cards
  if (rawJobs.length === 0) {
    console.log("[Wellfound Parser] Startup cards yielded 0 jobs, attempting direct job card parsing...");
    
    // Look for all anchors pointing to jobs
    const directJobLinks = $('a[href*="/jobs/"]').filter((_, link) => isRealJobHref($(link).attr("href") || ""));
    directJobLinks.each((_, link) => {
      const $link = $(link);
      const title = $link.text().trim();
      const jobUrl = $link.attr("href") || "";

      if (title.length > 3 && !title.toLowerCase().includes("apply") && jobUrl) {
        const container = $link.closest('div.mb-6.w-full.rounded, div.mb-4.w-full, article, section, li');
        const company =
          container.find('a[href*="/company/"] h2, a[href*="/startup/"] h2, [class*="company"], [class*="brand"]').first().text().trim() ||
          "Unknown Company";

        let salary = "";
        let location = "";
        container.find("span").each((_, item) => {
          const text = $(item).text().replace(/\s+/g, " ").trim();
          if (!text) return;

          if (!salary && (text.includes("$") || text.includes("£") || text.includes("€") || text.includes("₹") || /^[0-9]+k/i.test(text))) {
            salary = text;
            return;
          }

          if (
            !location &&
            (text.toLowerCase().includes("remote") ||
              text.toLowerCase().includes("hybrid") ||
              text.toLowerCase().includes("india") ||
              text.length > 2)
          ) {
            location = text;
          }
        });
        
        rawJobs.push({
          title,
          company,
          location: location || "Remote / Multiple Locations",
          salary: salary || undefined,
          jobUrl,
        });
      }
    });
  }

  // Deduplicate results based on jobUrl
  const seenUrls = new Set<string>();
  const uniqueJobs = rawJobs.filter((job) => {
    if (!job.jobUrl) return false;
    const isDuplicate = seenUrls.has(job.jobUrl);
    seenUrls.add(job.jobUrl);
    return !isDuplicate;
  });

  console.log(`[Wellfound Parser] Successfully extracted ${uniqueJobs.length} unique jobs.`);
  return uniqueJobs;
}
