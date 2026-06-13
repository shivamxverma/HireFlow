"use client";

import { useMemo, useState, useEffect } from "react";

import { JobCard, getStatusStyle, formatPostedDate } from "@/components/job-card";
import type { Job } from "@/types/job";
import { Plus, ExternalLink, ChevronDown, Pencil, Wand2, Search, Inbox, X } from "lucide-react";

interface ResumeVersion {
  id: string;
  pdfPath: string;
  latexPath: string;
}

interface Application {
  id: string;
  status: string;
  createdAt: string;
  jobId: string;
  errorMessage?: string | null;
  resumeVersion?: ResumeVersion | null;
  job: Job;
}

type JobsBoardProps = {
  jobs: Job[];
  defaultTab?: "explore" | "tracker" | "queue";
  fetchedAt?: string;
};

export function JobsBoard({ jobs: initialJobs, defaultTab = "explore", fetchedAt }: JobsBoardProps) {
  // Main reactive database state
  const [allJobs, setAllJobs] = useState<Job[]>(initialJobs);

  // Layout Tab State
  const [activeTab] = useState<"explore" | "tracker" | "queue">(defaultTab);

  // Search & Filter state for Explore
  const [query, setQuery] = useState("");
  const [entryLevelOnly, setEntryLevelOnly] = useState(true);

  // Search & Filter state for Tracker
  const [trackerQuery, setTrackerQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals state
  const [selectedJobForTrack, setSelectedJobForTrack] = useState<Job | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tracking Form Fields
  const [trackStatus, setTrackStatus] = useState("Applied");
  const [trackPlatform, setTrackPlatform] = useState("");
  const [trackNotes, setTrackNotes] = useState("");

  // Manual Creation Fields
  const [manualTitle, setManualTitle] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [manualSalary, setManualSalary] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualPlatform, setManualPlatform] = useState("College");
  const [manualStatus, setManualStatus] = useState("Applied");
  const [manualNotes, setManualNotes] = useState("");

  // Cold Mail state
  const [selectedJobForColdMail, setSelectedJobForColdMail] = useState<Job | null>(null);
  const [coldMailCompany, setColdMailCompany] = useState("");
  const [coldMailEmail, setColdMailEmail] = useState("");
  const [coldMailDescription, setColdMailDescription] = useState("");
  const [coldMailIsSubmitting, setColdMailIsSubmitting] = useState(false);

  // Inline dropdown status state (which job ID is currently opening the inline picker)
  const [activeInlineDropdownId, setActiveInlineDropdownId] = useState<string | null>(null);

  // Auto Apply & Job Details Drawer States
  const [selectedJobDetails, setSelectedJobDetails] = useState<Job | null>(null);

  const [pollingStatus, setPollingStatus] = useState<"IDLE" | "POLLING" | "SUCCESS" | "FAILED">("IDLE");
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Cleans up any running polling loops on unmount or drawer swap
  useEffect(() => {
    return () => {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }
    };
  }, [pollingIntervalId]);

  // Applications Queue States
  const [applications, setApplications] = useState<Application[]>([]);

  const fetchApplications = async () => {
    try {
      const res = await fetch("/api/v1/applications");
      const json = await res.json();
      if (json.success) {
        setApplications(json.data.applications);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Poll applications list if any application is currently in-progress
  useEffect(() => {
    const hasInProgress = applications.some((app) => 
      ["QUEUED", "GENERATING_RESUME", "READY_TO_APPLY", "APPLYING"].includes(app.status)
    );

    if (hasInProgress) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch("/api/v1/applications");
          const json = await res.json();
          if (json.success) {
            setApplications(json.data.applications);
          }
        } catch (err) {
          console.error(err);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [applications]);

  // Triggers the background auto apply worker pipeline
  const handleAutoApply = async (jobId: string) => {
    if (pollingStatus === "POLLING") return;

    setPollingStatus("POLLING");

    try {
      const response = await fetch("/api/v1/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const resJson = await response.json();
      if (resJson.success) {
        const app = resJson.data.application;
        fetchApplications(); // refresh the queue table instantly!

        if (pollingIntervalId) {
          clearInterval(pollingIntervalId);
        }

        const intervalId = setInterval(async () => {
          try {
            const pollRes = await fetch(`/api/v1/applications/${app.id}`);
            const pollJson = await pollRes.json();
            if (pollJson.success) {
              const currentApp = pollJson.data.application;

              if (currentApp.status === "APPLIED") {
                setPollingStatus("SUCCESS");
                clearInterval(intervalId);
                fetchApplications(); // refresh queue
                // Update local jobs status instantly
                setAllJobs((prev) =>
                  prev.map((job) =>
                    job.id === currentApp.jobId
                      ? { ...job, status: "Applied", appliedAt: currentApp.appliedAt }
                      : job
                  )
                );
              } else if (currentApp.status === "FAILED") {
                setPollingStatus("FAILED");
                clearInterval(intervalId);
                fetchApplications(); // refresh queue
              }
            }
          } catch (err) {
            console.error("[Polling Error]", err);
          }
        }, 2000);

        setPollingIntervalId(intervalId);
      } else {
        alert("Failed to queue application: " + resJson.message);
        setPollingStatus("FAILED");
        fetchApplications();
      }
    } catch (err) {
      console.error(err);
      alert("Error initiating auto apply workflow.");
      setPollingStatus("FAILED");
      fetchApplications();
    }
  };

  // 1. Process scraped jobs list for the Explore Board
  const filteredJobs = useMemo(() => {
    let result = allJobs.filter((job) => job.source !== "manual");

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
  }, [allJobs, query, entryLevelOnly]);

  // Dynamic sources count based on filtered jobs
  const filteredSourcesCount = useMemo(() => {
    return new Set(filteredJobs.map((job) => job.source)).size;
  }, [filteredJobs]);

  // 2. Process tracked jobs list for the Application Tracker
  const trackedJobs = useMemo(() => {
    let result = allJobs.filter((job) => job.status && job.status !== "Not Applied");

    if (statusFilter !== "all") {
      result = result.filter((job) => job.status === statusFilter);
    }

    const normalizedQuery = trackerQuery.trim().toLowerCase();
    if (normalizedQuery) {
      result = result.filter((job) =>
        [job.title, job.company, job.location, job.platform || "", job.source].some((field) =>
          field.toLowerCase().includes(normalizedQuery),
        ),
      );
    }

    // Sort by applied date (newest first)
    return [...result].sort((a, b) => {
      const dateA = a.appliedAt ? new Date(a.appliedAt).getTime() : 0;
      const dateB = b.appliedAt ? new Date(b.appliedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [allJobs, trackerQuery, statusFilter]);

  // 3. Metrics for the Tracker Dashboard
  const metrics = useMemo(() => {
    const tracked = allJobs.filter((job) => job.status && job.status !== "Not Applied");
    return {
      total: tracked.length,
      interviewing: tracked.filter((j) => j.status === "Interview Scheduled").length,
      offers: tracked.filter((j) => j.status === "Offer").length,
      rejected: tracked.filter((j) => j.status === "Rejected").length,
    };
  }, [allJobs]);

  // Handles starting the tracking flow
  const handleOpenTrackModal = (job: Job) => {
    setSelectedJobForTrack(job);
    setTrackStatus(job.status || "Applied");
    setTrackPlatform(job.platform || job.source || "LinkedIn");
    setTrackNotes(job.notes || "");
  };

  // Submits updates to a job status
  const handleUpdateStatus = async (jobId: string, status: string, platform: string, notes: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, platform, notes }),
      });

      const resJson = await response.json();
      if (resJson.success) {
        // Update local state reactively
        setAllJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status,
                  platform,
                  notes,
                  appliedAt: resJson.data.job.appliedAt,
                  updatedAt: resJson.data.job.updatedAt,
                }
              : job
          )
        );
        setSelectedJobForTrack(null);
      } else {
        alert("Failed to update status: " + resJson.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error updating status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submits a manually added job application
  const handleAddManualApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle || !manualCompany) {
      alert("Role Title and Company Name are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualTitle,
          company: manualCompany,
          location: manualLocation || "Remote",
          salary: manualSalary || null,
          applyUrl: manualUrl || null,
          status: manualStatus,
          platform: manualPlatform,
          notes: manualNotes,
        }),
      });

      const resJson = await response.json();
      if (resJson.success) {
        // Add new manual job at the start of local state
        setAllJobs((prev) => [resJson.data.job, ...prev]);
        setShowManualModal(false);

        // Reset form
        setManualTitle("");
        setManualCompany("");
        setManualLocation("");
        setManualSalary("");
        setManualUrl("");
        setManualPlatform("College");
        setManualStatus("Applied");
        setManualNotes("");
      } else {
        alert("Failed to add: " + resJson.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error tracking manual application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for platform styling tag colors
  const getPlatformTagClass = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes("college")) return "tag-college";
    if (p.includes("referral")) return "tag-referral";
    if (p.includes("linkedin")) return "tag-linkedin";
    if (p.includes("wellfound")) return "tag-wellfound";
    if (p.includes("yc") || p.includes("combinator")) return "tag-yc";
    return "tag-direct";
  };

  // Opens the Cold Mail modal and pre-fills Company and Description
  const handleOpenColdMailModal = (job: Job) => {
    setSelectedJobForColdMail(job);
    setColdMailCompany(job.company);
    setColdMailEmail("");
    setColdMailDescription(job.description || `${job.title} role at ${job.company}`);
  };

  // Submits the Cold Mail Lead
  const handleColdMailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coldMailCompany || !coldMailEmail || !coldMailDescription) {
      alert("Company Name, Recruiter Email, and Job Description Context are required.");
      return;
    }

    setColdMailIsSubmitting(true);
    try {
      const apiKey = typeof window !== "undefined"
        ? localStorage.getItem("outreach_api_key") || process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "bypass_key"
        : process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "bypass_key";

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

      const response = await fetch(`${API_BASE}/outreach/leads`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          leads: [
            {
              companyName: coldMailCompany,
              recipientEmail: coldMailEmail,
              jobDescription: coldMailDescription,
            },
          ],
        }),
      });

      const resJson = await response.json();
      if (resJson.success) {
        alert("Cold mail recruiter lead added successfully! You can review and send the email on the Gmail Outreach page.");
        setSelectedJobForColdMail(null);
        setColdMailCompany("");
        setColdMailEmail("");
        setColdMailDescription("");
      } else {
        alert("Failed to add recruiter lead: " + resJson.message);
      }
    } catch (err) {
      console.error(err);
      alert("Error adding cold mail recruiter lead.");
    } finally {
      setColdMailIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* ==================== EXPLORE BOARD TAB ==================== */}
      {activeTab === "explore" && (
        <section className="flex flex-col gap-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-border">
            <div>
              <p className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">Live Listings</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">Jobs Dashboard</h1>
              {fetchedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Updated {new Date(fetchedAt).toLocaleString("en-US")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-8" aria-label="Job board metrics">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase mb-0.5">Total Jobs</span>
                <span className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{filteredJobs.length}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">/ {allJobs.filter(j => j.source !== "manual").length}</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase mb-0.5">Sources</span>
                <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{filteredSourcesCount}</span>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Scraped Postings</h2>
              <p className="text-xs text-muted-foreground">{filteredJobs.length} matching roles found</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <label 
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer select-none bg-secondary/30 hover:bg-secondary/60 px-3 h-9 rounded-md border border-border transition-colors" 
                htmlFor="entry-level-toggle"
              >
                <input
                  id="entry-level-toggle"
                  type="checkbox"
                  checked={entryLevelOnly}
                  onChange={(e) => setEntryLevelOnly(e.target.checked)}
                  className="rounded-sm border-border bg-background text-foreground focus:ring-ring focus:ring-offset-background"
                />
                <span>Entry Level Only</span>
              </label>

              <div className="relative flex items-center">
                <Search className="absolute left-3 text-muted-foreground/60 w-3.5 h-3.5" aria-hidden="true" />
                <label htmlFor="job-search" className="sr-only">Search jobs</label>
                <input
                  id="job-search"
                  name="job-search"
                  type="search"
                  placeholder="Search by title, company, or source… e.g. engineer"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9 pr-4 h-9 w-full sm:w-[280px] rounded-md border border-border bg-background text-xs placeholder-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Cards Grid or Empty State */}
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-card text-muted-foreground my-4">
              <Inbox className="w-8 h-8 text-muted-foreground/30 mb-3" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No matching jobs</h3>
              <p className="text-xs text-muted-foreground max-w-[280px] mb-4">Try a different keyword or clear the search filters to see all available roles.</p>
              <button 
                onClick={() => { setQuery(""); setEntryLevelOnly(false); }} 
                className="inline-flex items-center justify-center h-8 px-3 rounded-md text-[11px] font-semibold border border-border bg-background text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onTrack={handleOpenTrackModal}
                  onColdMail={handleOpenColdMailModal}
                  onSelect={(j) => {
                    setSelectedJobDetails(j);
                    setPollingStatus("IDLE");
                    if (pollingIntervalId) {
                      clearInterval(pollingIntervalId);
                      setPollingIntervalId(null);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ==================== APPLICATION TRACKER TAB ==================== */}
      {activeTab === "tracker" && (
        <section className="flex flex-col gap-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-border">
            <div>
              <p className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">Pipeline Tracker</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">Application Tracker</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Manage your job application statuses, interviews, offers, and notes.
              </p>
            </div>
          </div>

          {/* Metrics Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs transition-all hover:border-foreground/10 flex flex-col gap-1">
              <span className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">Applications</span>
              <span className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{metrics.total}</span>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-xs transition-all hover:border-foreground/10 flex flex-col gap-1">
              <span className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">Interviewing</span>
              <span className="text-2xl font-bold tracking-tight tabular-nums text-blue-600 dark:text-blue-400">{metrics.interviewing}</span>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-xs transition-all hover:border-foreground/10 flex flex-col gap-1">
              <span className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">Offers Received</span>
              <span className="text-2xl font-bold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">{metrics.offers}</span>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-xs transition-all hover:border-foreground/10 flex flex-col gap-1">
              <span className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">Rejections</span>
              <span className="text-2xl font-bold tracking-tight tabular-nums text-red-600 dark:text-red-400">{metrics.rejected}</span>
            </div>
          </div>

          {/* Tracker Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Active Pipelines</h2>
              <p className="text-xs text-muted-foreground">{trackedJobs.length} roles currently tracked</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex items-center">
                <Search className="absolute left-3 text-muted-foreground/60 w-3.5 h-3.5" aria-hidden="true" />
                <label htmlFor="tracker-search" className="sr-only">Search tracked jobs</label>
                <input 
                  id="tracker-search"
                  type="text" 
                  placeholder="Filter by company or role… e.g. vercel"
                  value={trackerQuery}
                  onChange={(e) => setTrackerQuery(e.target.value)}
                  className="pl-9 pr-4 h-9 w-full sm:w-[220px] rounded-md border border-border bg-background text-xs placeholder-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring transition-colors"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <label htmlFor="status-filter" className="sr-only">Filter by status</label>
                <select 
                  id="status-filter"
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs placeholder-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring hover:bg-secondary/50 transition-colors cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="Applied">Applied</option>
                  <option value="Followed Up">Followed Up</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Offer">Offer</option>
                </select>
              </div>

              {/* Add Manual Application Button */}
              <button 
                className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-semibold hover:bg-foreground/90 transition-colors cursor-pointer gap-1.5 whitespace-nowrap"
                onClick={() => setShowManualModal(true)}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Track Application
              </button>
            </div>
          </div>

          {/* Applications list */}
          {trackedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-card text-muted-foreground my-4">
              <Inbox className="w-8 h-8 text-muted-foreground/30 mb-3" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No tracked applications</h3>
              <p className="text-xs text-muted-foreground max-w-[280px] mb-4">Go to the Explore tab to track a scraped job, or create a manual entry.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground font-mono font-semibold uppercase tracking-wider text-[10px]">
                    <th className="h-10 px-4 align-middle">Company</th>
                    <th className="h-10 px-4 align-middle">Role</th>
                    <th className="h-10 px-4 align-middle">Platform</th>
                    <th className="h-10 px-4 align-middle">Status</th>
                    <th className="h-10 px-4 align-middle">Date Applied</th>
                    <th className="h-10 px-4 align-middle">Notes & Details</th>
                  </tr>
                </thead>
                <tbody>
                  {trackedJobs.map((job) => {
                    const statusColor = getStatusStyle(job.status || "");
                    const isDropdownActive = activeInlineDropdownId === job.id;

                    return (
                      <tr key={job.id} className="border-b border-border hover:bg-secondary/40 transition-colors font-medium">
                        <td className="p-4 align-middle text-foreground font-semibold">
                          {job.company}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground">{job.title}</span>
                            {job.applyUrl && (
                              <a
                                href={job.applyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="Go to posting"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <span className={`inline-flex items-center rounded-sm border border-border bg-secondary/50 px-2 py-0.5 text-[10px] font-mono font-medium uppercase text-muted-foreground tracking-wider`}>
                            {job.platform || job.source || "Direct"}
                          </span>
                        </td>
                        <td className="p-4 align-middle">
                          {/* Premium interactive status dropdown */}
                          <div className="relative inline-block">
                            <button
                              className="inline-flex items-center px-2 py-0.5 rounded-sm font-semibold border text-[10px] transition-colors focus:outline-hidden hover:opacity-85 cursor-pointer"
                              style={{
                                background: statusColor.bg,
                                borderColor: statusColor.border,
                                color: statusColor.text,
                              }}
                              onClick={() =>
                                setActiveInlineDropdownId(isDropdownActive ? null : job.id)
                              }
                            >
                              {statusColor.label}
                              <ChevronDown className="w-3 h-3 ml-1 text-current opacity-70" />
                            </button>

                            {isDropdownActive && (
                              <div className="absolute z-50 min-w-32 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md top-full mt-1 left-0 flex flex-col p-1 animate-in fade-in-0 zoom-in-95">
                                {["Applied", "Followed Up", "Interview Scheduled", "Offer", "Rejected"].map((st) => (
                                  <button 
                                    key={st}
                                    className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs text-left outline-hidden transition-colors hover:bg-secondary hover:text-foreground font-medium" 
                                    onClick={() => {
                                      handleUpdateStatus(job.id, st, job.platform || job.source || "Direct", job.notes || "");
                                      setActiveInlineDropdownId(null);
                                    }}
                                  >
                                    {st}
                                  </button>
                                ))}
                                <div className="h-px bg-border my-1" />
                                <button
                                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs text-left outline-hidden transition-colors hover:bg-destructive/10 text-destructive font-medium"
                                  onClick={() => {
                                    handleUpdateStatus(job.id, "Not Applied", job.platform || job.source || "Direct", job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Stop Tracking
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 align-middle text-muted-foreground font-mono text-[11px] tabular-nums">
                          {job.appliedAt
                            ? formatPostedDate(job.appliedAt)
                            : "—"}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center justify-between gap-2 max-w-[200px]">
                            {job.notes ? (
                              <span className="truncate text-xs text-muted-foreground" title={job.notes}>
                                {job.notes}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/40 italic">No notes</span>
                            )}
                            <button 
                              className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                              onClick={() => handleOpenTrackModal(job)}
                              title="Edit notes/platform"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ==================== AUTO-APPLY LIVE QUEUE TAB ==================== */}
      {activeTab === "queue" && (
        <section className="flex flex-col gap-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-border">
            <div>
              <p className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">Background Worker</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">Auto-Apply Queue</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Monitor your background worker autonomously filling forms and generating AI resumes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-[10px] font-semibold font-mono tracking-wider bg-secondary border border-border text-foreground uppercase">
                ⚡ Active Worker
              </span>
            </div>
          </div>

          {/* Table or Empty State */}
          {applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed rounded-lg bg-card text-muted-foreground my-4">
              <Inbox className="w-8 h-8 text-muted-foreground/30 mb-3" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground mb-1">Queue is empty</h3>
              <p className="text-xs text-muted-foreground max-w-[280px]">No background applications are currently queued. Go to the Explore tab and click Auto Apply to initiate a job application.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden shadow-xs overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-muted-foreground font-mono font-semibold uppercase tracking-wider text-[10px]">
                    <th className="h-10 px-4 align-middle">Company</th>
                    <th className="h-10 px-4 align-middle">Role</th>
                    <th className="h-10 px-4 align-middle">Worker Status</th>
                    <th className="h-10 px-4 align-middle">Time Started</th>
                    <th className="h-10 px-4 align-middle">Agent Logs</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id} className="border-b border-border hover:bg-secondary/40 transition-colors font-medium">
                      <td className="p-4 align-middle text-foreground font-semibold">
                        {app.job?.company || "Unknown"}
                      </td>
                      <td className="p-4 align-middle text-foreground">
                        {app.job?.title || "Unknown"}
                      </td>
                      <td className="p-4 align-middle">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold border ${
                            app.status === "APPLIED"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                              : app.status === "FAILED"
                              ? "bg-red-500/10 border-red-500/20 text-red-600"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-600 animate-pulse"
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="p-4 align-middle text-muted-foreground font-mono text-[11px] tabular-nums">
                        {new Date(app.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4 align-middle">
                        {app.status === "FAILED" ? (
                          <span className="text-red-500 text-[11px] font-mono max-w-[250px] inline-block truncate" title={app.errorMessage || "Unknown error"}>
                            {app.errorMessage || "Failed during Playwright automation"}
                          </span>
                        ) : app.status === "APPLIED" ? (
                          <span className="text-emerald-600 text-[11px] font-mono">
                            Playwright flow completed ✓
                          </span>
                        ) : (
                          <span className="text-blue-500 text-[11px] font-mono flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                            Agent navigating form…
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ==================== SCRAPED JOB TRACK MODAL ==================== */}
      {selectedJobForTrack && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 flex items-center justify-center animate-in fade-in duration-200" onClick={() => setSelectedJobForTrack(null)}>
          <div className="fixed z-50 grid w-full max-w-md scale-100 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-lg font-sans" onClick={(e) => e.stopPropagation()}>
            <header className="flex flex-col space-y-1.5 text-left mb-4 relative">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider">Track application status</p>
                <h3 className="text-base font-semibold leading-none tracking-tight text-foreground mt-1">{selectedJobForTrack.company}</h3>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{selectedJobForTrack.title}</p>
              </div>
              <button 
                className="absolute right-0 top-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer" 
                onClick={() => setSelectedJobForTrack(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateStatus(selectedJobForTrack.id, trackStatus, trackPlatform, trackNotes);
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="modal-status" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Application Status</label>
                <select
                  id="modal-status"
                  value={trackStatus}
                  onChange={(e) => setTrackStatus(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                >
                  <option value="Applied">Applied</option>
                  <option value="Followed Up">Followed Up</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Offer">Offer</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Not Applied">Not Applied (Stop Tracking)</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="modal-platform" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Platform / Source</label>
                <select
                  id="modal-platform"
                  value={trackPlatform}
                  onChange={(e) => setTrackPlatform(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                >
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Wellfound">Wellfound</option>
                  <option value="YC">YC</option>
                  <option value="College">College</option>
                  <option value="Referral">Referral</option>
                  <option value="Direct">Direct Application</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="modal-notes" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Notes / Outreach log</label>
                <textarea
                  id="modal-notes"
                  placeholder="e.g. Referred by John Doe, contacted hiring manager on LinkedIn..."
                  rows={4}
                  value={trackNotes}
                  onChange={(e) => setTrackNotes(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-2 gap-2 sm:gap-0">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-4 py-2 transition-colors cursor-pointer"
                  onClick={() => setSelectedJobForTrack(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 py-2 transition-colors cursor-pointer" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ADD MANUAL APPLICATION MODAL ==================== */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 flex items-center justify-center animate-in fade-in duration-200" onClick={() => setShowManualModal(false)}>
          <div className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-lg font-sans" onClick={(e) => e.stopPropagation()}>
            <header className="flex flex-col space-y-1.5 text-left mb-4 relative">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider">New Entry</p>
                <h3 className="text-base font-semibold leading-none tracking-tight text-foreground mt-1">Track Application</h3>
              </div>
              <button 
                className="absolute right-0 top-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer" 
                onClick={() => setShowManualModal(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <form onSubmit={handleAddManualApplication} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="manual-company" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Company *</label>
                  <input
                    type="text"
                    id="manual-company"
                    required
                    placeholder="e.g. Google, Morphie Labs"
                    value={manualCompany}
                    onChange={(e) => setManualCompany(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="manual-title" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Role Title *</label>
                  <input
                    type="text"
                    id="manual-title"
                    required
                    placeholder="e.g. SDE Intern, Python Developer"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="manual-loc" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Location</label>
                  <input
                    type="text"
                    id="manual-loc"
                    placeholder="e.g. Remote, New York"
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="manual-sal" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Salary Info</label>
                  <input
                    type="text"
                    id="manual-sal"
                    placeholder="e.g. $60/hr, 12 LPA"
                    value={manualSalary}
                    onChange={(e) => setManualSalary(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="manual-plat" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Platform / Source</label>
                  <select
                    id="manual-plat"
                    value={manualPlatform}
                    onChange={(e) => setManualPlatform(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                  >
                    <option value="College">College Placement</option>
                    <option value="Referral">Referral</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Wellfound">Wellfound</option>
                    <option value="YC">YC</option>
                    <option value="Direct">Direct Application</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="manual-status" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Current Status</label>
                  <select
                    id="manual-status"
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                  >
                    <option value="Applied">Applied</option>
                    <option value="Followed Up">Followed Up</option>
                    <option value="Interview Scheduled">Interview Scheduled</option>
                    <option value="Offer">Offer</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="manual-url" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Job Posting URL (Optional)</label>
                <input
                  type="url"
                  id="manual-url"
                  placeholder="https://company.com/careers/job-id"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="manual-notes" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Outreach & Application Notes</label>
                <textarea
                  id="manual-notes"
                  placeholder="e.g. Interview scheduled with HR on Tuesday, referred by alumni..."
                  rows={3}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-2 gap-2 sm:gap-0">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-4 py-2 transition-colors cursor-pointer"
                  onClick={() => setShowManualModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 py-2 transition-colors cursor-pointer" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Tracking..." : "Save Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== PREMIUM JOB DETAILS SLIDE-OVER DRAWER ==================== */}
      {selectedJobDetails && (
        <div 
          className="fixed inset-0 bg-black/45 backdrop-blur-xs z-[999] flex justify-end transition-opacity animate-in fade-in duration-200"
          onClick={() => {
            setSelectedJobDetails(null);
            if (pollingIntervalId) {
              clearInterval(pollingIntervalId);
              setPollingIntervalId(null);
            }
          }}
        >
          <div 
            className="w-full max-w-[580px] h-full bg-background border-l border-border shadow-2xl flex flex-col z-[1000] cursor-default animate-in slide-in-from-right duration-300 ease-out font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <header className="p-6 border-b border-border bg-muted/20 relative flex flex-col gap-2">
              <button 
                onClick={() => {
                  setSelectedJobDetails(null);
                  if (pollingIntervalId) {
                    clearInterval(pollingIntervalId);
                    setPollingIntervalId(null);
                  }
                }}
                className="absolute top-6 right-6 w-8 h-8 rounded-full border border-border bg-background hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="pr-10">
                <span 
                  className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase border bg-secondary/50 text-foreground mb-2"
                >
                  {selectedJobDetails.source}
                </span>
                <h2 className="text-lg font-bold tracking-tight text-foreground mt-1">
                  {selectedJobDetails.title}
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  {selectedJobDetails.company}
                </p>
              </div>
            </header>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata Badges */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-secondary/40 border border-border p-3 rounded-md flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Location</span>
                  <span className="text-xs font-semibold text-foreground">{selectedJobDetails.location}</span>
                </div>
                <div className="bg-secondary/40 border border-border p-3 rounded-md flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Salary</span>
                  <span className="text-xs font-semibold text-foreground">{selectedJobDetails.salary ?? "Not Listed"}</span>
                </div>
              </div>

              {/* AUTO APPLY ACTIONS WIDGET - PREVIEW CARD (TEMPORARILY DISABLED FOR v1) */}
              <div className="relative overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 p-5 text-white shadow-xs">
                <div className="absolute top-0 right-0 h-32 w-32 bg-linear-to-bl from-zinc-700/20 via-zinc-900/0 to-transparent pointer-events-none" />
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <div>
                    <span className="inline-block bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-sm mb-2">
                      Coming in Version 2.0 ⚡
                    </span>
                    <h3 className="text-xs font-semibold tracking-tight text-white">
                      AI Auto Apply Pipeline
                    </h3>
                  </div>
                  <Wand2 className="w-4 h-4 text-zinc-400" />
                </div>
                
                <p className="text-[11px] text-zinc-400 leading-normal mb-3">
                  Our upcoming Version 2.0 will feature fully automated, background Playwright form filling and real-time resume tailoring via Gemini!
                </p>
                
                <div className="pt-3 border-t border-zinc-800 text-[11px] text-zinc-400 flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5">✓ 1-Click Tailored PDF Generation</span>
                  <span className="flex items-center gap-1.5">✓ Background Form Automated Delivery</span>
                  <span className="flex items-center gap-1.5">✓ Live Playwright Browser Status Monitoring</span>
                </div>
              </div>

              {/* Full JD Panel */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-foreground">Full Job Description</h3>
                {selectedJobDetails.description ? (
                  <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap bg-secondary/20 border border-border p-4 rounded-md font-sans">
                    {selectedJobDetails.description}
                  </div>
                ) : (
                  <div className="text-center bg-secondary/20 border border-border p-6 rounded-md space-y-2">
                    <p className="text-xs font-semibold text-foreground">Job description details are not cached.</p>
                    <p className="text-[11px] text-muted-foreground">
                      Click <strong>Auto Apply Now</strong> to pre-fetch the full JD live using Playwright before compiling your AI tailored resume!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== COLD MAIL MODAL ==================== */}
      {selectedJobForColdMail && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-200" onClick={() => setSelectedJobForColdMail(null)}>
          <div className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-background p-6 shadow-lg rounded-lg font-sans" onClick={(e) => e.stopPropagation()}>
            <header className="flex flex-col space-y-1.5 text-left mb-4 relative">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider">Recruiter Outreach</p>
                <h3 className="text-base font-semibold leading-none tracking-tight text-foreground mt-1">Generate Cold Mail</h3>
              </div>
              <button 
                className="absolute right-0 top-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer" 
                onClick={() => setSelectedJobForColdMail(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <form onSubmit={handleColdMailSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="cold-company" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Company Name</label>
                <input
                  type="text"
                  id="cold-company"
                  required
                  placeholder="e.g. Google"
                  value={coldMailCompany}
                  onChange={(e) => setColdMailCompany(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="cold-email" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Recruiter Email *</label>
                <input
                  type="email"
                  id="cold-email"
                  required
                  placeholder="recruiter@company.com"
                  value={coldMailEmail}
                  onChange={(e) => setColdMailEmail(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black"
                />
              </div>

              <div className="flex flex-col space-y-1.5">
                <label htmlFor="cold-desc" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Job Description Context</label>
                <textarea
                  id="cold-desc"
                  required
                  placeholder="Paste details of the role or specific specs..."
                  rows={5}
                  value={coldMailDescription}
                  onChange={(e) => setColdMailDescription(e.target.value)}
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black font-sans"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-2 gap-2 sm:gap-0">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-4 py-2 transition-colors cursor-pointer"
                  onClick={() => setSelectedJobForColdMail(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 py-2 transition-colors cursor-pointer" 
                  disabled={coldMailIsSubmitting}
                >
                  {coldMailIsSubmitting ? "Generating..." : "Generate Cold Mail"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
