"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, Clock3, Filter, Search, Waves } from "lucide-react";

import { JobCard } from "@/components/job-card";
import { buildDiscoveryFeed, getDiscoveryStats, type DiscoveryItem } from "@/lib/job-discovery";
import type { DiscoveryFreshness, DiscoverySource, Job } from "@/types/job";

type JobsBoardProps = {
  jobs: Job[];
  fetchedAt?: string;
};

const sourceOptions: Array<{ label: string; value: DiscoverySource }> = [
  { label: "All sources", value: "all" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Telegram", value: "telegram" },
  { label: "YC", value: "yc" },
  { label: "Wellfound", value: "wellfound" },
];

const freshnessOptions: Array<{ label: string; value: DiscoveryFreshness }> = [
  { label: "Any time", value: "all" },
  { label: "Last 24h", value: "24h" },
  { label: "Last 3 days", value: "72h" },
  { label: "Last 7 days", value: "7d" },
];

export function JobsBoard({ jobs, fetchedAt }: JobsBoardProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<DiscoverySource>("all");
  const [freshness, setFreshness] = useState<DiscoveryFreshness>("72h");
  const deferredQuery = useDeferredValue(query);

  const feed = useMemo(
    () => buildDiscoveryFeed(jobs, { query: deferredQuery, source, freshness }),
    [deferredQuery, freshness, jobs, source],
  );

  const stats = useMemo(() => getDiscoveryStats(feed), [feed]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedJob = useMemo<DiscoveryItem | null>(() => {
    if (feed.length === 0) {
      return null;
    }

    return feed.find((job) => job.id === selectedId) || feed[0];
  }, [feed, selectedId]);

  const topPicks = feed.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(247,248,250,0.95))] shadow-sm">
        <div className="grid gap-8 px-6 py-7 md:px-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
              <Waves className="h-3.5 w-3.5" />
              LinkedIn + Telegram discovery
            </div>

            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                Find the strongest recent software jobs before the feed gets noisy.
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                Ranked by freshness, role fit, and apply readiness.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Active matches" value={String(stats.total)} helper="Filtered discovery feed" />
              <MetricCard label="Hot jobs" value={String(stats.hot)} helper="Posted in the last 24 hours" />
              <MetricCard label="Average fit" value={`${stats.avgScore}%`} helper="Heuristic relevance score" />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border/80 bg-card/80 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Source mix</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">Where your best leads are coming from</h2>
              </div>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="mt-5 space-y-3">
              <SourceRow label="LinkedIn" value={stats.linkedin} accent="bg-sky-500" />
              <SourceRow label="Telegram" value={stats.telegram} accent="bg-emerald-500" />
              <SourceRow label="YC" value={stats.yc} accent="bg-amber-500" />
              <SourceRow label="Wellfound" value={stats.wellfound} accent="bg-rose-500" />
            </div>

            <div className="mt-5 rounded-2xl border border-border/70 bg-secondary/50 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Ranking logic</p>
              <p className="mt-1 leading-6">
                Scores reward recent postings, software-role keywords, remote or hybrid flexibility, and direct apply
                links. Senior-only roles and already-tracked jobs get pushed down.
              </p>
            </div>

            {fetchedAt ? (
              <p className="mt-4 text-xs text-muted-foreground">Refreshed {new Date(fetchedAt).toLocaleString("en-US")}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div className="rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Discovery controls</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Filter by source, freshness, and keywords</h2>
              </div>

              <div className="relative w-full lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-11 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-foreground/20"
                  onChange={(event: { target: { value: string } }) => setQuery(event.target.value)}
                  placeholder="Search roles, company, stack, channel"
                  type="search"
                  value={query}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <div className="flex flex-wrap gap-2">
                {sourceOptions.map((option) => (
                  <FilterChip
                    active={source === option.value}
                    key={option.value}
                    label={option.label}
                    onClick={() => setSource(option.value)}
                  />
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {freshnessOptions.map((option) => (
                  <FilterChip
                    active={freshness === option.value}
                    key={option.value}
                    label={option.label}
                    onClick={() => setFreshness(option.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Top matches</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Best jobs to open next</h2>
              </div>
              <p className="text-sm text-muted-foreground">{feed.length} roles ranked</p>
            </div>

            {feed.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-border bg-card px-6 py-12 text-center">
                <p className="text-lg font-semibold tracking-tight text-foreground">No LinkedIn or Telegram jobs match this filter set.</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Try widening the freshness window or switching back to all sources.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {topPicks.map((job) => (
                  <JobCard
                    isSelected={selectedJob?.id === job.id}
                    job={job}
                    key={job.id}
                    onSelect={(nextJob) => setSelectedId(nextJob.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {feed.length > 3 ? (
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Full feed</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Everything still worth checking</h2>
                </div>
              </div>

              <div className="space-y-4">
                {feed.slice(3).map((job) => (
                  <JobCard
                    isSelected={selectedJob?.id === job.id}
                    job={job}
                    key={job.id}
                    onSelect={(nextJob) => setSelectedId(nextJob.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/70 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Focused brief</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                {selectedJob ? selectedJob.title : "Select a job"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{selectedJob ? selectedJob.company : "Choose a listing from the ranked feed."}</p>
            </div>

            {selectedJob ? (
              <div className="space-y-5 px-5 py-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailStat icon={BriefcaseBusiness} label="Source" value={selectedJob.source} />
                  <DetailStat icon={Clock3} label="Age" value={`${selectedJob.freshnessHours}h ago`} />
                </div>

                <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Why it ranked high</p>
                    <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background">
                      {selectedJob.relevanceScore}% fit
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedJob.reasons.map((reason) => (
                      <span key={`${selectedJob.id}-${reason}-detail`} className="rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-foreground">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Job summary</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {selectedJob.description?.trim()
                      ? selectedJob.description.slice(0, 560)
                      : "No structured description was captured yet for this job. Open the posting directly to inspect the full requirements."}
                    {selectedJob.description && selectedJob.description.length > 560 ? "..." : ""}
                  </p>
                </div>

                {selectedJob.channelName ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-500/10 p-4 text-sm text-emerald-800">
                    Telegram origin: <span className="font-semibold">{selectedJob.channelName}</span>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  {selectedJob.applyUrl ? (
                    <a
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                      href={selectedJob.applyUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open posting
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  ) : null}

                  <button
                    className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                    onClick={() => {
                      setQuery(selectedJob.company);
                      setSource(selectedJob.source as DiscoverySource);
                    }}
                    type="button"
                  >
                    Find similar
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-10 text-sm text-muted-foreground">No job is selected.</div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-card/90 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function SourceRow({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-2.5 w-2.5 rounded-full ${accent}`} />
      <div className="flex flex-1 items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function DetailStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
