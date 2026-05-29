"use client";

import { useMemo, useState } from "react";

import { JobCard } from "@/components/job-card";
import type { Job } from "@/types/job";

type JobsBoardProps = {
  jobs: Job[];
};

export function JobsBoard({ jobs }: JobsBoardProps) {
  const [query, setQuery] = useState("");
  const [entryLevelOnly, setEntryLevelOnly] = useState(true);

  const filteredJobs = useMemo(() => {
    let result = jobs;

    if (entryLevelOnly) {
      const seniorKeywords = [
        "senior", "sr", "lead", "staff", "principal", "manager", "director", "vp", "architect", "head"
      ];
      result = result.filter((job) => {
        const titleLower = job.title.toLowerCase();
        return !seniorKeywords.some((keyword) => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(titleLower);
        });
      });
    }

    // Filter out LinkedIn jobs older than 24 hours
    const now = new Date();
    const msIn24Hours = 24 * 60 * 60 * 1000;
    result = result.filter((job) => {
      if (job.source === "linkedin") {
        const jobDate = new Date(job.createdAt);
        return (now.getTime() - jobDate.getTime()) <= msIn24Hours;
      }
      return true;
    });

    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery) {
      result = result.filter((job) =>
        [job.title, job.company, job.location, job.source].some((field) =>
          field.toLowerCase().includes(normalizedQuery),
        ),
      );
    }

    return result;
  }, [jobs, query, entryLevelOnly]);

  return (
    <section className="jobs-section">
      <div className="jobs-section__header">
        <div>
          <p className="section-kicker">All listings</p>
          <h2>Fresh from PostgreSQL</h2>
        </div>

        <div className="jobs-toolbar">
          <div className="jobs-toolbar-controls">
            <label className="checkbox-filter" htmlFor="entry-level-toggle">
              <input
                id="entry-level-toggle"
                type="checkbox"
                checked={entryLevelOnly}
                onChange={(e) => setEntryLevelOnly(e.target.checked)}
              />
              <span>Entry Level (0-1 yrs exp)</span>
            </label>

            <label className="jobs-search" htmlFor="job-search">
              <span>Search jobs</span>
              <input
                id="job-search"
                name="job-search"
                type="search"
                placeholder="Title, company, location, source"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <p className="jobs-section__summary">{filteredJobs.length} matching roles</p>
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="empty-state">
          <h3>No matching jobs</h3>
          <p>Try a different keyword or clear the search to see every role in the database.</p>
        </div>
      ) : (
        <div className="jobs-grid">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </section>
  );
}
