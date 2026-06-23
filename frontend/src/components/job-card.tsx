"use client";

import { ExternalLink, MapPin, MessageSquareText, Radar, Sparkles } from "lucide-react";

import type { DiscoveryItem } from "@/lib/job-discovery";

type JobCardProps = {
  job: DiscoveryItem;
  isSelected: boolean;
  onSelect: (job: DiscoveryItem) => void;
};

function getFreshnessClass(freshness: DiscoveryItem["freshness"]) {
  if (freshness === "hot") {
    return "border-emerald-200 bg-emerald-500/10 text-emerald-700";
  }

  if (freshness === "recent") {
    return "border-sky-200 bg-sky-500/10 text-sky-700";
  }

  if (freshness === "warm") {
    return "border-amber-200 bg-amber-500/10 text-amber-700";
  }

  return "border-border bg-secondary/70 text-muted-foreground";
}

export function JobCard({ job, isSelected, onSelect }: JobCardProps) {
  return (
    <article
      className={`group rounded-3xl border p-5 transition-all duration-200 ${
        isSelected
          ? "border-foreground/20 bg-card shadow-lg"
          : "border-border/70 bg-white/85 shadow-sm hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md"
      }`}
    >
      <button className="flex w-full flex-col gap-4 text-left" onClick={() => onSelect(job)} type="button">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {job.source}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getFreshnessClass(job.freshness)}`}>
              {job.freshnessLabel}
            </span>
            {job.channelName ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                <MessageSquareText className="h-3 w-3" />
                {job.channelName}
              </span>
            ) : null}
          </div>

          <div className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground px-3 py-1 text-[11px] font-semibold text-background">
            <Radar className="h-3.5 w-3.5" />
            {job.relevanceScore}% match
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{job.title}</h2>
          <p className="text-sm font-medium text-muted-foreground">{job.company}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {job.location}
          </span>
          {job.salary ? <span>{job.salary}</span> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {job.reasons.map((reason) => (
            <span
              key={`${job.id}-${reason}`}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground"
            >
              <Sparkles className="h-3 w-3" />
              {reason}
            </span>
          ))}
        </div>
      </button>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
        <button
          className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => onSelect(job)}
          type="button"
        >
          View details
        </button>

        {job.applyUrl ? (
          <a
            className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
            href={job.applyUrl}
            onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
          >
            Open job
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">No apply link yet</span>
        )}
      </div>
    </article>
  );
}
