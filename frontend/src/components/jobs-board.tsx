"use client";

import { useMemo, useState, useEffect } from "react";

import { JobCard, getStatusStyle } from "@/components/job-card";
import type { Job } from "@/types/job";
import { GmailOutreach } from "@/components/gmail-outreach";
import { LinkedinOutreach } from "@/components/linkedin-outreach";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, ChevronDown, Pencil, Wand2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

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
};

export function JobsBoard({ jobs: initialJobs, defaultTab = "explore" }: JobsBoardProps) {
  // Main reactive database state
  const [allJobs, setAllJobs] = useState<Job[]>(initialJobs);

  // Layout Tab State
  const [activeTab, setActiveTab] = useState<"explore" | "tracker" | "queue">(defaultTab);

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

  // Inline dropdown status state (which job ID is currently opening the inline picker)
  const [activeInlineDropdownId, setActiveInlineDropdownId] = useState<string | null>(null);

  // Auto Apply & Job Details Drawer States
  const [selectedJobDetails, setSelectedJobDetails] = useState<Job | null>(null);
  const [activeApplication, setActiveApplication] = useState<Application | null>(null);
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
    setActiveApplication(null);

    try {
      const response = await fetch("/api/v1/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const resJson = await response.json();
      if (resJson.success) {
        const app = resJson.data.application;
        setActiveApplication(app);
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
              setActiveApplication(currentApp);

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

  return (
    <div className="w-full flex flex-col gap-6">
      {/* ==================== EXPLORE BOARD TAB ==================== */}
      {activeTab === "explore" && (
        <section className="flex flex-col gap-6">
          <div className="bg-card text-card-foreground border rounded-xl shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-primary font-semibold text-sm uppercase tracking-wider">All listings</p>
              <h2 className="text-2xl font-bold mt-1">Fresh scraped roles</h2>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer" htmlFor="entry-level-toggle">
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
            <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-xl bg-card text-muted-foreground my-8">
              <h3 className="text-lg font-semibold leading-none tracking-tight">No matching jobs</h3>
              <p>Try a different keyword or clear the search to see every role in the database.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onTrack={handleOpenTrackModal}
                  onSelect={(j) => {
                    setSelectedJobDetails(j);
                    setActiveApplication(null);
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
        <section className="flex flex-col gap-6">
          {/* Metrics Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 relative overflow-hidden">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Applications</span>
                <span className="text-3xl font-bold">{metrics.total}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/20" />
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 relative overflow-hidden">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Interviewing</span>
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{metrics.interviewing}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/20" />
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 relative overflow-hidden">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Offers Received</span>
                <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.offers}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/20" />
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 relative overflow-hidden">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Rejections</span>
                <span className="text-3xl font-bold text-red-600 dark:text-red-400">{metrics.rejected}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/20" />
            </div>
          </div>

          {/* Tracker Toolbar */}
          <div className="bg-card text-card-foreground border rounded-xl shadow-sm p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold">My Applications</h2>
              <p className="text-sm text-muted-foreground">{trackedJobs.length} active pipelines</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {/* Search */}
              <div className="w-full sm:w-auto">
                <input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Filter by company, role..."
                  value={trackerQuery}
                  onChange={(e) => setTrackerQuery(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <div className="w-full sm:w-auto">
                <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="Applied">Applied</option>
                  <option value="Followed Up">Followed Up</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Offer">Offer</option>
                </select>
              </div>

              {/* Add Manual Application Button */}
              <button className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full sm:w-auto whitespace-nowrap" onClick={() => setShowManualModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Track Application
              </button>
            </div>
          </div>

          {/* Applications list */}
          {trackedJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-xl bg-card text-muted-foreground my-8">
              <h3 className="text-lg font-semibold leading-none tracking-tight">No tracked applications yet</h3>
              <p>Go to the &quot;Explore Board&quot; to track a scraped job, or click &quot;Track Application&quot; to add a manual entry!</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Company</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Role</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Platform</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date Applied</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Notes & Details</th>
                  </tr>
                </thead>
                <tbody>
                  {trackedJobs.map((job) => {
                    const statusColor = getStatusStyle(job.status || "");
                    const isDropdownActive = activeInlineDropdownId === job.id;

                    return (
                      <tr key={job.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle">
                          <strong>{job.company}</strong>
                        </td>
                        <td className="p-4 align-middle flex items-center gap-2">
                          <span>{job.title}</span>
                          {job.applyUrl && (
                            <a
                              href={job.applyUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-url-icon"
                              title="Go to posting"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </td>
                        <td className="p-4 align-middle">
                          <span className={`platform-pill ${getPlatformTagClass(job.platform || job.source || "")}`}>
                            {job.platform || job.source}
                          </span>
                        </td>
                        <td className="p-4 align-middle">
                          {/* Premium interactive status dropdown */}
                          <div className="relative">
                            <button
                              className="inline-flex items-center px-2 py-0.5 rounded-full font-semibold shadow-sm text-[0.68rem] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              style={{
                                background: statusColor.bg,
                                color: statusColor.text,
                              }}
                              onClick={() =>
                                setActiveInlineDropdownId(isDropdownActive ? null : job.id)
                              }
                            >
                              {statusColor.label}
                              <ChevronDown className="w-3.5 h-3.5 ml-1" />
                            </button>

                            {isDropdownActive && (
                              <div className="absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md top-full mt-1 left-0 flex flex-col p-1 animate-in fade-in-0 zoom-in-95">
                                <button className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50" onClick={() => {
                                    handleUpdateStatus(job.id, "Applied", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Applied
                                </button>
                                <button className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50" onClick={() => {
                                    handleUpdateStatus(job.id, "Followed Up", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Followed Up
                                </button>
                                <button className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50" onClick={() => {
                                    handleUpdateStatus(job.id, "Interview Scheduled", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Interview Scheduled
                                </button>
                                <button className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50" onClick={() => {
                                    handleUpdateStatus(job.id, "Offer", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Offer
                                </button>
                                <button className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50" onClick={() => {
                                    handleUpdateStatus(job.id, "Rejected", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Rejected
                                </button>
                                <div className="dropdown-divider" />
                                <button
                                  className="text-muted-delete"
                                  onClick={() => {
                                    handleUpdateStatus(job.id, "Not Applied", job.platform || job.source, job.notes || "");
                                    setActiveInlineDropdownId(null);
                                  }}
                                >
                                  Stop Tracking
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="date-col">
                          {job.appliedAt
                            ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
                                new Date(job.appliedAt)
                              )
                            : "-"}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center justify-between gap-2 max-w-[200px]">
                            {job.notes ? (
                              <span className="truncate text-sm text-muted-foreground" title={job.notes}>
                                {job.notes}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground/50 italic">No notes added</span>
                            )}
                            <button className="shrink-0"
                              onClick={() => handleOpenTrackModal(job)}
                              title="Edit notes/platform"
                            >
                              <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
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
        <section className="flex flex-col gap-8" style={{ minHeight: "70vh", position: "relative", overflow: "hidden", padding: "1rem 0" }}>
          {/* Floating animated blobs */}
          <div style={{ position: "absolute", top: "10%", left: "-10%", width: "250px", height: "250px", background: "radial-gradient(circle, rgba(182, 95, 42, 0.08) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", animation: "float1 15s ease-in-out infinite alternate", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "10%", right: "-10%", width: "250px", height: "250px", background: "radial-gradient(circle, rgba(217, 119, 6, 0.06) 0%, rgba(0,0,0,0) 70%)", borderRadius: "50%", animation: "float2 18s ease-in-out infinite alternate", pointerEvents: "none" }} />

          {/* Header Dashboard Deck */}
          <div className="bg-card text-card-foreground border rounded-xl shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10" style={{ background: "rgba(255, 253, 248, 0.6)", backdropFilter: "blur(12px)" }}>
            <div>
              <span 
                style={{ 
                  fontSize: "0.68rem", 
                  fontWeight: 700, 
                  background: "rgba(182, 95, 42, 0.1)", 
                  color: "#b65f2a", 
                  padding: "0.25rem 0.65rem", 
                  borderRadius: "999px",
                  border: "1px solid rgba(182, 95, 42, 0.2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "inline-block",
                  marginBottom: "0.5rem"
                }}
              >
                Version 2.0 Roadmap Preview 🚀
              </span>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)", margin: "0", letterSpacing: "-0.025em" }}>
                AI Auto-Apply Live Queue
              </h2>
              <p className="text-sm text-muted-foreground" style={{ margin: "6px 0 0" }}>
                Autonomous Playwright form-filling and real-time Gemini resume optimization.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                🔒 Stealth Mode Ready
              </span>
            </div>
          </div>

          {/* Feature Deck & Mockup Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
            
            {/* Left 2 Cols: Pipeline Explanation & Feature list */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              <div 
                style={{ 
                  background: "rgba(255, 255, 255, 0.5)", 
                  border: "1px solid var(--border)", 
                  borderRadius: "20px", 
                  padding: "2rem",
                  boxShadow: "var(--shadow)"
                }}
              >
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text)", marginBottom: "1rem" }}>
                  How the Auto-Apply Pipeline Works
                </h3>
                <p style={{ fontSize: "0.88rem", color: "#64748b", lineHeight: "1.6", marginBottom: "1.5rem" }}>
                  When Version 2.0 launches, you will be able to select any scraped job from your Explore board and trigger a background agent. The system handles the heavy lifting autonomously:
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <span style={{ display: "flex", alignItems: "center", width: "28px", height: "28px", borderRadius: "8px", background: "rgba(182, 95, 42, 0.08)", color: "var(--primary)", fontWeight: 700, fontSize: "0.9rem", paddingLeft: "10px", paddingTop: "2px" }}>1</span>
                    <strong style={{ fontSize: "0.9rem", color: "var(--text)" }}>AI Resume Tailoring</strong>
                    <span style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: "1.4" }}>
                      Gemini reviews the target job requirements and restructures your master PDF/LaTeX resume dynamically to highlight matching technical skills.
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <span style={{ display: "flex", alignItems: "center", width: "28px", height: "28px", borderRadius: "8px", background: "rgba(182, 95, 42, 0.08)", color: "var(--primary)", fontWeight: 700, fontSize: "0.9rem", paddingLeft: "10px", paddingTop: "2px" }}>2</span>
                    <strong style={{ fontSize: "0.9rem", color: "var(--text)" }}>LaTeX PDF Compilation</strong>
                    <span style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: "1.4" }}>
                      The customized LaTeX codebase is compiled directly on the server into a high-fidelity PDF, ensuring zero formatting bugs.
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <span style={{ display: "flex", alignItems: "center", width: "28px", height: "28px", borderRadius: "8px", background: "rgba(182, 95, 42, 0.08)", color: "var(--primary)", fontWeight: 700, fontSize: "0.9rem", paddingLeft: "10px", paddingTop: "2px" }}>3</span>
                    <strong style={{ fontSize: "0.9rem", color: "var(--text)" }}>Playwright Automation</strong>
                    <span style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: "1.4" }}>
                      Stealth background browser instances launch on your backend to navigate forms, input tailored fields, and upload PDFs directly.
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <span style={{ display: "flex", alignItems: "center", width: "28px", height: "28px", borderRadius: "8px", background: "rgba(182, 95, 42, 0.08)", color: "var(--primary)", fontWeight: 700, fontSize: "0.9rem", paddingLeft: "10px", paddingTop: "2px" }}>4</span>
                    <strong style={{ fontSize: "0.9rem", color: "var(--text)" }}>Kanban Status Sync</strong>
                    <span style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: "1.4" }}>
                      Successful applications are automatically moved to &quot;Applied&quot; inside your Tracker board, storing generated PDF versions for review.
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Col: Live Progress Simulator / Roadmap widget */}
            <div className="flex flex-col gap-6">
              
              <div 
                style={{ 
                  background: "linear-gradient(135deg, #1e1b4b 0%, #311042 100%)", 
                  borderRadius: "20px", 
                  padding: "1.75rem", 
                  color: "white",
                  boxShadow: "0 12px 30px rgba(49, 16, 66, 0.2)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0", color: "#e0e7ff" }}>Pipeline Simulator</h3>
                    <p style={{ fontSize: "0.78rem", color: "#c7d2fe", margin: "2px 0 0" }}>Interactive mockup of Version 2.0</p>
                  </div>
                  <Sparkles className="w-5 h-5 text-indigo-300 animate-pulse" />
                </div>

                {/* Progress steps mock */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(255,255,255,0.08)", padding: "0.75rem", borderRadius: "10px" }}>
                    <div className="spinner" style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid rgba(255, 255, 255, 0.25)",
                      borderTopColor: "white",
                      borderRadius: "50%",
                      animation: "spin 1.2s linear infinite"
                    }} />
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Playwright active: Navigating forms...</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.8rem", color: "#cbd5e1", paddingLeft: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
                      <span>Optimize Resume using OpenAI</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
                      <span>Compile tailored LaTeX & PDF resume</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", opacity: 0.9 }}>
                      <span style={{ color: "#a855f7" }}>●</span>
                      <span>Launch Playwright headed apply flow</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1rem", textAlign: "center" }}>
                  <p style={{ fontSize: "0.72rem", color: "#cbd5e1", margin: 0 }}>
                    Auto-apply backend worker triggers and PDF versioning will connect here dynamically in Version 2.0.
                  </p>
                </div>
              </div>

            </div>

          </div>

          <style>{`
            @keyframes float1 {
              0% { transform: translate(0, 0) scale(1); }
              100% { transform: translate(25px, 20px) scale(1.08); }
            }
            @keyframes float2 {
              0% { transform: translate(0, 0) scale(1); }
              100% { transform: translate(-20px, -25px) scale(0.92); }
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </section>
      )}

      {/* ==================== SCRAPED JOB TRACK MODAL ==================== */}
      {selectedJobForTrack && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 flex items-center justify-center" onClick={() => setSelectedJobForTrack(null)}>
          <div className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
            <header className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
              <div>
                <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Track application status</p>
                <h3 className="text-lg font-semibold leading-none tracking-tight">{selectedJobForTrack.company}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedJobForTrack.title}</p>
              </div>
              <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground" onClick={() => setSelectedJobForTrack(null)}>
                &times;
              </button>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateStatus(selectedJobForTrack.id, trackStatus, trackPlatform, trackNotes);
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col space-y-2">
                <label htmlFor="modal-status">Application Status</label>
                <select
                  id="modal-status"
                  value={trackStatus}
                  onChange={(e) => setTrackStatus(e.target.value)}
                >
                  <option value="Applied">Applied</option>
                  <option value="Followed Up">Followed Up</option>
                  <option value="Interview Scheduled">Interview Scheduled</option>
                  <option value="Offer">Offer</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Not Applied">Not Applied (Stop Tracking)</option>
                </select>
              </div>

              <div className="flex flex-col space-y-2">
                <label htmlFor="modal-platform">Platform / Source</label>
                <select
                  id="modal-platform"
                  value={trackPlatform}
                  onChange={(e) => setTrackPlatform(e.target.value)}
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

              <div className="flex flex-col space-y-2">
                <label htmlFor="modal-notes">Notes / Outreach log</label>
                <textarea
                  id="modal-notes"
                  placeholder="e.g. Referred by John Doe, contacted hiring manager on LinkedIn..."
                  rows={4}
                  value={trackNotes}
                  onChange={(e) => setTrackNotes(e.target.value)}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                  onClick={() => setSelectedJobForTrack(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ADD MANUAL APPLICATION MODAL ==================== */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 flex items-center justify-center" onClick={() => setShowManualModal(false)}>
          <div className="fixed z-50 grid w-full max-w-lg scale-100 gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg" onClick={(e) => e.stopPropagation()}>
            <header className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
              <div>
                <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">New Entry</p>
                <h3 className="text-lg font-semibold leading-none tracking-tight">Track Application</h3>
              </div>
              <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground" onClick={() => setShowManualModal(false)}>
                &times;
              </button>
            </header>

            <form onSubmit={handleAddManualApplication} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-2">
                  <label htmlFor="manual-company">Company *</label>
                  <input
                    type="text"
                    id="manual-company"
                    required
                    placeholder="e.g. Google, Morphie Labs"
                    value={manualCompany}
                    onChange={(e) => setManualCompany(e.target.value)}
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <label htmlFor="manual-title">Role Title *</label>
                  <input
                    type="text"
                    id="manual-title"
                    required
                    placeholder="e.g. SDE Intern, Python Developer"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-2">
                  <label htmlFor="manual-loc">Location</label>
                  <input
                    type="text"
                    id="manual-loc"
                    placeholder="e.g. Remote, New York"
                    value={manualLocation}
                    onChange={(e) => setManualLocation(e.target.value)}
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <label htmlFor="manual-sal">Salary Info</label>
                  <input
                    type="text"
                    id="manual-sal"
                    placeholder="e.g. $60/hr, 12 LPA"
                    value={manualSalary}
                    onChange={(e) => setManualSalary(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-2">
                  <label htmlFor="manual-plat">Platform / Source</label>
                  <select
                    id="manual-plat"
                    value={manualPlatform}
                    onChange={(e) => setManualPlatform(e.target.value)}
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

                <div className="flex flex-col space-y-2">
                  <label htmlFor="manual-status">Current Status</label>
                  <select
                    id="manual-status"
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value)}
                  >
                    <option value="Applied">Applied</option>
                    <option value="Followed Up">Followed Up</option>
                    <option value="Interview Scheduled">Interview Scheduled</option>
                    <option value="Offer">Offer</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <label htmlFor="manual-url">Job Posting URL (Optional)</label>
                <input
                  type="url"
                  id="manual-url"
                  placeholder="https://company.com/careers/job-id"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                />
              </div>

              <div className="flex flex-col space-y-2">
                <label htmlFor="manual-notes">Outreach & Application Notes</label>
                <textarea
                  id="manual-notes"
                  placeholder="e.g. Interview scheduled with HR on Tuesday, referred by alumni..."
                  rows={3}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                  onClick={() => setShowManualModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2" disabled={isSubmitting}>
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
          className="drawer-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(6px)",
            zIndex: 999,
            display: "flex",
            justifyContent: "flex-end",
            animation: "fadeIn 200ms ease-out",
          }}
          onClick={() => {
            setSelectedJobDetails(null);
            if (pollingIntervalId) {
              clearInterval(pollingIntervalId);
              setPollingIntervalId(null);
            }
          }}
        >
          <div 
            className="drawer-container"
            style={{
              width: "100%",
              maxWidth: "580px",
              height: "100%",
              backgroundColor: "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(20px)",
              boxShadow: "-10px 0 40px rgba(0, 0, 0, 0.12)",
              display: "flex",
              flexDirection: "column",
              padding: "0",
              zIndex: 1000,
              cursor: "default",
              borderLeft: "1px solid rgba(0, 0, 0, 0.08)",
              animation: "slideIn 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <header 
              style={{
                padding: "1.75rem 2rem 1.5rem",
                borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
                background: "linear-gradient(135deg, #faf9f6 0%, #f4f2ee 100%)",
                position: "relative",
              }}
            >
              <button onClick={() => {
                  setSelectedJobDetails(null);
                  if (pollingIntervalId) {
                    clearInterval(pollingIntervalId);
                    setPollingIntervalId(null);
                  }
                }}
                style={{
                  position: "absolute",
                  top: "1.5rem",
                  right: "1.5rem",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(0, 0, 0, 0.04)",
                  border: "none",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 150ms ease",
                }}
                className="close-drawer-btn"
              >
                &times;
              </button>
              
              <div style={{ paddingRight: "2.5rem" }}>
                <span 
                  className={`source-label ${selectedJobDetails.source}`}
                  style={{
                    display: "inline-block",
                    padding: "0.25rem 0.65rem",
                    borderRadius: "999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    backgroundColor: "rgba(67, 56, 202, 0.08)",
                    color: "#4338ca",
                    marginBottom: "0.75rem",
                  }}
                >
                  {selectedJobDetails.source}
                </span>
                <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111827", margin: "0 0 0.35rem" }}>
                  {selectedJobDetails.title}
                </h2>
                <p style={{ fontSize: "1.1rem", color: "#4b5563", fontWeight: 500, margin: "0" }}>
                  {selectedJobDetails.company}
                </p>
              </div>
            </header>

            {/* Scrollable Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "2rem" }} className="drawer-body">
              {/* Metadata Badges */}
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
                <div style={{ background: "#f3f4f6", padding: "0.6rem 1rem", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "2px", flex: "1 1 120px" }}>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#6b7280", fontWeight: 600 }}>Location</span>
                  <span style={{ fontSize: "0.92rem", fontWeight: 500, color: "#1f2937" }}>{selectedJobDetails.location}</span>
                </div>
                <div style={{ background: "#f3f4f6", padding: "0.6rem 1rem", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "2px", flex: "1 1 120px" }}>
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", color: "#6b7280", fontWeight: 600 }}>Salary</span>
                  <span style={{ fontSize: "0.92rem", fontWeight: 500, color: "#1f2937" }}>{selectedJobDetails.salary ?? "Not Listed"}</span>
                </div>
              </div>

              {/* AUTO APPLY ACTIONS WIDGET - PREVIEW CARD (TEMPORARILY DISABLED FOR v1) */}
              <div 
                style={{
                  background: "linear-gradient(135deg, rgba(30, 27, 75, 0.45) 0%, rgba(49, 16, 66, 0.45) 100%)",
                  borderRadius: "16px",
                  padding: "1.5rem 1.75rem",
                  color: "white",
                  marginBottom: "2rem",
                  border: "1px dashed rgba(182, 95, 42, 0.3)",
                  boxShadow: "0 8px 30px rgba(49, 16, 66, 0.08)",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.85rem" }}>
                  <div>
                    <span 
                      style={{ 
                        fontSize: "0.68rem", 
                        fontWeight: 700, 
                        background: "rgba(182, 95, 42, 0.15)", 
                        color: "#b65f2a", 
                        padding: "0.2rem 0.55rem", 
                        borderRadius: "999px",
                        border: "1px solid rgba(182, 95, 42, 0.25)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        display: "inline-block",
                        marginBottom: "0.5rem"
                      }}
                    >
                      Coming in Version 2.0 ⚡
                    </span>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0", color: "#f3f4f6", letterSpacing: "-0.01em" }}>
                      AI Auto Apply Pipeline
                    </h3>
                  </div>
                  <Wand2 className="w-6 h-6 text-orange-300" style={{ opacity: 0.6 }} />
                </div>
                
                <p style={{ fontSize: "0.8rem", color: "#a1a1aa", lineHeight: "1.4", margin: 0 }}>
                  Our upcoming Version 2.0 will feature fully automated, background Playwright form filling and real-time resume tailoring via Gemini!
                </p>
                
                <div style={{ marginTop: "1rem", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "0.85rem", fontSize: "0.78rem", color: "#a1a1aa", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <span>✓ 1-Click Tailored PDF Generation</span>
                  <span>✓ Background Form Automated Delivery</span>
                  <span>✓ Live Playwright Browser Status Monitoring</span>
                </div>
              </div>

              {/* Full JD Panel */}
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#111827", marginBottom: "0.75rem" }}>Full Job Description</h3>
                {selectedJobDetails.description ? (
                  <div 
                    style={{ 
                      fontSize: "0.92rem", 
                      color: "#374151", 
                      lineHeight: "1.6", 
                      whiteSpace: "pre-wrap",
                      backgroundColor: "#f9fafb",
                      padding: "1.25rem",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb"
                    }}
                  >
                    {selectedJobDetails.description}
                  </div>
                ) : (
                  <div 
                    style={{ 
                      fontSize: "0.9rem", 
                      color: "#6b7280", 
                      lineHeight: "1.5", 
                      backgroundColor: "#f9fafb",
                      padding: "1.25rem",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      textAlign: "center"
                    }}
                  >
                    <p style={{ fontWeight: 500, color: "#475569", marginBottom: "0.5rem" }}>Job description details are not cached.</p>
                    <p style={{ fontSize: "0.8rem" }}>
                      Click <strong>Auto Apply Now</strong> to pre-fetch the full JD live using Playwright before compiling your AI tailored resume!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseGlow {
          from { opacity: 0.65; box-shadow: 0 0 2px rgba(67, 56, 202, 0.1); }
          to { opacity: 1; box-shadow: 0 0 8px rgba(67, 56, 202, 0.4); }
        }
      `}</style>
    </div>
  );
}
