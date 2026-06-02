"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Rocket, Lock, BarChart, Users, FileText, Briefcase, Sparkles, Send, RefreshCw, Trash2, X } from "lucide-react";


interface MessageDraft {
  id: string;
  profileId: string;
  channel: string;
  subject: string;
  content: string;
  status: string; // DRAFT, APPROVED, REJECTED, EDITED, SENT, FAILED
  sentAt: string | null;
  profile: Profile;
}

interface Profile {
  id: string;
  name: string;
  role: string;
  company: string;
  linkedinUrl: string | null;
  email: string | null;
  notes: string | null;
  source: string;
  tags: string[];
  createdAt: string;
  outboundMessages?: MessageDraft[];
}

interface Resume {
  id: string;
  title: string;
  parsedText: string;
  skills: string[];
  createdAt: string;
}

interface ManualJob {
  id: string;
  title: string;
  company: string;
  description: string | null;
  applyUrl: string | null;
  platform: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  type: string; // REFERRAL, NETWORKING, FEEDBACK, FOUNDER
  prompt: string;
  active: boolean;
}

interface GenQueueJob {
  id: string;
  profileId: string;
  status: string; // PENDING, GENERATING, COMPLETED, FAILED
  generatedSubject: string | null;
  generatedMessage: string | null;
  error: string | null;
  createdAt: string;
  profile: Profile;
  template: PromptTemplate;
}

interface AnalyticsStats {
  totalProfiles: number;
  totalGenerated: number;
  approvedCount: number;
  sentCount: number;
  failedCount: number;
  repliesCount: number;
  positiveReplies: number;
  replyRate: number;
  positiveReplyRate: number;
  referralsReceived: number;
  interviewsScheduled: number;
}

export function OutreachBoard() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"analytics" | "profiles" | "resumes" | "jobs" | "templates" | "generation" | "outbox">("analytics");

  // Core Entity States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [manualJobs, setManualJobs] = useState<ManualJob[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [genQueueJobs, setGenQueueJobs] = useState<GenQueueJob[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<MessageDraft[]>([]);
  const [outboxMessages, setOutboxMessages] = useState<MessageDraft[]>([]);
  
  // Analytics
  const [stats, setStats] = useState<AnalyticsStats>({
    totalProfiles: 0,
    totalGenerated: 0,
    approvedCount: 0,
    sentCount: 0,
    failedCount: 0,
    repliesCount: 0,
    positiveReplies: 0,
    replyRate: 0,
    positiveReplyRate: 0,
    referralsReceived: 0,
    interviewsScheduled: 0,
  });

  // UI / Form States
  const [loading, setLoading] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [activeResumeId, setActiveResumeId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  // Drawer & Modal States
  const [showAddProfileModal, setShowAddProfileModal] = useState(false);
  const [showAddResumeModal, setShowAddResumeModal] = useState(false);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Form inputs
  const [profileName, setProfileName] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profileLinkedin, setProfileLinkedin] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileNotes, setProfileNotes] = useState("");
  const [profileTagsInput, setProfileTagsInput] = useState("");
  const [profileBulkInput, setProfileBulkInput] = useState("");
  const [importFormat, setImportFormat] = useState<"csv" | "json">("csv");

  const [resumeTitle, setResumeTitle] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [jobTitleInput, setJobTitleInput] = useState("");
  const [jobCompanyInput, setJobCompanyInput] = useState("");
  const [jobDescriptionInput, setJobDescriptionInput] = useState("");
  const [jobLinkInput, setJobLinkInput] = useState("");

  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState("REFERRAL");
  const [templatePrompt, setTemplatePrompt] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Editing approval queue draft inline
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState("");
  const [editingContent, setEditingContent] = useState("");

  // Search & filter
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [profileFilterCompany, setProfileFilterCompany] = useState("");

  // Passcode Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(true);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPasscodeText, setShowPasscodeText] = useState(false);
  const [showPasscodeSection, setShowPasscodeSection] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  // Load API key from env or localStorage
  const getApiKey = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("outreach_api_key") || process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "bypass_key";
    }
    return process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "bypass_key";
  };

  // Wrapper for authorized backend fetches
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const key = getApiKey();
    const headers = {
      "X-API-Key": key,
      "bypass-tunnel-reminder": "true",
      ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      setIsAuthenticated(false);
      setAuthError("Unauthorized action: Please enter the correct passcode to verify your session.");
    }
    return res;
  };

  // Dynamic Auth Submit Check
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeInput.trim()) {
      setAuthError("Passcode cannot be empty.");
      return;
    }
    setLoading(true);
    setAuthError("");
    try {
      const testKey = passcodeInput.trim();
      const res = await fetch(`${API_BASE}/outreach/auth/verify`, {
        headers: { 
          "X-API-Key": testKey,
          "bypass-tunnel-reminder": "true",
        },
      });
      if (res.status === 401) {
        setAuthError("Invalid passcode. Access Denied.");
        setLoading(false);
        return;
      }
      localStorage.setItem("outreach_api_key", testKey);
      setIsAuthenticated(true);
      setPasscodeInput("");
      loadAllData();
    } catch (err) {
      console.error("Auth submit failed. API_BASE:", API_BASE, "Error:", err);
      setAuthError(`Network error. Failed to connect to ${API_BASE}. Verify that your backend server is running.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("outreach_api_key");
    setIsAuthenticated(false);
  };

  // Pull All Data from API
  const loadAllData = async () => {
    if (getApiKey() === "") {
      setIsAuthenticated(false);
      return;
    }

    try {
      setLoading(true);
      // 1. Fetch Analytics
      const statsRes = await fetchWithAuth(`${API_BASE}/outreach-flow/analytics`);
      if (statsRes.status === 401) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      const statsJson = await statsRes.json();
      if (statsJson.success) setStats(statsJson.data);

      // 2. Fetch Profiles
      const profRes = await fetchWithAuth(`${API_BASE}/outreach-flow/profiles`);
      const profJson = await profRes.json();
      if (profJson.success) setProfiles(profJson.data);

      // 3. Fetch Resumes
      const resRes = await fetchWithAuth(`${API_BASE}/outreach-flow/resumes`);
      const resJson = await resRes.json();
      if (resJson.success) {
        setResumes(resJson.data);
        if (resJson.data.length > 0 && !activeResumeId) {
          setActiveResumeId(resJson.data[0].id);
        }
      }

      // 4. Fetch Manual Jobs
      const jobRes = await fetchWithAuth(`${API_BASE}/outreach-flow/jobs`);
      const jobJson = await jobRes.json();
      if (jobJson.success) setManualJobs(jobJson.data);

      // 5. Fetch Templates
      const tempRes = await fetchWithAuth(`${API_BASE}/outreach-flow/templates`);
      const tempJson = await tempRes.json();
      if (tempJson.success) {
        setTemplates(tempJson.data);
        if (tempJson.data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(tempJson.data[0].id);
        }
      }

      // 6. Fetch Generation Queue
      const queueRes = await fetchWithAuth(`${API_BASE}/outreach-flow/queue/status`);
      const queueJson = await queueRes.json();
      if (queueJson.success) setGenQueueJobs(queueJson.data);

      // 7. Fetch Approval Queue (DRAFT outbound messages)
      const appRes = await fetchWithAuth(`${API_BASE}/outreach-flow/approval`);
      const appJson = await appRes.json();
      if (appJson.success) setApprovalQueue(appJson.data);

      // 8. Fetch Outbox History
      const messagesRes = await fetchWithAuth(`${API_flow_or_messages()}`);
      const messagesJson = await messagesRes.json();
      if (messagesJson.success) setOutboxMessages(messagesJson.data);

      setIsAuthenticated(true);
    } catch (err) {
      console.error("OutreachFlow data fetching crash:", err);
      // Keep user authenticated in UI even if background fetches fail/warn
    } finally {
      setLoading(false);
    }
  };

  const API_flow_or_messages = () => `${API_BASE}/outreach-flow/messages`;

  useEffect(() => {
    loadAllData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll queues and outbox every 4 seconds to observe real-time BullMQ & SMTP updates
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(async () => {
        try {
          const queueRes = await fetchWithAuth(`${API_BASE}/outreach-flow/queue/status`);
          const queueJson = await queueRes.json();
          if (queueJson.success) setGenQueueJobs(queueJson.data);

          const appRes = await fetchWithAuth(`${API_BASE}/outreach-flow/approval`);
          const appJson = await appRes.json();
          if (appJson.success) setApprovalQueue(appJson.data);

          const messagesRes = await fetchWithAuth(API_flow_or_messages());
          const messagesJson = await messagesRes.json();
          if (messagesJson.success) setOutboxMessages(messagesJson.data);

          const statsRes = await fetchWithAuth(`${API_BASE}/outreach-flow/analytics`);
          const statsJson = await statsRes.json();
          if (statsJson.success) setStats(statsJson.data);
        } catch (e) {
          console.error("OutreachFlow real-time background poller failed:", e);
        }
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==================== A. ADD ENTITIES HANDLERS ====================

  // Upload Resume
  const handleUploadResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeTitle || !resumeFile) {
      alert("Please fill out resume title and select a PDF file.");
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(resumeFile);
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetchWithAuth(`${API_BASE}/outreach-flow/resumes`, {
          method: "POST",
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "Content-Type": "application/json" },
          body: JSON.stringify({
            title: resumeTitle,
            pdfBase64: base64,
          }),
        });

        const json = await res.json();
        if (json.success) {
          alert("Resume uploaded and parsed successfully!");
          setResumeTitle("");
          setResumeFile(null);
          setShowAddResumeModal(false);
          loadAllData();
        } else {
          alert("Upload failed: " + json.message);
        }
      };
    } catch (error) {
      console.error(error);
      alert("Resume upload error.");
    } finally {
      setLoading(false);
    }
  };

  // Add Target Profile (Single or Paste Importer)
  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileBulkInput.trim()) {
      // Bulk CSV/JSON import
      setLoading(true);
      try {
        let listToUpload = [];
        if (importFormat === "json") {
          listToUpload = JSON.parse(profileBulkInput.trim());
        } else {
          // CSV Parser
          const lines = profileBulkInput.trim().split("\n");
          for (const line of lines) {
            if (!line.trim()) continue;
            const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
            if (cols.length >= 3) {
              listToUpload.push({
                name: cols[0],
                role: cols[1],
                company: cols[2],
                linkedinUrl: cols[3] || null,
                email: cols[4] || null,
                notes: cols[5] || null,
              });
            }
          }
        }

        const res = await fetchWithAuth(`${API_BASE}/outreach-flow/profiles`, {
          method: "POST",
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "Content-Type": "application/json" },
          body: JSON.stringify({ profiles: listToUpload }),
        });

        const json = await res.json();
        if (json.success) {
          alert(`Successfully imported ${json.data.length} profiles!`);
          setProfileBulkInput("");
          setShowAddProfileModal(false);
          loadAllData();
        } else {
          alert("Failed to import: " + json.message);
        }
      } catch {
        alert("Parser error. Verify JSON formatting or CSV headers (Name,Role,Company).");
      } finally {
        setLoading(false);
      }
    } else {
      // Single Add
      if (!profileName || !profileRole || !profileCompany) {
        alert("Name, Role, and Company are required.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetchWithAuth(`${API_BASE}/outreach-flow/profiles`, {
          method: "POST",
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "Content-Type": "application/json" },
          body: JSON.stringify({
            profiles: {
              name: profileName,
              role: profileRole,
              company: profileCompany,
              linkedinUrl: profileLinkedin || null,
              email: profileEmail || null,
              notes: profileNotes || null,
              tags: profileTagsInput ? profileTagsInput.split(",").map((t) => t.trim()) : [],
            },
          }),
        });

        const json = await res.json();
        if (json.success) {
          setProfileName("");
          setProfileRole("");
          setProfileCompany("");
          setProfileLinkedin("");
          setProfileEmail("");
          setProfileNotes("");
          setProfileTagsInput("");
          setShowAddProfileModal(false);
          loadAllData();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Add Manual Job
  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitleInput || !jobCompanyInput) {
      alert("Job Title and Company are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/jobs`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "Content-Type": "application/json" },
        body: JSON.stringify({
          title: jobTitleInput,
          company: jobCompanyInput,
          description: jobDescriptionInput || null,
          link: jobLinkInput || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setJobTitleInput("");
        setJobCompanyInput("");
        setJobDescriptionInput("");
        setJobLinkInput("");
        setShowAddJobModal(false);
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Create/Update Prompt Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName || !templatePrompt) {
      alert("Template name and prompt text are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/templates`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTemplateId || undefined,
          name: templateName,
          type: templateType,
          prompt: templatePrompt,
          active: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setTemplateName("");
        setTemplatePrompt("");
        setEditingTemplateId(null);
        setShowTemplateModal(false);
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ==================== B. BULK GENERATION DISPATCHER (BULLMQ) ====================

  const handleLaunchGeneration = async () => {
    if (selectedProfileIds.size === 0) {
      alert("Please select at least one target profile from the list.");
      return;
    }
    if (!activeResumeId) {
      alert("Please upload and select an active resume first.");
      return;
    }
    if (!selectedTemplateId) {
      alert("Please select a prompt template to use.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/generate`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "Content-Type": "application/json" },
        body: JSON.stringify({
          profileIds: Array.from(selectedProfileIds),
          resumeId: activeResumeId,
          templateId: selectedTemplateId,
          jobId: selectedJobId || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert(`Dispatched BullMQ! Enqueued ${selectedProfileIds.size} bulk generations in the Redis worker pool.`);
        setSelectedProfileIds(new Set());
        setActiveTab("generation");
        loadAllData();
      } else {
        alert("Dispatch failed: " + json.message);
      }
    } catch (err) {
      console.error(err);
      alert("BullMQ dispatch error.");
    } finally {
      setLoading(false);
    }
  };

  // ==================== C. APPROVAL WORKFLOW HANDLERS ====================

  const handleOpenEditDraft = (draft: MessageDraft) => {
    setEditingDraftId(draft.id);
    setEditingSubject(draft.subject);
    setEditingContent(draft.content);
  };

  const handleSaveDraftEdits = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/approval/${id}`, {
        method: "PATCH",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editingSubject,
          content: editingContent,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEditingDraftId(null);
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveMessage = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/approval/${id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectMessage = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/approval/${id}/reject`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        loadAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Dispatch approved emails sequentially
  const handleTriggerSMTPDispatch = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/outreach-flow/outbox/send`, {
        method: "POST",
      });
      const json = await res.json();
      alert(json.message);
      setActiveTab("outbox");
      loadAllData();
    } catch (e) {
      console.error(e);
      alert("SMTP outbox transmission failure.");
    } finally {
      setLoading(false);
    }
  };

  // ==================== D. ENTITY DELETION HANDLERS ====================

  const handleDeleteProfile = async (id: string) => {
    if (!confirm("Delete this target profile?")) return;
    await fetchWithAuth(`${API_BASE}/outreach-flow/profiles/${id}`, { method: "DELETE" });
    loadAllData();
  };

  const handleDeleteResume = async (id: string) => {
    if (!confirm("Delete this resume version?")) return;
    await fetchWithAuth(`${API_BASE}/outreach-flow/resumes/${id}`, { method: "DELETE" });
    loadAllData();
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm("Delete this target job posting?")) return;
    await fetchWithAuth(`${API_BASE}/outreach-flow/jobs/${id}`, { method: "DELETE" });
    loadAllData();
  };

  // ==================== E. FILTER & SELECTIONS ====================

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(profileSearchQuery.toLowerCase()) ||
        p.role.toLowerCase().includes(profileSearchQuery.toLowerCase()) ||
        p.company.toLowerCase().includes(profileSearchQuery.toLowerCase());
      const matchCompany = profileFilterCompany ? p.company === profileFilterCompany : true;
      return matchSearch && matchCompany;
    });
  }, [profiles, profileSearchQuery, profileFilterCompany]);

  const uniqueProfileCompanies = useMemo(() => {
    return Array.from(new Set(profiles.map((p) => p.company)));
  }, [profiles]);

  const toggleSelectProfile = (id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllProfiles = () => {
    if (selectedProfileIds.size === filteredProfiles.length) {
      setSelectedProfileIds(new Set());
    } else {
      setSelectedProfileIds(new Set(filteredProfiles.map((p) => p.id)));
    }
  };

  // ==================== F. RENDERS AND RENDER BRANCHES ====================

  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin" />
        <p className="text-xs text-muted-foreground font-mono">Verifying connection...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[75vh] bg-background p-6">
        <div className="border border-border bg-card rounded-md shadow-xs p-8 max-w-sm w-full flex flex-col gap-6 animate-in fade-in duration-200">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-10 h-10 rounded-sm bg-black flex items-center justify-center text-white shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-foreground">Secure Outreach Portal.</h3>
              <p className="text-xs text-muted-foreground leading-normal">
                Your session is locked. Connect using your secure account to manage campaigns, run automation, and send emails.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <a 
              href="/login"
              className="h-9 inline-flex items-center justify-center gap-2 px-4 rounded-md bg-black text-white text-xs font-semibold hover:bg-black/90 transition-colors text-center cursor-pointer"
            >
              🚀 Sign In / Register via OAuth
            </a>

            <button
              onClick={() => setShowPasscodeSection(!showPasscodeSection)}
              className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer text-center pt-2"
            >
              {showPasscodeSection ? "Hide Passcode Entry" : "Use Admin Passcode Instead"}
            </button>
          </div>

          {showPasscodeSection && (
            <div className="border-t border-border pt-4 mt-2 animate-in fade-in duration-200">
              <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Admin Passcode
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showPasscodeText ? "text" : "password"}
                      placeholder="••••••••••••"
                      value={passcodeInput}
                      onChange={(e) => setPasscodeInput(e.target.value)}
                      disabled={loading}
                      className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md pl-3 pr-10 bg-background placeholder:text-zinc-400 outline-hidden focus:ring-1 focus:ring-black w-full"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscodeText(!showPasscodeText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-xs text-muted-foreground hover:text-foreground p-1"
                    >
                      {showPasscodeText ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="text-[10px] text-red-600 bg-red-50 border border-red-200 rounded-md p-2.5 font-medium leading-normal">
                    ⚠️ {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="h-9 bg-black text-white text-xs font-semibold hover:bg-black/90 rounded-md transition-colors cursor-pointer w-full disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify Passcode"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Header Deck */}
      <div className="border border-border bg-card p-4 rounded-md shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-border bg-zinc-50 flex items-center justify-center text-foreground shrink-0">
            <Rocket className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground flex items-center gap-2">
              OutreachFlow. <span className="text-[9px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-black text-white">MVP</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Contextual, high-signal referral and networking outreach scale system</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button 
            onClick={loadAllData} 
            disabled={loading}
            className="h-9 inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-zinc-50 text-foreground px-3 py-2 gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Sync Data
          </button>
          <button 
            onClick={handleSignOut}
            className="h-9 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-red-50 border border-red-100 text-red-600 hover:bg-red-100/50 px-3 py-2 gap-1.5 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" /> Lock
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-border flex gap-1 overflow-x-auto pb-px">
        {[
          { key: "analytics", label: "Overview", icon: <BarChart className="w-3.5 h-3.5" /> },
          { key: "profiles", label: "Target Profiles", icon: <Users className="w-3.5 h-3.5" /> },
          { key: "resumes", label: "Resumes", icon: <FileText className="w-3.5 h-3.5" /> },
          { key: "jobs", label: "Target Jobs", icon: <Briefcase className="w-3.5 h-3.5" /> },
          { key: "templates", label: "Templates", icon: <FileText className="w-3.5 h-3.5" /> },
          { key: "generation", label: "Gen Queue", icon: <Sparkles className="w-3.5 h-3.5" /> },
          { key: "outbox", label: "Outbox", icon: <Send className="w-3.5 h-3.5" /> }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`h-9 px-4 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                isActive 
                  ? "border-black text-black font-semibold" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.key === "generation" && genQueueJobs.filter(j => j.status === "PENDING" || j.status === "GENERATING").length > 0 && (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
              {tab.key === "outbox" && approvalQueue.length > 0 && (
                <span className="ml-1 bg-black text-white text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-sm">
                  {approvalQueue.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ANALYTICS OVERVIEW */}
      {activeTab === "analytics" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: "Target Profiles", val: stats.totalProfiles },
              { label: "AI Generations", val: stats.totalGenerated },
              { label: "Approved Mail", val: stats.approvedCount },
              { label: "Outbox Sent", val: stats.sentCount },
              { label: "Replies Recvd", val: stats.repliesCount },
              { label: "Referrals Gained", val: stats.referralsReceived },
              { label: "Interviews", val: stats.interviewsScheduled }
            ].map((card, idx) => (
              <div 
                key={idx} 
                className="border border-border bg-card p-4 rounded-md shadow-xs flex flex-col gap-1 relative overflow-hidden"
              >
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{card.label}</span>
                <span className="text-xl font-bold font-mono text-foreground">{card.val}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-border bg-card p-6 rounded-md shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Conversion Performance</h3>
              
              <div className="flex flex-col gap-4 mt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-muted-foreground">Outreach Reply Rate</span>
                    <span className="font-bold font-mono">{stats.replyRate}%</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-black rounded-full" style={{ width: `${stats.replyRate}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-muted-foreground">Positive Response Conversion</span>
                    <span className="font-bold font-mono">{stats.positiveReplyRate}%</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.positiveReplyRate}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-border bg-card p-6 rounded-md shadow-xs flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">OutreachFlow Campaign Pipeline.</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Four simple steps to double your referral response rates:</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-md flex flex-col gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-sm bg-black text-white text-[10px] font-mono font-bold">1</span>
                  <span><strong>Upload Resume</strong>: Upload parsed PDFs to extract skill profiles.</span>
                </div>
                <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-md flex flex-col gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-sm bg-black text-white text-[10px] font-mono font-bold">2</span>
                  <span><strong>Import Profiles</strong>: Paste CSV lists of target employees.</span>
                </div>
                <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-md flex flex-col gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-sm bg-black text-white text-[10px] font-mono font-bold">3</span>
                  <span><strong>Approve drafts</strong>: Review contextual AI messages in the approval queue.</span>
                </div>
                <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-md flex flex-col gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-sm bg-black text-white text-[10px] font-mono font-bold">4</span>
                  <span><strong>SMTP Dispatch</strong>: Sequentially send approved emails.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROFILES MANAGER */}
      {activeTab === "profiles" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Target Employees & Profiles.</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Manage and import targets from company lists</p>
            </div>
            <button 
              onClick={() => setShowAddProfileModal(true)}
              className="h-9 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-black text-white hover:bg-black/90 px-4 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Profiles / Bulk Import
            </button>
          </div>

          {/* Quick Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Search by name, role, company..." 
              value={profileSearchQuery}
              onChange={(e) => setProfileSearchQuery(e.target.value)}
              className="flex-1 h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background placeholder:text-muted-foreground outline-hidden focus:ring-1 focus:ring-black"
            />
            <select
              value={profileFilterCompany}
              onChange={(e) => setProfileFilterCompany(e.target.value)}
              className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background cursor-pointer outline-hidden focus:ring-1 focus:ring-black min-w-[150px]"
            >
              <option value="">All Companies</option>
              {uniqueProfileCompanies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Profiles Data Table */}
          {filteredProfiles.length === 0 ? (
            <div className="border border-dashed border-border p-12 text-center rounded-md bg-zinc-50/50 flex flex-col items-center gap-2">
              <span className="text-xl">👥</span>
              <h3 className="text-xs font-semibold text-foreground mt-1">No target profiles imported yet.</h3>
              <p className="text-xs text-muted-foreground max-w-sm">Import single employee details or drag CSV files to start building outreach pipelines.</p>
            </div>
          ) : (
            <div className="border border-border bg-card rounded-md overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-zinc-50">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input 
                          type="checkbox"
                          checked={selectedProfileIds.size === filteredProfiles.length && filteredProfiles.length > 0}
                          onChange={toggleSelectAllProfiles}
                          className="cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Name</th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Role</th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Company</th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Email / Link</th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Source</th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Tags</th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map((p) => (
                      <tr 
                        key={p.id} 
                        className={`border-b border-zinc-100 transition-colors ${
                          selectedProfileIds.has(p.id) ? "bg-zinc-50/70" : "hover:bg-zinc-50/30"
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input 
                            type="checkbox"
                            checked={selectedProfileIds.has(p.id)}
                            onChange={() => toggleSelectProfile(p.id)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground text-xs">{p.name}</td>
                        <td className="py-3 px-4 text-zinc-600">{p.role}</td>
                        <td className="py-3 px-4 font-semibold text-foreground">{p.company}</td>
                        <td className="py-3 px-4">
                          <div>{p.email || "—"}</div>
                          {p.linkedinUrl && (
                            <a 
                              href={p.linkedinUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[10px] text-zinc-500 hover:text-black hover:underline mt-0.5 inline-block"
                            >
                              LinkedIn Profile ↗
                            </a>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[9px] font-bold font-mono border ${
                            p.source === "MANUAL" 
                              ? "bg-zinc-100 text-zinc-800 border-zinc-200" 
                              : "bg-blue-50 text-blue-700 border-blue-100"
                          }`}>
                            {p.source}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {p.tags.map((t) => (
                              <span key={t} className="text-[9px] font-mono bg-zinc-50 border border-zinc-100 text-zinc-600 px-1 py-0.2 rounded-sm">{t}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button 
                            onClick={() => handleDeleteProfile(p.id)}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action dock when items are selected */}
          {selectedProfileIds.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-4 rounded-md shadow-lg flex flex-col sm:flex-row items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 w-full max-w-2xl">
              <div className="text-xs shrink-0">
                Selected <strong className="font-mono">{selectedProfileIds.size}</strong> profile(s)
              </div>
              
              <div className="flex flex-wrap gap-2 items-center flex-1 justify-end w-full">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="h-8 border border-zinc-700 bg-zinc-900 text-white text-xs rounded-md px-2.5 outline-hidden focus:ring-1 focus:ring-white max-w-[180px]"
                >
                  <option value="">Choose Template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                  ))}
                </select>

                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="h-8 border border-zinc-700 bg-zinc-900 text-white text-xs rounded-md px-2.5 outline-hidden focus:ring-1 focus:ring-white max-w-[180px]"
                >
                  <option value="">Job Context (Optional)...</option>
                  {manualJobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title} @ {j.company}</option>
                  ))}
                </select>

                <button 
                  onClick={handleLaunchGeneration}
                  className="h-8 inline-flex items-center justify-center px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
                >
                  ✨ Generate bulk outreach
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RESUME MANAGER */}
      {activeTab === "resumes" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Resume Manager.</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Manage multiple resumes to drive dynamic AI generation context</p>
            </div>
            <button 
              onClick={() => setShowAddResumeModal(true)}
              className="h-9 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-black text-white hover:bg-black/90 px-4 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Upload Resume PDF
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* List */}
            <div className="border border-border bg-card p-6 rounded-md shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Master Resumes</h3>
              
              {resumes.length === 0 ? (
                <div className="border border-dashed border-border p-8 text-center rounded-md bg-zinc-50/50 text-xs text-muted-foreground">
                  No resumes uploaded. Please upload a PDF to extract ATS parameters.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {resumes.map((r) => {
                    const isActive = activeResumeId === r.id;
                    return (
                      <div 
                        key={r.id}
                        className={`border rounded-md p-4 flex justify-between items-center transition-all ${
                          isActive 
                            ? "border-black bg-zinc-50" 
                            : "border-border bg-card hover:bg-zinc-50/50"
                        }`}
                      >
                        <div className="flex gap-3 items-center">
                          <input 
                            type="radio" 
                            name="active-resume"
                            checked={isActive}
                            onChange={() => setActiveResumeId(r.id)}
                            className="w-4 h-4 accent-black cursor-pointer"
                          />
                          <div>
                            <strong className="block text-xs text-foreground">{r.title}</strong>
                            <span className="text-[10px] text-muted-foreground font-mono">Parsed technical skills: {r.skills.length}</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleDeleteResume(r.id)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Details Preview */}
            <div className="border border-border bg-card p-6 rounded-md shadow-xs flex flex-col gap-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Selected Resume Context</h3>
              
              {resumes.find(r => r.id === activeResumeId) ? (
                (() => {
                  const selected = resumes.find(r => r.id === activeResumeId)!;
                  return (
                    <div className="flex flex-col gap-4 text-xs">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Resume Title</span>
                        <span className="font-semibold text-foreground">{selected.title}</span>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-2">Extracted Key Skills Profile</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selected.skills.map((s) => (
                            <span key={s} className="text-[10px] font-mono font-semibold bg-zinc-100 border border-zinc-200 text-zinc-700 px-2 py-0.5 rounded-sm">{s}</span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">Extracted ATS Text Preview</span>
                        <div className="max-h-[250px] overflow-y-auto p-3 bg-zinc-50 border border-border rounded-md text-[11px] font-mono text-zinc-600 whitespace-pre-wrap leading-normal">
                          {selected.parsedText}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-muted-foreground text-xs italic">Select a resume from the list to preview parsed parameters.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MANUAL JOBS BOARD */}
      {activeTab === "jobs" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Target Job Postings.</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Track specific roles to bind as context for AI generations</p>
            </div>
            <button 
              onClick={() => setShowAddJobModal(true)}
              className="h-9 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-black text-white hover:bg-black/90 px-4 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Job Manually
            </button>
          </div>

          {manualJobs.length === 0 ? (
            <div className="border border-dashed border-border p-12 text-center rounded-md bg-zinc-50/50 flex flex-col items-center gap-2">
              <span className="text-xl">💼</span>
              <h3 className="text-xs font-semibold text-foreground mt-1">No tracked jobs listed yet.</h3>
              <p className="text-xs text-muted-foreground max-w-sm">Create manual target postings to dynamically drive context for founder outreach and referral messages.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {manualJobs.map((j) => (
                <div 
                  key={j.id}
                  className="border border-border bg-card p-5 rounded-md shadow-xs flex flex-col justify-between gap-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{j.title}</h3>
                    <strong className="block text-xs text-muted-foreground mt-0.5">{j.company}</strong>
                    
                    {j.applyUrl && (
                      <a 
                        href={j.applyUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-black hover:underline mt-1.5"
                      >
                        View Original Posting Link ↗
                      </a>
                    )}

                    <div className="text-[11px] text-zinc-600 mt-3 max-h-[100px] overflow-y-auto p-2 bg-zinc-50 border border-zinc-100 rounded-md whitespace-pre-wrap leading-normal">
                      {j.description || "No JD specified."}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-border/50">
                    <button 
                      onClick={() => handleDeleteJob(j.id)}
                      className="text-[11px] font-semibold text-red-600 hover:text-red-800 cursor-pointer transition-colors"
                    >
                      Delete Role
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AI Prompt Templates */}
      {activeTab === "templates" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">AI Prompt Templates.</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Tune and tweak customized prompting guidelines for outreach styles</p>
            </div>
            <button 
              onClick={() => {
                setTemplateName("");
                setTemplatePrompt("");
                setEditingTemplateId(null);
                setShowTemplateModal(true);
              }}
              className="h-9 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-black text-white hover:bg-black/90 px-4 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Prompt Template
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => (
              <div 
                key={t.id}
                className="border border-border bg-card p-5 rounded-md shadow-xs flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex justify-between items-center gap-2">
                    <h3 className="text-xs font-semibold text-foreground">{t.name}</h3>
                    <span className="text-[9px] font-mono font-bold bg-zinc-100 border border-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded-sm">{t.type}</span>
                  </div>
                  
                  <div className="text-[11px] text-zinc-600 mt-3 h-[120px] overflow-y-auto p-2 bg-zinc-50 border border-zinc-100 rounded-md whitespace-pre-wrap font-mono leading-normal">
                    {t.prompt}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/50">
                  <button 
                    onClick={() => {
                      setTemplateName(t.name);
                      setTemplatePrompt(t.prompt);
                      setTemplateType(t.type);
                      setEditingTemplateId(t.id);
                      setShowTemplateModal(true);
                    }}
                    className="text-[11px] font-semibold text-black hover:underline cursor-pointer"
                  >
                    Edit Guidelines
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: GENERATION QUEUE */}
      {activeTab === "generation" && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Redis Queue Status (BullMQ).</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Monitor background AI bulk generation tasks</p>
          </div>

          {genQueueJobs.length === 0 ? (
            <div className="border border-dashed border-border p-12 text-center rounded-md bg-zinc-50/50 flex flex-col items-center gap-2">
              <span className="text-xl">⚡</span>
              <h3 className="text-xs font-semibold text-foreground mt-1">No background jobs enqueued.</h3>
              <p className="text-xs text-muted-foreground max-w-sm">Go to the &quot;Target Profiles&quot; tab, select profiles, and dispatch generations.</p>
            </div>
          ) : (
            <div className="border border-border bg-card rounded-md overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-zinc-50">
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Target Details</th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Template used</th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Triggered At</th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">BullMQ Status</th>
                      <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Result Logs / Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {genQueueJobs.map((j) => (
                      <tr key={j.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <strong className="block text-xs">{j.profile.name}</strong>
                          <span className="text-[10px] text-muted-foreground mt-0.5 block">{j.profile.role} @ {j.profile.company}</span>
                        </td>
                        <td className="py-3 px-4">{j.template.name}</td>
                        <td className="py-3 px-4 text-muted-foreground font-mono">
                          {new Date(j.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono border ${
                            j.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" :
                            j.status === "FAILED" ? "bg-red-500/10 text-red-700 border-red-500/20" :
                            j.status === "GENERATING" ? "bg-purple-500/10 text-purple-700 border-purple-500/20 animate-pulse" :
                            "bg-amber-500/10 text-amber-700 border-amber-500/20"
                          }`}>
                            {j.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-[250px] break-all leading-normal">
                          {j.status === "COMPLETED" ? (
                            <span className="text-emerald-700 font-semibold">Message compiled in draft queue ✓</span>
                          ) : j.status === "FAILED" ? (
                            <span className="text-red-600 font-medium">⚠️ {j.error || "Generation crashed."}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Running background prompt...</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: APPROVAL QUEUE & OUTBOX */}
      {activeTab === "outbox" && (
        <div className="flex flex-col gap-8">
          {/* Section 1: Approval Workflow Queue */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Human Review / Approval Queue.</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Edit and approve generated messages before transmission</p>
              </div>

              {approvalQueue.length > 0 && (
                <button
                  onClick={handleTriggerSMTPDispatch}
                  className="h-9 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-black text-white hover:bg-black/90 px-4 transition-colors cursor-pointer shrink-0"
                >
                  ✉️ Dispatch Approved Outbox
                </button>
              )}
            </div>

            {approvalQueue.length === 0 ? (
              <div className="border border-dashed border-border p-12 text-center rounded-md bg-zinc-50/50 flex flex-col items-center gap-2">
                <span className="text-xl">📬</span>
                <h3 className="text-xs font-semibold text-foreground mt-1">Approval Queue is empty.</h3>
                <p className="text-xs text-muted-foreground max-w-sm">All enqueued drafts have been processed or approved. Launch new bulk generations to fill reviews.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {approvalQueue.map((draft) => {
                  const isEditing = editingDraftId === draft.id;
                  return (
                    <div 
                      key={draft.id}
                      className="border border-border bg-card rounded-md shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-[240px_1fr]"
                    >
                      {/* Left: profile metadata */}
                      <div className="bg-zinc-50 p-5 border-b md:border-b-0 md:border-r border-border flex flex-col gap-4 text-xs">
                        <div>
                          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Recipient</span>
                          <strong className="block text-sm text-foreground mt-0.5">{draft.profile.name}</strong>
                          <span className="text-muted-foreground mt-0.5 block">{draft.profile.role}</span>
                          <span className="font-semibold text-foreground">{draft.profile.company}</span>
                        </div>

                        <div>
                          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Email Address</span>
                          <span className="block font-mono text-[11px] mt-0.5 break-all">{draft.profile.email || "No Email Provided"}</span>
                        </div>

                        <div>
                          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Draft Status</span>
                          <span className="block mt-1">
                            <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-700 border border-amber-500/20 font-bold font-mono text-[9px]">
                              {draft.status}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Right: Message editor panel */}
                      <div className="p-5 flex flex-col gap-4">
                        {isEditing ? (
                          <div className="flex flex-col gap-3">
                            <div>
                              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">Email Subject</label>
                              <input 
                                type="text" 
                                value={editingSubject} 
                                onChange={(e) => setEditingSubject(e.target.value)}
                                className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background w-full outline-hidden focus:ring-1 focus:ring-black"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">Email Copy</label>
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                rows={8}
                                className="w-full rounded-md border border-input bg-background p-3 text-xs transition-colors focus:border-black focus:outline-hidden focus:ring-1 focus:ring-black resize-y font-mono"
                              />
                            </div>

                            <div className="flex gap-2 justify-end">
                              <button 
                                onClick={() => setEditingDraftId(null)}
                                className="h-8 px-3 text-xs font-semibold border border-border hover:bg-zinc-50 rounded-md transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={() => handleSaveDraftEdits(draft.id)}
                                className="h-8 px-4 text-xs font-semibold bg-black text-white hover:bg-black/90 rounded-md transition-colors cursor-pointer"
                              >
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col justify-between h-full gap-4">
                            <div>
                              <div className="border-b border-zinc-100 pb-2 mb-2 text-xs">
                                <strong>Subject:</strong> {draft.subject}
                              </div>
                              <div className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed font-mono">
                                {draft.content}
                              </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-3 border-t border-zinc-100 mt-auto">
                              <button 
                                onClick={() => handleOpenEditDraft(draft)}
                                className="h-8 px-3 text-xs font-semibold border border-border hover:bg-zinc-50 text-foreground rounded-md transition-colors cursor-pointer"
                              >
                                Edit Draft
                              </button>
                              <button 
                                onClick={() => handleRejectMessage(draft.id)}
                                className="h-8 px-3 text-xs font-semibold bg-red-50 text-red-600 border border-red-100 hover:bg-red-100/50 rounded-md transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                              <button 
                                onClick={() => handleApproveMessage(draft.id)}
                                className="h-8 px-4 text-xs font-semibold bg-black text-white hover:bg-black/90 rounded-md transition-colors cursor-pointer"
                              >
                                Approve Draft
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Outbox History Logs */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-foreground">Outbox Logs & Sending Queue.</h2>
            
            {outboxMessages.length === 0 ? (
              <div className="border border-dashed border-border p-8 text-center rounded-md bg-zinc-50/50 text-xs text-muted-foreground">
                No sent logs available. Approved emails appear here when transmitted.
              </div>
            ) : (
              <div className="border border-border bg-card rounded-md overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-zinc-50">
                        <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Target Recipient</th>
                        <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Email Subject</th>
                        <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Channel</th>
                        <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Status</th>
                        <th className="py-2.5 px-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Delivered Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outboxMessages.map((msg) => (
                        <tr key={msg.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <strong className="block text-xs">{msg.profile.name}</strong>
                            <span className="text-[10px] text-muted-foreground mt-0.5 block">{msg.profile.email}</span>
                          </td>
                          <td className="py-3 px-4">{msg.subject}</td>
                          <td className="py-3 px-4">
                            <span className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-1.5 py-0.5 rounded-sm font-mono text-[9px] font-bold">{msg.channel}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold font-mono border ${
                              msg.status === "SENT" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" :
                              msg.status === "FAILED" ? "bg-red-500/10 text-red-700 border-red-500/20" :
                              msg.status === "SENDING" ? "bg-amber-500/10 text-amber-700 border-amber-500/20 animate-pulse" :
                              "bg-indigo-500/10 text-indigo-700 border-indigo-500/20"
                            }`}>
                              {msg.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground font-mono">
                            {msg.sentAt ? new Date(msg.sentAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== DRAWERS & MODALS DEFINITIONS ==================== */}

      {/* Add Profile & Importer Modal */}
      {showAddProfileModal && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={() => setShowAddProfileModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-md p-6 w-full max-w-lg shadow-lg flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Import Target Profiles</h3>
              <button 
                onClick={() => setShowAddProfileModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProfile} className="flex flex-col gap-4">
              <div className="flex gap-2 border-b border-border pb-2">
                <button 
                  type="button" 
                  onClick={() => setProfileBulkInput("")}
                  className={`h-8 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    !profileBulkInput 
                      ? "bg-black text-white" 
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Single Form Add
                </button>
                <button 
                  type="button" 
                  onClick={() => setProfileBulkInput("Name,Role,Company,LinkedIn,Email,Notes\nShivam,CTO,Morphie,,shivam@morphie.co,")}
                  className={`h-8 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    profileBulkInput 
                      ? "bg-black text-white" 
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Bulk CSV/JSON Paste
                </button>
              </div>

              {profileBulkInput ? (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => setImportFormat("csv")} 
                      className={`h-7 px-3 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                        importFormat === "csv" 
                          ? "bg-black border-black text-white" 
                          : "border-border bg-background text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      CSV Format
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setImportFormat("json")} 
                      className={`h-7 px-3 text-[11px] font-semibold rounded-md border transition-colors cursor-pointer ${
                        importFormat === "json" 
                          ? "bg-black border-black text-white" 
                          : "border-border bg-background text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      JSON Array Format
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    placeholder={
                      importFormat === "csv" 
                        ? "Name,Role,Company,LinkedIn,Email,Notes\nShivam,SDE,Snapmint,,shivam@snapmint.com,Ref by John\n..." 
                        : '[\n  { "name": "Shivam", "role": "SDE", "company": "Snapmint", "email": "shivam@snapmint.com" }\n]'
                    }
                    value={profileBulkInput}
                    onChange={(e) => setProfileBulkInput(e.target.value)}
                    className="w-full rounded-md border border-input bg-background p-3 text-xs font-mono transition-colors placeholder:text-zinc-400 focus:border-black focus:outline-hidden focus:ring-1 focus:ring-black resize-y"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Full Name *</label>
                    <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} required className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Target Role / Title *</label>
                    <input type="text" value={profileRole} onChange={(e) => setProfileRole(e.target.value)} required className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Company *</label>
                    <input type="text" value={profileCompany} onChange={(e) => setProfileCompany(e.target.value)} required className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Email Address</label>
                    <input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">LinkedIn URL</label>
                    <input type="url" value={profileLinkedin} onChange={(e) => setProfileLinkedin(e.target.value)} className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Skills / Focus Tags (comma separated)</label>
                    <input type="text" placeholder="e.g. Backend, React, Fintech" value={profileTagsInput} onChange={(e) => setProfileTagsInput(e.target.value)} className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Notes & Context</label>
                    <textarea rows={3} placeholder="e.g. Previously worked at Coinbase, active on open source..." value={profileNotes} onChange={(e) => setProfileNotes(e.target.value)} className="w-full rounded-md border border-input bg-background p-3 text-xs transition-colors focus:border-black focus:outline-hidden" />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddProfileModal(false)} 
                  className="flex-1 h-9 px-4 text-xs font-medium border border-border hover:bg-zinc-50 rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 h-9 px-4 text-xs font-semibold bg-black text-white hover:bg-black/90 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Importing..." : "Save Target Profiles"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Resume Modal */}
      {showAddResumeModal && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={() => setShowAddResumeModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-md p-6 w-full max-w-sm shadow-lg flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Upload Resume PDF</h3>
              <button 
                onClick={() => setShowAddResumeModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadResume} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Resume Label / Title *</label>
                <input type="text" placeholder="e.g. Backend SDE Resume" value={resumeTitle} onChange={(e) => setResumeTitle(e.target.value)} required className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">PDF File *</label>
                <input 
                  type="file" 
                  accept="application/pdf" 
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)} 
                  required
                  className="h-9 border border-input focus:border-zinc-400 text-xs transition-colors rounded-md px-3 bg-background py-1.5 cursor-pointer file:hidden border-dashed"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddResumeModal(false)} 
                  className="flex-1 h-9 px-4 text-xs font-medium border border-border hover:bg-zinc-50 rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 h-9 px-4 text-xs font-semibold bg-black text-white hover:bg-black/90 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Parsing PDF..." : "Upload & Parse Context"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Job Modal */}
      {showAddJobModal && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={() => setShowAddJobModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-md p-6 w-full max-w-sm shadow-lg flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Add Manual Target Job</h3>
              <button 
                onClick={() => setShowAddJobModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddJob} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Job Title *</label>
                <input type="text" placeholder="e.g. Backend Engineer Intern" value={jobTitleInput} onChange={(e) => setJobTitleInput(e.target.value)} required className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Company Name *</label>
                <input type="text" placeholder="e.g. Stripe" value={jobCompanyInput} onChange={(e) => setJobCompanyInput(e.target.value)} required className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Original Posting URL</label>
                <input type="url" placeholder="https://stripe.com/careers/jobs/..." value={jobLinkInput} onChange={(e) => setJobLinkInput(e.target.value)} className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Job Description Details</label>
                <textarea rows={4} placeholder="Requirements, key stacks, experience expectations..." value={jobDescriptionInput} onChange={(e) => setJobDescriptionInput(e.target.value)} className="w-full rounded-md border border-input bg-background p-3 text-xs transition-colors focus:border-black focus:outline-hidden resize-y" />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddJobModal(false)} 
                  className="flex-1 h-9 px-4 text-xs font-medium border border-border hover:bg-zinc-50 rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 h-9 px-4 text-xs font-semibold bg-black text-white hover:bg-black/90 rounded-md transition-colors cursor-pointer"
                >
                  Save Job Spec
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit/Create Templates Modal */}
      {showTemplateModal && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={() => setShowTemplateModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-md p-6 w-full max-w-md shadow-lg flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                {editingTemplateId ? "Edit Prompt Guidelines" : "Create Prompt Template"}
              </h3>
              <button 
                onClick={() => setShowTemplateModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Template Label</label>
                <input type="text" placeholder="e.g. SDE Referral Pitch" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Outreach Objective / Type</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background cursor-pointer outline-hidden focus:ring-1 focus:ring-black"
                >
                  <option value="REFERRAL">Referral Request</option>
                  <option value="NETWORKING">Networking Connect</option>
                  <option value="FEEDBACK">Profile Feedback</option>
                  <option value="FOUNDER">CTO/Founder Outreach</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">AI Guidelines & Instructions</label>
                <textarea rows={6} placeholder="Instruct the LLM on writing style, formatting, constraints..." value={templatePrompt} onChange={(e) => setTemplatePrompt(e.target.value)} required className="w-full rounded-md border border-input bg-background p-3 text-xs transition-colors focus:border-black focus:outline-hidden font-mono" />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowTemplateModal(false)} 
                  className="flex-1 h-9 px-4 text-xs font-medium border border-border hover:bg-zinc-50 rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 h-9 px-4 text-xs font-semibold bg-black text-white hover:bg-black/90 rounded-md transition-colors cursor-pointer"
                >
                  Save Prompt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
