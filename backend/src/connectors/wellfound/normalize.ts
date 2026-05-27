import { RawJob, Job } from "./types.js";

const WELLFOUND_BASE_URL = "https://wellfound.com";

/**
 * Normalizes raw scraped job cards into our system's unified schema.
 */
export function normalizeWellfoundJobs(rawJobs: RawJob[]): Job[] {
  return rawJobs.map((raw) => {
    // Standardize URL: store absolute URLs so frontend links never resolve to localhost.
    let applyUrl = raw.jobUrl.trim();

    if (applyUrl.startsWith("/")) {
      applyUrl = `${WELLFOUND_BASE_URL}${applyUrl}`;
    } else if (!applyUrl.startsWith("http")) {
      applyUrl = `${WELLFOUND_BASE_URL}/${applyUrl.replace(/^\/+/, "")}`;
    }

    // Clean location strings (e.g. removing bullet points or extra whitespace)
    let location = raw.location.replace(/^[•\-\s]+/, "").trim();
    if (!location) {
      location = "Remote / Multiple Locations";
    }

    // Clean salary strings
    const salary = raw.salary ? raw.salary.trim() : undefined;

    return {
      source: "wellfound",
      title: raw.title.trim(),
      company: raw.company.trim(),
      location,
      salary,
      applyUrl,
    };
  });
}
