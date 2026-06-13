import type { Job } from "@/types/job";
import { MapPin, DollarSign, ExternalLink, Target, Mail } from "lucide-react";

type JobCardProps = {
  job: Job;
  onTrack?: (job: Job) => void;
  onSelect?: (job: Job) => void;
  onColdMail?: (job: Job) => void;
};

export function getStatusStyle(status: string) {
  switch (status) {
    case "Applied":
      return { bg: "rgba(234, 179, 8, 0.08)", border: "rgba(234, 179, 8, 0.2)", text: "#d97706", label: "Applied" };
    case "Followed Up":
      return { bg: "rgba(99, 102, 241, 0.08)", border: "rgba(99, 102, 241, 0.2)", text: "#4f46e5", label: "Followed Up" };
    case "Interview Scheduled":
      return { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.2)", text: "#2563eb", label: "Interview" };
    case "Rejected":
      return { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.2)", text: "#dc2626", label: "Rejected" };
    case "Offer":
      return { bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.2)", text: "#059669", label: "Offer" };
    default:
      return { bg: "rgba(107, 114, 128, 0.08)", border: "rgba(107, 114, 128, 0.2)", text: "#4b5563", label: status };
  }
}

export function formatPostedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function JobCard({ job, onTrack, onSelect, onColdMail }: JobCardProps) {
  const statusStyle = job.status ? getStatusStyle(job.status) : null;
  return (
    <article 
      className="group relative flex flex-col md:flex-row md:items-center justify-between rounded-lg border border-border bg-card p-5 shadow-xs hover:border-foreground/30 hover:shadow-md hover:bg-secondary/20 hover:-translate-y-[1px] transition-all duration-200 gap-4"
      onClick={() => onSelect?.(job)}
      style={{ cursor: "pointer" }}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-sm border border-border bg-secondary/50 px-2 py-0.5 text-[10px] font-mono font-medium uppercase text-muted-foreground tracking-wider">{job.source}</span>
          <div className="flex gap-2 items-center text-[11px] text-muted-foreground font-medium">
            {statusStyle && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold tracking-wide border"
                style={{
                  background: statusStyle.bg,
                  borderColor: statusStyle.border,
                  color: statusStyle.text,
                }}
              >
                {statusStyle.label}
              </span>
            )}
            <span>Updated {formatPostedDate(job.updatedAt)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold leading-snug tracking-tight text-foreground group-hover:text-foreground/90 transition-colors truncate">{job.title}</h2>
          <p className="text-xs font-semibold text-muted-foreground">{job.company}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5 text-muted-foreground/80"><MapPin className="w-3.5 h-3.5 text-muted-foreground/50" /> {job.location}</span>
          <span className="flex items-center gap-1.5 text-muted-foreground/80"><DollarSign className="w-3.5 h-3.5 text-muted-foreground/50" /> {job.salary ?? "Salary not listed"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-border pt-3 md:pt-0 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2 items-center">
          {job.applyUrl ? (
            <a 
              href={job.applyUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="inline-flex items-center text-xs font-semibold text-foreground hover:opacity-85 gap-1 transition-opacity h-8 px-2"
            >
              Apply
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
          ) : (
            <span className="text-xs text-muted-foreground/50 px-2">No link</span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onColdMail?.(job);
            }}
            className="inline-flex items-center justify-center h-8 px-3 rounded-md text-[11px] font-medium border border-border bg-background text-foreground hover:bg-secondary transition-colors cursor-pointer gap-1"
          >
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            Cold Mail
          </button>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onTrack?.(job);
          }}
          className="inline-flex items-center justify-center h-8 px-3 rounded-md text-[11px] font-medium border border-border bg-background text-foreground hover:bg-secondary transition-colors cursor-pointer"
        >
          <Target className="w-3 h-3 mr-1" />
          {job.status ? "Update" : "Track"}
        </button>
      </div>
    </article>
  );
}
