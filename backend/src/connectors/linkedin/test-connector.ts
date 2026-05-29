import { searchLinkedinJobs } from "./index.js";
import { normalizeLinkedinJobs } from "./normalize.js";
import { parseLinkedinJobs } from "./parse.js";
import { buildLinkedinSearchUrl } from "./search.js";

async function runTests() {
  console.log("=== STARTING LINKEDIN CONNECTOR ARCHITECTURE TESTS ===");

  const url = buildLinkedinSearchUrl({
    keywords: "Backend Engineer",
    location: "Bengaluru",
    experienceLevel: "entry",
    workplaceType: "remote",
    page: 2,
  });

  console.log(`Generated URL: ${url}`);

  const mockHtml = `
    <ul>
      <li class="jobs-search-results__list-item">
        <div class="job-card-container">
          <a class="job-card-list__title" href="/jobs/view/123456789/?currentJobId=123456789">
            Backend Engineer
          </a>
          <div class="job-card-container__primary-description">Stripe</div>
          <div class="job-card-container__metadata-item">Bengaluru, Karnataka, India</div>
          <time>1 day ago</time>
        </div>
      </li>
    </ul>
  `;

  const rawJobs = parseLinkedinJobs(mockHtml);
  const normalizedJobs = normalizeLinkedinJobs(rawJobs);

  console.log("Normalized Jobs:", JSON.stringify(normalizedJobs, null, 2));

  if (
    normalizedJobs.length === 1 &&
    normalizedJobs[0].source === "linkedin" &&
    normalizedJobs[0].externalId === "123456789" &&
    normalizedJobs[0].title === "Backend Engineer"
  ) {
    console.log("✅ Mock parser + normalizer test passed.");
  } else {
    console.log("❌ Mock parser + normalizer test failed.");
  }

  if (process.env.LINKEDIN_LIVE_TEST === "true") {
    const { upsertJobs } = await import("../../services/job-store.service.js");
    const { prisma } = await import("../../services/prisma.js");

    try {
      const liveJobs = await searchLinkedinJobs({
        keywords: "Backend Engineer",
        location: "Bengaluru",
        experienceLevel: "entry",
      });

      console.log(`Live LinkedIn connector returned ${liveJobs.length} jobs.`);
      
      if (liveJobs.length > 0) {
        console.log("Sample:", JSON.stringify(liveJobs[0], null, 2));
        
        // Store/Persist in Neon PostgreSQL
        const storeResult = await upsertJobs(liveJobs);
        console.log(`[Neon Database] Store complete: ${storeResult.upserted} LinkedIn jobs written/updated in database.`);

        // Query database count
        const dbCount = await prisma.job.count();
        console.log(`[Neon Database] Total jobs currently in Neon PostgreSQL: ${dbCount}`);
      } else {
        console.log("⚠️ Live fetch returned 0 jobs. Check cookies or search query.");
      }
    } catch (error) {
      console.error("❌ Live LinkedIn integration test failed:", error);
    } finally {
      await prisma.$disconnect();
      console.log("[Neon Database] Disconnected pool cleanly.");
    }
  } else {
    console.log("Skipping live LinkedIn request. Run pnpm save-session:linkedin, then set LINKEDIN_LIVE_TEST=true.");
  }
}

runTests();
