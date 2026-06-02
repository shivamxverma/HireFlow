"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mail, RefreshCw, Plus, Trash2, Inbox, Layers, Lock, Camera, Check, X } from "lucide-react";

interface Message {
  id: string;
  leadId: string;
  type: string;
  subject: string;
  body: string;
  sentAt: string | null;
  createdAt: string;
}

interface Lead {
  id: string;
  companyName: string;
  recipientEmail: string;
  jobDescription: string;
  status: "PENDING" | "GENERATING" | "READY" | "SENDING" | "SENT" | "FAILED";
  threadId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export function GmailOutreach() {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  // Google OAuth Auth State
  const [googleAuth, setGoogleAuth] = useState<{ authenticated: boolean; email: string | null }>({
    authenticated: false,
    email: null,
  });

  // Main Lead List
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Checked Lead IDs for batch actions
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Add Lead Form State
  const [companyName, setCompanyName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  // Bulk Paste State
  const [bulkText, setBulkText] = useState("");

  // Edit Message Modal State
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");

  // Screenshot image extract state
  const [extractingImage, setExtractingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Google OAuth Status
  const checkGoogleAuthStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/outreach/auth/google/status`, {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      setGoogleAuth({
        authenticated: !!json.authenticated,
        email: json.email,
      });
    } catch (err) {
      console.warn("Failed to check Google OAuth status:", err);
    }
  };

  // Fetch Leads List
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/outreach/leads`, {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      if (json.success) {
        setLeads(json.data);
      }
    } catch (err) {
      console.warn("Failed to fetch recruiter leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkGoogleAuthStatus();
    fetchLeads();

    // Listen for Google OAuth successful completion in popup window
    const handleOauthMessage = (event: MessageEvent) => {
      if (event.data === "oauth-success") {
        // Add a 500ms delay to allow the popup window to close and settle the browser context
        setTimeout(() => {
          checkGoogleAuthStatus();
        }, 500);
      }
    };

    // Robust fallback: check status whenever the user returns focus to the window
    const handleWindowFocus = () => {
      checkGoogleAuthStatus();
    };

    window.addEventListener("message", handleOauthMessage);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("message", handleOauthMessage);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Open Google OAuth Popup
  const connectGoogleAccount = () => {
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      `${API_BASE}/outreach/auth/google`,
      "Connect with Google",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );
  };

  // Single Add Lead Handler
  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !recipientEmail || !jobDescription) return;

    setActionLoading("add-lead");
    try {
      const res = await fetch(`${API_BASE}/outreach/leads`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          leads: [{
            companyName,
            recipientEmail,
            jobDescription,
          }],
        }),
      });

      const json = await res.json();
      if (json.success) {
        setCompanyName("");
        setRecipientEmail("");
        setJobDescription("");
        fetchLeads();
      } else {
        alert(json.message || "Failed to add recruiter lead.");
      }
    } catch (err) {
      console.error("Add lead failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Parse & Bulk Add Leads Handler
  const handleBulkAddLeads = async () => {
    if (!bulkText.trim()) return;

    setActionLoading("bulk-add");
    let parsedLeads: { companyName: string; recipientEmail: string; jobDescription: string }[] = [];
    const text = bulkText.trim();

    try {
      // Try JSON
      if (text.startsWith("[") && text.endsWith("]")) {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          parsedLeads = json.map(item => ({
            companyName: item.companyName || item.company || "",
            recipientEmail: item.email || item.recipientEmail || "",
            jobDescription: item.jobDescription || item.description || "Recruiter Outreach",
          }));
        }
      }
    } catch {}

    // Try CSV format
    if (parsedLeads.length === 0) {
      const lines = text.split("\n").filter(l => l.trim().length > 0);
      if (lines.length > 0) {
        const cols = lines[0].toLowerCase().split(",");
        const emailIdx = cols.findIndex(c => c.includes("email"));
        const companyIdx = cols.findIndex(c => c.includes("company"));
        const descIdx = cols.findIndex(c => c.includes("desc") || c.includes("job"));

        const startIdx = (emailIdx !== -1 || companyIdx !== -1) ? 1 : 0;
        const csvLines = lines.slice(startIdx);

        csvLines.forEach(line => {
          const cells = line.split(",").map(c => c.trim());
          if (cells.length > 0) {
            parsedLeads.push({
              companyName: cells[companyIdx !== -1 ? companyIdx : 0] || "Target Company",
              recipientEmail: cells[emailIdx !== -1 ? emailIdx : 1] || "",
              jobDescription: cells[descIdx !== -1 ? descIdx : 2] || "Recruiter Outreach",
            });
          }
        });
      }
    }

    const validLeads = parsedLeads.filter(l => l.recipientEmail && l.recipientEmail.includes("@"));

    if (validLeads.length === 0) {
      alert("Could not parse any valid leads. Double-check your format.");
      setActionLoading(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/outreach/leads`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({ leads: validLeads }),
      });
      const json = await res.json();
      if (json.success) {
        setBulkText("");
        setImportOpen(false);
        fetchLeads();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error("Bulk add failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Image Upload Extraction Handler
  const handleImageExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractingImage(true);

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
      const res = await fetch(`${API_BASE}/outreach/leads/extract-image`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          image: base64Str,
          mimeType: file.type,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setCompanyName(json.data.companyName || "");
        setRecipientEmail(json.data.recipientEmail || "");
        setJobDescription(json.data.jobDescription || "");
      } else {
        alert(json.message || "Failed to extract lead details from screenshot.");
      }
    } catch (err) {
      console.error("Image extract failed:", err);
      alert("Error calling image analysis endpoint. Verify your backend is responsive.");
    } finally {
      setExtractingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete Recruiter Lead
  const handleDeleteLead = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recruiter lead?")) return;
    try {
      const res = await fetch(`${API_BASE}/outreach/leads/${id}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      if (json.success) {
        setLeads(prev => prev.filter(l => l.id !== id));
        setSelectedLeadIds(prev => prev.filter(item => item !== id));
      }
    } catch (err) {
      console.error("Delete lead failed:", err);
    }
  };

  // Edit Message Form Handler
  const handleSaveMessageEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMessage) return;

    try {
      const res = await fetch(`${API_BASE}/outreach/messages/${editingMessage.id}`, {
        method: "PATCH",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({
          subject: editedSubject,
          body: editedBody,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEditingMessage(null);
        fetchLeads();
      }
    } catch (err) {
      console.error("Edit message failed:", err);
    }
  };

  // Generate Cold Emails for ALL leads that don't have one
  const handleGenerateAllEmails = async () => {
    setActionLoading("generate-emails");
    try {
      const res = await fetch(`${API_BASE}/outreach/generate-all`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b", "bypass-tunnel-reminder": "true" },
      });
      const json = await res.json();
      alert(json.message);
      fetchLeads();
    } catch (err) {
      console.error("Bulk generate failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Send Single Mail via Gmail API
  const handleSendSingleMail = async (leadId: string) => {
    setActionLoading(`sending-${leadId}`);
    try {
      const res = await fetch(`${API_BASE}/outreach/send/${leadId}`, {
        method: "POST",
        headers: { 
          "bypass-tunnel-reminder": "true",
          "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b"
        },
      });
      const json = await res.json();
      if (json.success) {
        fetchLeads();
      } else {
        alert(json.message || "Failed to send email.");
      }
    } catch (err) {
      console.error("Single send failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk Send Selected Initial Emails
  const handleSendSelectedMails = async () => {
    if (selectedLeadIds.length === 0) return;

    setActionLoading("sending-bulk");
    let success = 0;
    let failed = 0;

    for (const leadId of selectedLeadIds) {
      const lead = leads.find(l => l.id === leadId);
      const unsentInitial = lead?.messages.find(m => m.type === "INITIAL" && !m.sentAt);
      
      if (!unsentInitial) continue;

      try {
        const res = await fetch(`${API_BASE}/outreach/send/${leadId}`, {
          method: "POST",
          headers: { 
            "bypass-tunnel-reminder": "true",
            "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b"
          },
        });
        const json = await res.json();
        if (res.ok && json.success) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    alert(`Bulk Send complete!\nSuccessfully sent: ${success}\nFailed: ${failed}`);
    setSelectedLeadIds([]);
    fetchLeads();
    setActionLoading(null);
  };

  // Generate Follow-Ups for Checked Leads
  const handleGenerateFollowUps = async () => {
    if (selectedLeadIds.length === 0) return;

    setActionLoading("generate-followups");
    try {
      const res = await fetch(`${API_BASE}/outreach/followups/generate`, {
        method: "POST",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b",
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
        },
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });
      const json = await res.json();
      alert(json.message);
      fetchLeads();
    } catch (err) {
      console.error("Follow-up generation failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Send Follow-Ups inside the SAME thread for Checked Leads
  const handleSendFollowUps = async () => {
    if (selectedLeadIds.length === 0) return;

    setActionLoading("sending-followups");
    try {
      const res = await fetch(`${API_BASE}/outreach/followups/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "true",
          "X-API-Key": process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "hireflow_sec_key_2026_x92a8b"
        },
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });
      const json = await res.json();
      alert(json.message);
      setSelectedLeadIds([]);
      fetchLeads();
    } catch (err) {
      console.error("Follow-up sending failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(l => l.id));
    }
  };

  // Metadata aggregation calculations
  const getFollowUpCount = (lead: Lead) => {
    return lead.messages.filter(m => m.type.startsWith("FOLLOWUP_")).length;
  };

  const getLastSentDate = (lead: Lead) => {
    const sent = lead.messages.filter(m => m.sentAt);
    if (sent.length === 0) return "N/A";
    
    // Grab the most recent sent message
    const sorted = [...sent].sort(
      (a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime()
    );
    return new Date(sorted[0].sentAt!).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Google OAuth Connection Banner */}
      <div className="border border-border bg-card p-4 rounded-md shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm shrink-0 ${googleAuth.authenticated ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-amber-500/10 border-amber-500/20 text-amber-600"}`}>
            {googleAuth.authenticated ? <Mail className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {googleAuth.authenticated ? "Google Account Connected" : "Google Account Connection Required"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {googleAuth.authenticated 
                ? `Authorized as ${googleAuth.email || "Active User"}. Ready to dispatch cold outreach campaigns.` 
                : "Connect your Google account to grant secure permission for automated cold email campaigns."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={checkGoogleAuthStatus}
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-3 py-2 gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
          </button>

          {googleAuth.authenticated ? (
            <span className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 h-9 px-3 py-2 gap-1">
              <Check className="w-3.5 h-3.5" /> Google Active
            </span>
          ) : (
            <button
              onClick={connectGoogleAccount}
              className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-3 py-2 transition-colors cursor-pointer"
            >
              Connect Google Account
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* 2. ADD RECRUITER FORM SIDE */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          
          {/* Main Manual Import Form */}
          <div className="border border-border bg-card p-5 rounded-md shadow-xs flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-muted-foreground" /> Add Recruiter Target
              </h3>
              
              {/* Screenshot extract label button */}
              <label className="inline-flex items-center gap-1.5 border border-border bg-background hover:bg-accent text-[10px] font-mono font-semibold uppercase px-2 py-1 rounded cursor-pointer transition-colors text-muted-foreground hover:text-foreground">
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleImageExtract} 
                  disabled={extractingImage} 
                  className="hidden"
                />
                <Camera className="w-3.5 h-3.5 shrink-0" />
                {extractingImage ? "Analyzing..." : "Extract Image"}
              </label>
            </div>

            <form onSubmit={handleAddLead} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Company Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Stripe"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Recruiter Email</label>
                <input 
                  type="email"
                  placeholder="e.g. recruiter@stripe.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Job Description Context</label>
                <textarea 
                  rows={5}
                  placeholder="Paste details of the role or specific specs..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  required
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors font-sans"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={actionLoading === "add-lead"}
                  className="flex-1 inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 py-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === "add-lead" ? "Adding..." : "Add Single Lead"}
                </button>
                
                <button
                  type="button"
                  onClick={() => setImportOpen(!importOpen)}
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-3 py-2 transition-colors cursor-pointer"
                >
                  Bulk Import
                </button>
              </div>
            </form>
          </div>

          {/* Bulk Paste Importer Drawer */}
          {importOpen && (
            <div className="border border-dashed border-border bg-muted/20 p-4 rounded-md flex flex-col gap-3 animate-in fade-in duration-200">
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                📋 Paste Recruiter Details (CSV / JSON)
              </h4>
              <textarea 
                rows={5}
                placeholder={`Example CSV:\ncompanyName,recipientEmail,jobDescription\nStripe,recruiter@stripe.com,Software Engineer\n\nOr JSON:\n[{"companyName": "Stripe", "email": "recruiter@stripe.com", "jobDescription": "..."}]`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs font-mono placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  onClick={() => setImportOpen(false)}
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-transparent bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground h-8 px-3 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAddLeads}
                  disabled={actionLoading === "bulk-add"}
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-8 px-4 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === "bulk-add" ? "Importing..." : "Parse & Import"}
                </button>
              </div>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-border bg-card p-3 rounded-md shadow-xs text-center flex flex-col justify-center">
              <div className="text-xl font-bold tracking-tight text-foreground font-mono tabular-nums">{leads.length}</div>
              <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">Total</div>
            </div>
            <div className="border border-border bg-card p-3 rounded-md shadow-xs text-center flex flex-col justify-center">
              <div className="text-xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {leads.filter(l => l.status === "READY").length}
              </div>
              <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">Ready</div>
            </div>
            <div className="border border-border bg-card p-3 rounded-md shadow-xs text-center flex flex-col justify-center">
              <div className="text-xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {leads.filter(l => l.status === "SENT").length}
              </div>
              <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">Sent</div>
            </div>
          </div>

        </div>

        {/* 3. CAMPAIGN ACTION GRID / DASHBOARD DECK */}
        <div className="lg:col-span-2 border border-border bg-card rounded-md p-5 shadow-xs flex flex-col gap-4">
          {/* Header controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-border">
            <div>
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-muted-foreground" /> Outreach Campaigns Tracker
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select rows to trigger personalized generations and replies.
              </p>
            </div>

            <div className="shrink-0">
              <button
                onClick={handleGenerateAllEmails}
                disabled={actionLoading !== null || leads.length === 0}
                className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 py-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {actionLoading === "generate-emails" ? "Generating..." : "Generate Cold Mails"}
              </button>
            </div>
          </div>

          {/* Leads table */}
          {loading && leads.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-12">Loading campaign list…</p>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 bg-secondary/10 border border-dashed rounded-md p-6">
              <Inbox className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs font-semibold text-foreground">No Recruiter Targets Registered Yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-md">
              <table className="w-full border-collapse text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === leads.length}
                        onChange={toggleSelectAll}
                        className="cursor-pointer rounded-sm border-border"
                      />
                    </th>
                    <th className="py-2.5 px-3">Company / Recipient</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Outbox Details</th>
                    <th className="py-2.5 px-3 text-center">Follow Ups</th>
                    <th className="py-2.5 px-3">Last Sent</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const initialMail = lead.messages.find(m => m.type === "INITIAL");
                    const isChecked = selectedLeadIds.includes(lead.id);

                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors ${isChecked ? "bg-secondary/40" : ""}`}
                      >
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectLead(lead.id)}
                            className="cursor-pointer rounded-sm border-border"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground">{lead.companyName}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">{lead.recipientEmail}</div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono font-semibold uppercase border ${
                            lead.status === "SENT" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" :
                            lead.status === "READY" ? "bg-blue-500/10 border-blue-500/20 text-blue-600" :
                            lead.status === "GENERATING" || lead.status === "SENDING" ? "bg-purple-500/10 border-purple-500/20 text-purple-600 animate-pulse" :
                            lead.status === "FAILED" ? "bg-red-500/10 border-red-500/20 text-red-600" : "bg-zinc-500/10 border-zinc-500/20 text-zinc-600"
                          }`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {initialMail ? (
                            <button
                              onClick={() => {
                                setEditingMessage(initialMail);
                                setEditedSubject(initialMail.subject);
                                setEditedBody(initialMail.body);
                              }}
                              className="inline-flex items-center justify-center rounded-md border border-border bg-background hover:bg-accent text-foreground text-[11px] px-2.5 py-1 transition-colors cursor-pointer font-sans"
                            >
                              📝 {initialMail.subject.length > 25 ? initialMail.subject.substring(0, 25) + "..." : initialMail.subject}
                            </button>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">No cold mail yet</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-foreground font-mono tabular-nums">
                          {getFollowUpCount(lead)}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground font-mono text-[11px]">
                          {getLastSentDate(lead)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex gap-2 justify-end items-center">
                            {lead.status === "READY" && (
                              <button
                                onClick={() => handleSendSingleMail(lead.id)}
                                disabled={actionLoading !== null || !googleAuth.authenticated}
                                className="inline-flex items-center justify-center rounded-md text-[10px] font-semibold bg-primary text-primary-foreground hover:opacity-90 h-7 px-2.5 transition-colors cursor-pointer disabled:opacity-50"
                                title={!googleAuth.authenticated ? "Connect Google account first" : "Send Email"}
                              >
                                {actionLoading === `sending-${lead.id}` ? "..." : "Send 🚀"}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 transition-colors cursor-pointer"
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

          {/* Bulk Sending / Threading Action Blocks */}
          {selectedLeadIds.length > 0 && (
            <div className="mt-4 border border-border bg-secondary/50 p-4 rounded-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-in fade-in duration-200">
              <span className="text-xs text-muted-foreground">
                Selected Recipient(s): <b className="text-foreground font-mono tabular-nums">{selectedLeadIds.length} lead(s)</b>
              </span>

              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button
                  onClick={handleSendSelectedMails}
                  disabled={actionLoading !== null || !googleAuth.authenticated}
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 transition-colors cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                >
                  Send Cold Mails 🚀
                </button>

                <button
                  onClick={handleGenerateFollowUps}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-3 transition-colors cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                >
                  {actionLoading === "generate-followups" ? "Generating..." : "Generate Follow Up"}
                </button>

                <button
                  onClick={handleSendFollowUps}
                  disabled={actionLoading !== null || !googleAuth.authenticated}
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 transition-colors cursor-pointer disabled:opacity-50 w-full sm:w-auto"
                >
                  {actionLoading === "sending-followups" ? "Replying..." : "Send Threaded Follow Ups"}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* 4. EDIT MESSAGE MODAL OVERLAY */}
      {editingMessage && (
        <div 
          className="fixed inset-0 bg-black/45 backdrop-blur-xs z-[9999] flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setEditingMessage(null)}
        >
          <div 
            className="w-full max-w-xl bg-background border border-border p-6 shadow-2xl rounded-lg font-sans animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex justify-between items-start mb-4 pb-3 border-b border-border relative">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider">Draft Review</p>
                <h4 className="text-sm font-semibold text-foreground mt-1">Review & Edit Cold Email Draft</h4>
              </div>
              <button 
                className="absolute right-0 top-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer" 
                onClick={() => setEditingMessage(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <form onSubmit={handleSaveMessageEdits} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Subject Line</label>
                <input 
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Email Body</label>
                <textarea 
                  rows={10}
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  required
                  className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMessage(null)}
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-4 py-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 py-2 transition-colors cursor-pointer"
                >
                  Save Draft Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
