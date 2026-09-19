"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { JobCard } from "@/components/job-card";
import { buildDiscoveryFeed } from "@/lib/job-discovery";
import type { DiscoveryFreshness, DiscoverySource, Job } from "@/types/job";

type JobsBoardProps = { jobs: Job[]; fetchedAt?: string };

const sourceOptions: Array<{ label: string; value: DiscoverySource }> = [
  { label: "All sources", value: "all" },
  { label: "YC", value: "yc" },
  { label: "Wellfound", value: "wellfound" },
];

const freshnessOptions: Array<{ label: string; value: DiscoveryFreshness }> = [
  { label: "Any time", value: "all" },
  { label: "Last 24h", value: "24h" },
  { label: "Last 3 days", value: "72h" },
  { label: "Last 7 days", value: "7d" },
];

export function JobsBoard({ jobs }: JobsBoardProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<DiscoverySource>("all");
  const [freshness, setFreshness] = useState<DiscoveryFreshness>("72h");
  const deferredQuery = useDeferredValue(query);

  const feed = useMemo(
    () => buildDiscoveryFeed(jobs, { query: deferredQuery, source, freshness }),
    [deferredQuery, freshness, jobs, source],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Filter jobs</h1>
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-11 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-foreground/20"
              onChange={(event: { target: { value: string } }) => setQuery(event.target.value)}
              placeholder="Search roles, company, stack"
              type="search"
              value={query}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <div className="flex flex-wrap gap-2">
            {sourceOptions.map((option) => (
              <FilterChip active={source === option.value} key={option.value} label={option.label} onClick={() => setSource(option.value)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {freshnessOptions.map((option) => (
              <FilterChip active={freshness === option.value} key={option.value} label={option.label} onClick={() => setFreshness(option.value)} />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Jobs</h2>
          <p className="text-sm text-muted-foreground">{feed.length} found</p>
        </div>

        {feed.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-lg font-semibold tracking-tight text-foreground">No jobs match this filter set.</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Try widening the freshness window or switching sources.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {feed.map((job) => <JobCard job={job} key={job.id} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
