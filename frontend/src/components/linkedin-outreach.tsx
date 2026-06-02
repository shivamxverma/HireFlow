"use client";

import React, { useState, useEffect } from "react";
import { Link2, RefreshCw, Check, Plus, Trash2, Inbox, Layers, Lock, Camera, CheckCircle, XCircle, AlertTriangle, X, Play, TrendingUp, MessageSquare, Send, FileText } from "lucide-react";

interface OutboundMessage {
  id: string;
  profileId: string;
  channel: string;
  subject: string;
  content: string;
  status: "DRAFT" | "APPROVED" | "REJECTED" | "EDITED" | "PENDING" | "SENDING" | "SENT" | "FAILED" | "REPLIED" | "EDTIED";
  sentAt: string | null;
  createdAt: string;
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
  updatedAt: string;
  outboundMessages?: OutboundMessage[];
}

interface Resume {
  id: string;
  title: string;
  parsedText: string;
  skills: string[];
  experience: string | null;
  projects: string | null;
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  type: string;
  prompt: string;
  active: boolean;
  createdAt: string;
}

export function LinkedinOutreach() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  const OUTREACH_API_KEY = process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b";

  // State definitions
  const [linkedinAuth, setLinkedinAuth] = useState<{ authenticated: boolean }>({ authenticated: false });
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectingStatusText, setConnectingStatusText] = useState("");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  // Form selections for bulk/AI generation
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // New Profile Form
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileRole, setNewProfileRole] = useState("");
  const [newProfileCompany, setNewProfileCompany] = useState("");
  const [newProfileLinkedinUrl, setNewProfileLinkedinUrl] = useState("");
  const [newProfileNotes, setNewProfileNotes] = useState("");
  const [addingProfile, setAddingProfile] = useState(false);
  const [fileExtracting, setFileExtracting] = useState(false);
  const [importingCookies, setImportingCookies] = useState(false);

  // Selection & Progress
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCampaignRunning, setIsCampaignRunning] = useState(false);

  // Edit Message Modal
  const [editingMessage, setEditingMessage] = useState<OutboundMessage | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch authentication status
  const checkLinkedinAuthStatus = async () => {
    try {
      setCheckingAuth(true);
      const res = await fetch(`${API_BASE}/outreach/linkedin/status`, {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      setLinkedinAuth({ authenticated: !!json.authenticated });
    } catch (err) {
      console.warn("Failed to check LinkedIn status:", err);
    } finally {
      setCheckingAuth(false);
    }
  };

  // Launch manual headed login session
  const connectLinkedinAccount = async () => {
    try {
      setConnecting(true);
      setConnectingStatusText("Launching headed Chrome browser on your desktop...");
      
      const res = await fetch(`${API_BASE}/outreach/linkedin/connect`, {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" },
      });
      
      if (!res.ok) {
        throw new Error("Failed to authenticate session");
      }
      
      setConnectingStatusText("Authentication browser session completed.");
      await checkLinkedinAuthStatus();
    } catch (err) {
      console.error("Connect failed:", err);
      alert("LinkedIn session configuration failed. Please verify console logs.");
    } finally {
      setConnecting(false);
      setConnectingStatusText("");
    }
  };

  // Fetch Resumes, Templates, and Profiles
  const fetchData = async () => {
    try {
      setLoading(true);
      const [resResumes, resTemplates, resProfiles] = await Promise.all([
        fetch(`${API_BASE}/outreach-flow/resumes`, { headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" } }),
        fetch(`${API_BASE}/outreach-flow/templates`, { headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" } }),
        fetch(`${API_BASE}/outreach-flow/profiles`, { headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" } }),
      ]);

      const jsonResumes = await resResumes.json();
      const jsonTemplates = await resTemplates.json();
      const jsonProfiles = await resProfiles.json();

      if (jsonResumes.success) {
        setResumes(jsonResumes.data);
        if (jsonResumes.data.length > 0) setSelectedResumeId(jsonResumes.data[0].id);
      }
      if (jsonTemplates.success) {
        // Filter templates that fit networking or referral types
        setTemplates(jsonTemplates.data);
        if (jsonTemplates.data.length > 0) setSelectedTemplateId(jsonTemplates.data[0].id);
      }
      if (jsonProfiles.success) {
        setProfiles(jsonProfiles.data);
      }
    } catch (err) {
      console.warn("Failed to load campaign dependencies:", err);
    } finally {
      setLoading(false);
    }
  };

  // Poll for campaign sending updates when running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCampaignRunning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/outreach-flow/profiles`, {
            headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" },
          });
          const json = await res.json();
          if (json.success) {
            setProfiles(json.data);
            
            // Check if any selected messages are still in SENDING status
            const activeCampaignIds = selectedProfileIds;
            const stillSending = json.data.some((p: Profile) => {
              if (!activeCampaignIds.includes(p.id)) return false;
              const msg = p.outboundMessages?.find((m) => m.channel === "LINKEDIN");
              return msg?.status === "SENDING";
            });

            if (!stillSending) {
              setIsCampaignRunning(false);
              setSelectedProfileIds([]);
            }
          }
        } catch (err) {
          console.warn("Polling profiles failed:", err);
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isCampaignRunning, selectedProfileIds, API_BASE]);

  useEffect(() => {
    checkLinkedinAuthStatus();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add a Recruiter target profile
  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName || !newProfileRole || !newProfileCompany) return;

    setAddingProfile(true);
    try {
      const res = await fetch(`${API_BASE}/outreach-flow/profiles`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          profiles: [
            {
              name: newProfileName,
              role: newProfileRole,
              company: newProfileCompany,
              linkedinUrl: newProfileLinkedinUrl || null,
              notes: newProfileNotes || null,
            },
          ],
        }),
      });

      const json = await res.json();
      if (json.success) {
        setNewProfileName("");
        setNewProfileRole("");
        setNewProfileCompany("");
        setNewProfileLinkedinUrl("");
        setNewProfileNotes("");
        await fetchData();
      } else {
        alert(json.message || "Failed to create target profile.");
      }
    } catch (err) {
      console.error("Failed to add profile:", err);
    } finally {
      setAddingProfile(false);
    }
  };

  // Process the dropped or selected PDF or Image profile file
  const processUploadedFile = async (file: File) => {
    if (!file) return;

    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Unsupported file format. Please upload a PDF or an image of a profile/resume.");
      return;
    }

    setFileExtracting(true);

    const convertBase64 = (f: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.readAsDataURL(f);
        fileReader.onload = () => resolve(fileReader.result as string);
        fileReader.onerror = (error) => reject(error);
      });
    };

    try {
      const base64Str = await convertBase64(file);
      
      const res = await fetch(`${API_BASE}/outreach/linkedin/extract-file`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          fileData: base64Str,
          mimeType: file.type,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        // Auto-populate fields dynamically
        setNewProfileName(json.data.name || "");
        setNewProfileRole(json.data.role || "");
        setNewProfileCompany(json.data.company || "");
        setNewProfileLinkedinUrl(json.data.linkedinUrl || "");
        setNewProfileNotes(json.data.notes || "");
      } else {
        alert(json.message || "Failed to extract details from the uploaded document.");
      }
    } catch (err) {
      console.error("Profile file analysis failed:", err);
      alert("Error contacting the profile parser backend. Please try again.");
    } finally {
      setFileExtracting(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleCookieImportSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      alert("Please upload a JSON file containing exported cookies.");
      return;
    }

    setImportingCookies(true);
    try {
      const fileText = await file.text();
      const rawCookies = JSON.parse(fileText);

      const res = await fetch(`${API_BASE}/outreach/linkedin/import-cookies`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({ cookies: rawCookies }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert("LinkedIn cookies imported successfully! Session is now active.");
        await checkLinkedinAuthStatus();
      } else {
        alert(json.message || "Failed to import cookies.");
      }
    } catch (err) {
      console.error("Cookie import failed:", err);
      alert("Failed to parse cookies JSON. Ensure it is a valid exported JSON array.");
    } finally {
      setImportingCookies(false);
      e.target.value = "";
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF format resume.");
      return;
    }

    setLoading(true);
    try {
      const convertBase64 = (f: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const fileReader = new FileReader();
          fileReader.readAsDataURL(f);
          fileReader.onload = () => resolve(fileReader.result as string);
          fileReader.onerror = (error) => reject(error);
        });
      };

      const base64Str = await convertBase64(file);
      const res = await fetch(`${API_BASE}/outreach-flow/resumes`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true"
        },
        body: JSON.stringify({
          title: file.name.replace(".pdf", ""),
          pdfBase64: base64Str
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        alert("Master resume uploaded and parsed successfully!");
        // Refresh resumes list and select the uploaded one
        const updatedRes = await fetch(`${API_BASE}/outreach-flow/resumes`, {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" }
        });
        const updatedJson = await updatedRes.json();
        if (updatedJson.success) {
          setResumes(updatedJson.data);
          // Set selection to the uploaded resume
          const uploadedResume = updatedJson.data.find((r: Resume) => r.title === file.name.replace(".pdf", ""));
          if (uploadedResume) {
            setSelectedResumeId(uploadedResume.id);
          } else if (updatedJson.data.length > 0) {
            setSelectedResumeId(updatedJson.data[0].id);
          }
        }
      } else {
        alert("Upload failed: " + (json.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Resume upload error:", err);
      alert("Error parsing and uploading resume.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  // Generate customized AI DM
  const handleGenerateMessage = async (profileId: string) => {
    if (!selectedResumeId || !selectedTemplateId) {
      alert("Please upload a resume and select a template first.");
      return;
    }

    setActionLoading(`generate-${profileId}`);
    try {
      const res = await fetch(`${API_BASE}/outreach/linkedin/generate`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          profileId,
          resumeId: selectedResumeId,
          templateId: selectedTemplateId,
        }),
      });

      const json = await res.json();
      if (json.success) {
        await fetchData();
      } else {
        alert(json.message || "Message generation failed.");
      }
    } catch (err) {
      console.error("AI Message Generation failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Single Delete Profile
  const handleDeleteProfile = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recruiter prospect?")) return;
    try {
      const res = await fetch(`${API_BASE}/outreach-flow/profiles/${id}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      if (json.success) {
        setProfiles((prev) => prev.filter((p) => p.id !== id));
        setSelectedProfileIds((prev) => prev.filter((item) => item !== id));
      }
    } catch (err) {
      console.error("Delete profile failed:", err);
    }
  };

  // Edit Message Handlers
  const handleOpenEdit = (msg: OutboundMessage) => {
    setEditingMessage(msg);
    setEditedContent(msg.content);
  };

  const handleSaveEdits = async () => {
    if (!editingMessage) return;
    setSavingEdit(true);
    try {
      // Use existing patch endpoint: /outreach-flow/approval/:id
      const res = await fetch(`${API_BASE}/outreach-flow/approval/${editingMessage.id}`, {
        method: "PATCH",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          subject: editingMessage.subject || "Connection Request Note",
          content: editedContent,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEditingMessage(null);
        await fetchData();
      } else {
        alert(json.message || "Failed to update draft text.");
      }
    } catch (err) {
      console.error("Save message failed:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Sequential Background DM campaign dispatcher
  const handleDispatchCampaign = async () => {
    const selectedMessages = profiles
      .filter((p) => selectedProfileIds.includes(p.id))
      .map((p) => p.outboundMessages?.find((m) => m.channel === "LINKEDIN"))
      .filter(Boolean) as OutboundMessage[];

    const pendingMsgIds = selectedMessages
      .filter((m) => m.status === "DRAFT" || m.status === "EDTIED" || m.status === "FAILED")
      .map((m) => m.id);

    if (pendingMsgIds.length === 0) {
      alert("No valid DRAFT or FAILED LinkedIn messages found for the selected recruiters.");
      return;
    }

    if (!linkedinAuth.authenticated) {
      if (!confirm("LinkedIn session is unauthenticated. Background dispatch will fail. Proceed anyway?")) {
        return;
      }
    }

    setActionLoading("sending-bulk");
    try {
      const res = await fetch(`${API_BASE}/outreach/linkedin/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
          "X-API-Key": OUTREACH_API_KEY,
        },
        body: JSON.stringify({ messageIds: pendingMsgIds }),
      });

      const json = await res.json();
      if (json.success) {
        setIsCampaignRunning(true);
        // Instant local state update to SENDING status for visual feedback
        setProfiles((prev) =>
          prev.map((p) => {
            if (selectedProfileIds.includes(p.id)) {
              const msgs = p.outboundMessages?.map((m) =>
                m.channel === "LINKEDIN" ? { ...m, status: "SENDING" as const } : m
              );
              return { ...p, outboundMessages: msgs };
            }
            return p;
          })
        );
      } else {
        alert(json.message || "Failed to trigger LinkedIn DM campaign.");
      }
    } catch (err) {
      console.error("LinkedIn DM dispatch failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelectProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    // Select all profiles that have generated messages ready for sending
    const actionable = profiles.filter((p) => {
      const msg = p.outboundMessages?.find((m) => m.channel === "LINKEDIN");
      return msg && (msg.status === "DRAFT" || msg.status === "EDTIED" || msg.status === "FAILED" || msg.status === "SENDING" || msg.status === "SENT");
    });
    
    if (selectedProfileIds.length === actionable.length) {
      setSelectedProfileIds([]);
    } else {
      setSelectedProfileIds(actionable.map((p) => p.id));
    }
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      
      {/* 1. LINKEDIN SESSION STATUS & HEADING */}
      <div className="border border-border bg-card p-4 rounded-md shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm shrink-0 ${linkedinAuth.authenticated ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-amber-500/10 border-amber-500/20 text-amber-600"}`}>
            {linkedinAuth.authenticated ? <Link2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {linkedinAuth.authenticated ? "LinkedIn Session Cache Active" : "LinkedIn Session Connection Required"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {linkedinAuth.authenticated 
                ? "Stealth browser session authenticated using cached cookies." 
                : "A headed browser window will launch on your system to complete secure manual login."}
            </p>
            {connectingStatusText && (
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                ℹ {connectingStatusText}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={checkLinkedinAuthStatus}
            disabled={checkingAuth || connecting}
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-3 py-2 gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingAuth ? "animate-spin" : ""}`} /> Refresh Status
          </button>

          {linkedinAuth.authenticated ? (
            <span className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 h-9 px-3 py-2 gap-1">
              <Check className="w-3.5 h-3.5" /> Session Live
            </span>
          ) : (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={connectLinkedinAccount}
                disabled={connecting || importingCookies}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-3 py-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {connecting ? "Opening Session..." : "Connect Session"}
              </button>

              <label className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-3 py-2 transition-colors cursor-pointer disabled:opacity-50">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleCookieImportSelect}
                  disabled={connecting || importingCookies}
                  className="hidden"
                />
                {importingCookies ? "Importing..." : "Import Cookies"}
              </label>
            </div>
          )}
        </div>
      </div>      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_2fr] gap-10 items-start">
        
        {/* 2. ADD RECRUITER FORM SIDE */}
        <div className="flex flex-col gap-6">
          
          {/* Main Manual Import Form */}
          <div className="border border-border bg-card p-6 rounded-md shadow-xs flex flex-col gap-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Add LinkedIn Prospect.
            </h3>

            {/* Drag & Drop PDF / Image Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("border-black", "bg-zinc-50");
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-black", "bg-zinc-50");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("border-black", "bg-zinc-50");
                handleFileDrop(e);
              }}
              onClick={() => document.getElementById("linkedin-profile-file-input")?.click()}
              className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-400 transition-all flex flex-col items-center gap-2"
            >
              <input
                id="linkedin-profile-file-input"
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <FileText className="w-8 h-8 text-zinc-400" />
              <div className="font-semibold text-xs text-foreground">
                {fileExtracting ? "Extracting details..." : "Drag & Drop Profile PDF or Image"}
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal max-w-[200px]">
                Drop a PDF or image of a resume or LinkedIn profile to extract details automatically
              </p>
            </div>

            <form onSubmit={handleAddProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Recruiter Name</label>
                <input 
                  type="text" 
                  placeholder="Jane Doe"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  required
                  className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background placeholder:text-zinc-400 outline-hidden focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Role Title</label>
                  <input 
                    type="text" 
                    placeholder="Technical Recruiter"
                    value={newProfileRole}
                    onChange={(e) => setNewProfileRole(e.target.value)}
                    required
                    className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background placeholder:text-zinc-400 outline-hidden focus:ring-1 focus:ring-black w-full"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Company</label>
                  <input 
                    type="text" 
                    placeholder="Google"
                    value={newProfileCompany}
                    onChange={(e) => setNewProfileCompany(e.target.value)}
                    required
                    className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background placeholder:text-zinc-400 outline-hidden focus:ring-1 focus:ring-black w-full"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">LinkedIn Profile URL</label>
                <input 
                  type="url" 
                  placeholder="https://www.linkedin.com/in/recruiter-username"
                  value={newProfileLinkedinUrl}
                  onChange={(e) => setNewProfileLinkedinUrl(e.target.value)}
                  className="h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background placeholder:text-zinc-400 outline-hidden focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Notes / Outreach Context</label>
                <textarea 
                  rows={3}
                  placeholder="E.g., recruiting for the Platform Engineering role or met at tech conference..."
                  value={newProfileNotes}
                  onChange={(e) => setNewProfileNotes(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-3 text-xs transition-colors placeholder:text-zinc-400 focus:border-black focus:outline-hidden focus:ring-1 focus:ring-black resize-y"
                />
              </div>

              <button
                type="submit"
                disabled={addingProfile}
                className="h-9 w-full bg-black text-white text-xs font-semibold hover:bg-black/90 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {addingProfile ? "Adding Profile..." : "Add Recruiter Target"}
              </button>
            </form>
          </div>

          {/* AI Settings Section */}
          <div className="border border-border bg-card p-6 rounded-md shadow-xs flex flex-col gap-4">
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              AI Generation Parameters.
            </h4>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Master Latex Resume</label>
                <div className="flex gap-2">
                  <select 
                    value={selectedResumeId}
                    onChange={(e) => setSelectedResumeId(e.target.value)}
                    className="flex-1 h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background cursor-pointer outline-hidden focus:ring-1 focus:ring-black"
                  >
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                    {resumes.length === 0 && <option value="">No resumes found</option>}
                  </select>

                  <label className="h-9 inline-flex items-center justify-center rounded-md text-xs font-semibold border border-input bg-background hover:bg-zinc-50 text-foreground px-3 py-2 gap-1.5 transition-colors cursor-pointer whitespace-nowrap">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleResumeUpload}
                      className="hidden"
                    />
                    📤 Upload PDF
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Target Prompt Template</label>
                <select 
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full h-9 border border-input focus:border-black text-xs transition-colors rounded-md px-3 bg-background cursor-pointer outline-hidden focus:ring-1 focus:ring-black"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.type})
                    </option>
                  ))}
                  {templates.length === 0 && <option value="">No templates found</option>}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 3. CAMPAIGN TRACKER BOARD */}
        <div className="border border-border bg-card p-6 rounded-md shadow-xs flex flex-col gap-4 min-h-[550px]">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                LinkedIn Campaign Tracker.
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate Gemini connection request notes under 300 characters and automate sequential messaging.
              </p>
            </div>
            <button 
              onClick={fetchData} 
              className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-[300px]">
              <div className="text-muted-foreground text-xs font-mono">Loading campaign board...</div>
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-[300px] gap-2">
              <span className="text-2xl">🎯</span>
              <p className="text-muted-foreground text-xs">No recruiter prospects registered yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 px-1 w-10 text-center">
                      <input 
                        type="checkbox"
                        checked={
                          profiles.length > 0 && 
                          profiles.filter(p => p.outboundMessages?.some(m => m.channel === "LINKEDIN")).length > 0 &&
                          selectedProfileIds.length === profiles.filter(p => p.outboundMessages?.some(m => m.channel === "LINKEDIN")).length
                        }
                        onChange={toggleSelectAll}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="py-2 px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Recruiter Target</th>
                    <th className="py-2 px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Company</th>
                    <th className="py-2 px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">LinkedIn Note</th>
                    <th className="py-2 px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-left">Status</th>
                    <th className="py-2 px-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => {
                    const linkedInMsg = profile.outboundMessages?.find((m) => m.channel === "LINKEDIN");
                    const hasLinkedinUrl = !!profile.linkedinUrl;

                    return (
                      <tr 
                        key={profile.id} 
                        className={`border-b border-zinc-100 transition-colors ${
                          selectedProfileIds.includes(profile.id) ? "bg-zinc-50/70" : "hover:bg-zinc-50/30"
                        }`}
                      >
                        <td className="py-3 px-1 text-center">
                          {linkedInMsg && (
                            <input 
                              type="checkbox"
                              checked={selectedProfileIds.includes(profile.id)}
                              onChange={() => toggleSelectProfile(profile.id)}
                              className="cursor-pointer"
                            />
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-xs text-foreground">{profile.name}</div>
                          <div className="text-[10px] text-muted-foreground">{profile.role}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-xs font-semibold text-foreground">{profile.company}</div>
                          {hasLinkedinUrl ? (
                            <a 
                              href={profile.linkedinUrl!} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-black hover:underline mt-0.5"
                            >
                              🔗 View Profile
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium">⚠️ Missing URL</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {linkedInMsg ? (
                            <div className="flex flex-col gap-0.5">
                              <p className="text-[11px] text-foreground italic line-clamp-1 max-w-[160px]" title={linkedInMsg.content}>
                               &ldquo;{linkedInMsg.content}&rdquo;
                              </p>
                              <span className="text-[9px] font-mono text-muted-foreground">
                                {linkedInMsg.content.length} chars / 300 max
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">No message drafted</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {linkedInMsg ? (
                            <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-semibold font-mono border ${getStatusBadgeStyles(linkedInMsg.status)}`}>
                              {linkedInMsg.status.toLowerCase()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex justify-end items-center gap-2">
                            {!linkedInMsg ? (
                              <button
                                onClick={() => handleGenerateMessage(profile.id)}
                                disabled={actionLoading === `generate-${profile.id}` || !hasLinkedinUrl}
                                className="h-7 inline-flex items-center justify-center rounded-md px-2.5 text-[11px] font-semibold bg-black text-white hover:bg-black/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {actionLoading === `generate-${profile.id}` ? "Drafting..." : "⚡ Generate AI Note"}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(linkedInMsg)}
                                  className="h-7 inline-flex items-center justify-center rounded-md px-2.5 text-[11px] font-semibold border border-border bg-background hover:bg-zinc-50 text-foreground transition-colors cursor-pointer"
                                >
                                  Edit Draft
                                </button>
                                <button
                                  onClick={() => handleGenerateMessage(profile.id)}
                                  disabled={actionLoading === `generate-${profile.id}`}
                                  className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                  title="Regenerate Draft message"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteProfile(profile.id)}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md cursor-pointer transition-colors"
                              title="Delete profile"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      </div>

      {/* 4. FLOATING GLASS DISPATCH BAR */}
      {selectedProfileIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-6 py-4 rounded-md shadow-lg flex items-center justify-between gap-8 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 w-full max-w-xl">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-zinc-400 shrink-0" />
            <div>
              <div className="font-semibold text-xs">{selectedProfileIds.length} LinkedIn DMs Selected</div>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Sequential dispatches wait 5-10s randomly to protect account safety.
              </p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setSelectedProfileIds([])}
              className="h-8 px-3 text-xs font-medium border border-zinc-700 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleDispatchCampaign}
              disabled={actionLoading === "sending-bulk" || isCampaignRunning}
              className="h-8 px-4 text-xs font-semibold bg-white text-black hover:bg-zinc-100 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isCampaignRunning ? "Sending..." : "Send Selected DMs"}
            </button>
          </div>
        </div>
      )}

      {/* 5. EDIT MESSAGE DRAFT MODAL */}
      {editingMessage && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={() => setEditingMessage(null)}
        >
          <div 
            className="bg-card border border-border rounded-md p-6 w-full max-w-md shadow-lg flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                Edit Personalized Cold Note
              </h3>
              <button 
                onClick={() => setEditingMessage(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Message Content</label>
                <textarea 
                  rows={6}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-3 text-xs transition-colors placeholder:text-muted-foreground focus:border-black focus:outline-hidden focus:ring-1 focus:ring-black resize-y"
                />
                <span className={`text-[10px] font-mono self-end ${editedContent.length > 300 ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                  {editedContent.length} / 300 characters {editedContent.length > 300 && "(Truncated by LinkedIn)"}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingMessage(null)}
                  className="h-9 px-4 text-xs font-medium border border-border hover:bg-zinc-50 rounded-md transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveEdits}
                  disabled={savingEdit || editedContent.length === 0}
                  className="h-9 px-4 text-xs font-semibold bg-black text-white hover:bg-black/90 rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEdit ? "Saving..." : "Save Draft Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusBadgeStyles(status: string) {
  switch (status.toUpperCase()) {
    case "SENT":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "SENDING":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "FAILED":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    case "DRAFT":
    case "EDTIED":
    case "EDITED":
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}
