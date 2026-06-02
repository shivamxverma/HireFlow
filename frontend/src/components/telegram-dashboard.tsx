"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  TrendingUp,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  Inbox,
} from "lucide-react";

interface MonitoredChannel {
  id: string;
  channelId: string;
  title: string;
  username: string | null;
  createdAt: string;
}

interface JoinedChannel {
  id: string;
  title: string;
  username: string | null;
  isChannel: boolean;
  isGroup: boolean;
}

interface RawMessage {
  id: string;
  channelId: string;
  channelName: string;
  messageId: number;
  messageText: string;
  postedAt: string;
  processed: boolean;
  status: string; // UNPROCESSED, PROCESSED, REJECTED, SKIPPED_DUPLICATE
  errorMessage: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  unprocessed: number;
  processed: number;
  rejected: number;
  skipped: number;
}

export function TelegramDashboard() {
  const [monitoredChannels, setMonitoredChannels] = useState<MonitoredChannel[]>([]);
  const [joinedChannels, setJoinedChannels] = useState<JoinedChannel[]>([]);
  const [messages, setMessages] = useState<RawMessage[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    unprocessed: 0,
    processed: 0,
    rejected: 0,
    skipped: 0,
  });

  const [loading, setLoading] = useState(false);
  const [loadingJoined, setLoadingJoined] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Auth passcode state (matches outreach-board.tsx structure)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Adding channel inputs
  const [selectedJoinedChannelId, setSelectedJoinedChannelId] = useState("");

  // Historical import inputs
  const [selectedImportChannelId, setSelectedImportChannelId] = useState("");
  const [fromDate, setFromDate] = useState("2026-05-01");
  const [toDate, setToDate] = useState("2026-06-01");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  const getApiKey = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("outreach_api_key") || process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "bypass_key";
    }
    return process.env.NEXT_PUBLIC_OUTREACH_API_KEY || "bypass_key";
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const key = getApiKey();
    const headers = {
      "X-API-Key": key,
      "bypass-tunnel-reminder": "true",
      "Content-Type": "application/json",
      ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      setIsAuthenticated(false);
      setAuthError("Unauthorized action: Please enter the correct passcode to verify your session.");
    }
    return res;
  };

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
    } catch {
      setAuthError(`Network error. Failed to connect to server at ${API_BASE}.`);
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async () => {
    if (getApiKey() === "") {
      setIsAuthenticated(false);
      return;
    }

    try {
      setLoading(true);
      // 1. Fetch Stats
      const statsRes = await fetchWithAuth(`${API_BASE}/api/v1/telegram/stats`);
      if (statsRes.status === 401) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      const statsJson = await statsRes.json();
      if (statsJson.success) setStats(statsJson.data);

      // 2. Fetch Monitored Channels
      const monitoredRes = await fetchWithAuth(`${API_BASE}/api/v1/telegram/channels/monitored`);
      const monitoredJson = await monitoredRes.json();
      if (monitoredJson.success) setMonitoredChannels(monitoredJson.data);

      // 3. Fetch Raw Messages
      const messagesRes = await fetchWithAuth(`${API_BASE}/api/v1/telegram/messages?limit=100`);
      const messagesJson = await messagesRes.json();
      if (messagesJson.success) setMessages(messagesJson.data);

      setIsAuthenticated(true);
    } catch (err) {
      console.error("[Telegram Dashboard] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch joined channels (longer loading process, done on demand)
  const fetchJoinedChannels = async () => {
    if (!isAuthenticated) return;
    setLoadingJoined(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/telegram/channels/joined`);
      const json = await res.json();
      if (json.success) {
        setJoinedChannels(json.data);
      } else {
        alert("Failed to fetch joined channels: " + json.message);
      }
    } catch (err) {
      console.error(err);
      alert("Network error fetching joined channels.");
    } finally {
      setLoadingJoined(false);
    }
  };

  // Monitor a channel
  const handleAddMonitoredChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJoinedChannelId) {
      alert("Please select a channel to monitor.");
      return;
    }

    const channel = joinedChannels.find((c) => c.id === selectedJoinedChannelId);
    if (!channel) return;

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/telegram/channels/monitored`, {
        method: "POST",
        body: JSON.stringify({
          channelId: channel.id,
          title: channel.title,
          username: channel.username,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedJoinedChannelId("");
        loadAllData();
      } else {
        alert("Failed to monitor channel: " + json.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Stop monitoring a channel
  const handleRemoveMonitoredChannel = async (channelId: string) => {
    if (!confirm("Are you sure you want to stop monitoring this channel? New messages will not be ingested.")) return;

    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/telegram/channels/monitored/${channelId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        loadAllData();
      } else {
        alert("Failed to remove channel: " + json.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger historical import
  const handleTriggerHistoricalImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImportChannelId) {
      alert("Please select a monitored channel.");
      return;
    }
    if (!fromDate || !toDate) {
      alert("Please select both start and end dates.");
      return;
    }

    setLoadingHistory(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/telegram/import`, {
        method: "POST",
        body: JSON.stringify({
          channelId: selectedImportChannelId,
          fromDate,
          toDate,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Historical import started in background! Messages will appear in raw logs shortly.");
        setSelectedImportChannelId("");
        loadAllData();
      } else {
        alert("Failed to start import: " + json.message);
      }
    } catch (err) {
      console.error(err);
      alert("Network error initiating import.");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Reprocess failed messages
  const handleReprocessFailed = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/telegram/reprocess-failed`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        loadAllData();
      } else {
        alert("Failed to reprocess: " + json.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll stats and raw message log every 5 seconds to show live updates
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(async () => {
        try {
          const statsRes = await fetchWithAuth(`${API_BASE}/api/v1/telegram/stats`);
          const statsJson = await statsRes.json();
          if (statsJson.success) setStats(statsJson.data);

          const messagesRes = await fetchWithAuth(`${API_BASE}/api/v1/telegram/messages?limit=100`);
          const messagesJson = await messagesRes.json();
          if (messagesJson.success) setMessages(messagesJson.data);
        } catch (e) {
          console.error("Stats/messages live background poller failed:", e);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Joined channels that are not already monitored
  const unmonitoredJoinedChannels = useMemo(() => {
    return joinedChannels.filter(
      (jc) => !monitoredChannels.some((mc) => mc.channelId === jc.id)
    );
  }, [joinedChannels, monitoredChannels]);

  // Auth Screen Render (matches aesthetics of outreach auth)
  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-sans">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-xs text-muted-foreground font-mono">Verifying dashboard session…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-background p-6 font-sans">
        <div className="w-full max-w-sm border bg-card p-6 shadow-sm rounded-lg flex flex-col gap-5 animate-in fade-in duration-300">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center mb-3">
              <Lock className="w-4 h-4 text-muted-foreground" />
            </div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground font-sans">Admin Authentication</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Enter the admin passcode to access Telegram Ingestion controls.
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="passcode" className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Passcode
              </label>
              <input
                id="passcode"
                type="password"
                placeholder="••••••••••••"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs placeholder:text-muted-foreground/75 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors"
              />
            </div>
            
            {authError && (
              <div className="text-[11px] font-medium text-destructive flex items-center gap-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 py-2 transition-colors cursor-pointer"
            >
              {loading ? "Verifying..." : "Access Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard Main Render
  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-foreground" /> Telegram Ingestion Portal
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Automate job listings scraping using Telegram User sessions and structure postings using Gemini.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-3 py-2 gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Log
          </button>
          {stats.rejected > 0 && (
            <button
              onClick={handleReprocessFailed}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-3 py-2 gap-1.5 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              Reprocess Failed ({stats.rejected})
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="border border-border bg-card shadow-xs rounded-md p-4 flex flex-col gap-1">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">Total Ingested</span>
          <span className="text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums">{stats.total}</span>
          <span className="text-[10px] text-muted-foreground">Raw messages saved</span>
        </div>
        <div className="border border-border bg-card shadow-xs rounded-md p-4 flex flex-col gap-1 border-l-amber-500 border-l-2">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">Unprocessed</span>
          <span className="text-2xl font-bold tracking-tight text-amber-600 font-mono tabular-nums">{stats.unprocessed}</span>
          <span className="text-[10px] text-muted-foreground">Waiting in extraction queue</span>
        </div>
        <div className="border border-border bg-card shadow-xs rounded-md p-4 flex flex-col gap-1 border-l-emerald-500 border-l-2">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">Processed</span>
          <span className="text-2xl font-bold tracking-tight text-emerald-600 font-mono tabular-nums">{stats.processed}</span>
          <span className="text-[10px] text-muted-foreground">Successfully parsed as jobs</span>
        </div>
        <div className="border border-border bg-card shadow-xs rounded-md p-4 flex flex-col gap-1 border-l-red-500 border-l-2">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">Rejected</span>
          <span className="text-2xl font-bold tracking-tight text-red-600 font-mono tabular-nums">{stats.rejected}</span>
          <span className="text-[10px] text-muted-foreground">Missing role, company, or link</span>
        </div>
        <div className="border border-border bg-card shadow-xs rounded-md p-4 flex flex-col gap-1 border-l-zinc-500 border-l-2 col-span-2 md:col-span-1">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">Skipped</span>
          <span className="text-2xl font-bold tracking-tight text-zinc-600 font-mono tabular-nums">{stats.skipped}</span>
          <span className="text-[10px] text-muted-foreground">Deduplicated messages</span>
        </div>
      </div>

      {/* Main Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Monitored Channels Panel */}
        <div className="lg:col-span-2 border border-border bg-card shadow-xs rounded-md p-5 flex flex-col gap-5">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" /> Monitored Channels & Groups
            </h2>
            <span className="text-[10px] font-mono font-semibold bg-secondary text-foreground px-2 py-0.5 rounded-full border border-border">
              {monitoredChannels.length} active
            </span>
          </div>

          {/* Add Channel Form */}
          <div className="bg-secondary/40 border border-border rounded-md p-4">
            <h3 className="text-xs font-semibold text-foreground mb-2">Configure Channel to Monitor</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              {joinedChannels.length === 0 ? (
                <button
                  onClick={fetchJoinedChannels}
                  disabled={loadingJoined}
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground h-9 px-4 py-2 w-full sm:w-auto transition-colors cursor-pointer"
                >
                  {loadingJoined ? "Syncing Joined Channels..." : "Load Joined Channels from Telegram"}
                </button>
              ) : (
                <form onSubmit={handleAddMonitoredChannel} className="flex flex-col sm:flex-row gap-3 w-full">
                  <select
                    value={selectedJoinedChannelId}
                    onChange={(e) => setSelectedJoinedChannelId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors"
                  >
                    <option value="">-- Choose Joined Channel/Group ({unmonitoredJoinedChannels.length} available) --</option>
                    {unmonitoredJoinedChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} {c.username ? `@${c.username}` : `[ID: ${c.id}]`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={loading || !selectedJoinedChannelId}
                    className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 py-2 shrink-0 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Monitor
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Channels List */}
          {monitoredChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 bg-secondary/10 border border-dashed rounded-md p-6">
              <Inbox className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs font-semibold text-foreground">No monitored channels</p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[280px]">
                Click &quot;Load Joined Channels&quot; and select a group/channel to begin real-time message ingestion.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">ID</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoredChannels.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{c.title}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {c.username ? (
                          <a
                            href={`https://t.me/${c.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-mono"
                          >
                            @{c.username}
                          </a>
                        ) : (
                          <span className="italic text-[11px]">Private Group</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-muted-foreground">{c.channelId}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleRemoveMonitoredChannel(c.channelId)}
                          disabled={loading}
                          className="inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 transition-colors cursor-pointer"
                          title="Stop Monitoring"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Historical Import Form Panel */}
        <div className="border border-border bg-card shadow-xs rounded-md p-5 flex flex-col gap-5">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" /> Historical Import
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1">
              Manually crawl and process older messages from a channel database.
            </p>
          </div>

          <form onSubmit={handleTriggerHistoricalImport} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Monitored Channel</label>
              <select
                value={selectedImportChannelId}
                onChange={(e) => setSelectedImportChannelId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors"
              >
                <option value="">-- Select Channel --</option>
                {monitoredChannels.map((c) => (
                  <option key={c.id} value={c.channelId}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus:border-black transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingHistory || !selectedImportChannelId}
              className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 h-9 px-4 py-2 mt-1 gap-1.5 w-full disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loadingHistory ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Initiating Import...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Trigger Import Crawl
                </>
              )}
            </button>
          </form>

          <div className="text-[11px] text-muted-foreground border-t border-border pt-4 flex flex-col gap-1.5 font-sans">
            <div className="font-semibold text-foreground text-xs">Import Architecture:</div>
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span>GramJS Fetch</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span>Raw Messages</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span>BullMQ Ingest</span>
            </div>
            <p className="mt-1 text-[10px] leading-normal text-muted-foreground">
              Ingested messages are processed sequentially by Gemini 2.5 Flash. Processing takes ~2-3 seconds per message.
            </p>
          </div>
        </div>

      </div>

      {/* Raw Messages log */}
      <div className="border border-border bg-card shadow-xs rounded-md p-5 flex flex-col gap-4">
        <div className="border-b border-border pb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" /> Live Raw Message Log
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Displaying the 100 most recent Telegram messages ingested.
          </p>
        </div>

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 bg-secondary/10 border border-dashed rounded-md p-6">
            <Inbox className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-semibold text-foreground">No ingested messages found</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Start monitoring channels or trigger a historical import to observe incoming traffic.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-border rounded-md">
            <table className="w-full border-collapse text-left text-xs font-sans">
              <thead className="sticky top-0 bg-card border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground z-10">
                <tr className="bg-muted/30">
                  <th className="py-2.5 px-4 w-1/5">Channel</th>
                  <th className="py-2.5 px-4 w-2/5">Message Text</th>
                  <th className="py-2.5 px-4 w-1/5">Ingested / Posted</th>
                  <th className="py-2.5 px-4 w-1/10">Status</th>
                  <th className="py-2.5 px-4 w-1/10">Result Details</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => {
                  let statusColor = "bg-secondary text-foreground border border-border";
                  let statusIcon = null;

                  if (m.status === "UNPROCESSED") {
                    statusColor = "bg-amber-500/10 text-amber-600 border border-amber-500/20";
                  } else if (m.status === "PROCESSED") {
                    statusColor = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
                    statusIcon = <CheckCircle className="w-3 h-3 inline mr-1 shrink-0" />;
                  } else if (m.status === "REJECTED") {
                    statusColor = "bg-red-500/10 text-red-600 border border-red-500/20";
                    statusIcon = <XCircle className="w-3 h-3 inline mr-1 shrink-0" />;
                  } else if (m.status === "SKIPPED_DUPLICATE") {
                    statusColor = "bg-zinc-500/10 text-zinc-600 border border-zinc-500/20";
                  }

                  return (
                    <tr key={m.id} className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground align-top">{m.channelName}</td>
                      <td className="py-3 px-4 align-top">
                        <div className="max-h-[100px] overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all bg-secondary/30 p-2 rounded border border-border text-muted-foreground">
                          {m.messageText}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top text-xs text-muted-foreground">
                        <div>Posted: <span className="font-mono">{new Date(m.postedAt).toLocaleString()}</span></div>
                        <div className="mt-1">Saved: <span className="font-mono">{new Date(m.createdAt).toLocaleString()}</span></div>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono font-semibold uppercase ${statusColor}`}>
                          {statusIcon}
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top text-xs">
                        {m.errorMessage ? (
                          <span className="text-red-600 flex items-start gap-1 font-mono text-[10px] bg-red-500/10 border border-red-500/20 p-1.5 rounded bg-clip-border">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{m.errorMessage}</span>
                          </span>
                        ) : m.status === "PROCESSED" ? (
                          <span className="text-emerald-600 font-semibold text-[11px]">Job Saved</span>
                        ) : m.status === "SKIPPED_DUPLICATE" ? (
                          <span className="text-zinc-500 italic text-[11px]">Deduplicated</span>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">Pending Queue</span>
                        )}
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
  );
}
