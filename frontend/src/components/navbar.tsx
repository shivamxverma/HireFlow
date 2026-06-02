"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, ListChecks, Target, Mail, Linkedin, Megaphone, LogOut, MessageSquare, User, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const [session, setSession] = useState<{
    authenticated: boolean;
    user: { name: string; email: string; avatar?: string } | null;
  }>({
    authenticated: false,
    user: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      const json = await res.json();
      if (json.success) {
        setSession({
          authenticated: json.authenticated,
          user: json.user,
        });
      }
    } catch (err) {
      console.error("[Navbar Session Fetch Failed]", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [pathname]); // Refresh session status on path change

  const handleSignOut = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        localStorage.removeItem("outreach_api_key"); // clear cache key
        setSession({ authenticated: false, user: null });
        router.refresh();
        router.push("/");
      }
    } catch (err) {
      console.error("[Navbar Sign Out Failed]", err);
    } finally {
      setLoading(false);
    }
  };

  const coreLinks = [
    { name: "Explore", href: "/", icon: Compass },
    { name: "Tracker", href: "/tracker", icon: Target },
    { name: "Auto-Apply", href: "/queue", icon: ListChecks },
  ];

  const channelsLinks = [
    { name: "Outreach", href: "/outreach", icon: Megaphone },
    { name: "Gmail", href: "/gmail", icon: Mail },
    { name: "Telegram", href: "/telegram", icon: MessageSquare },
    { name: "LinkedIn", href: "/linkedin", icon: Linkedin },
  ];

  // Helper to extract initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-6">
          {/* Mobile Navigation Menu */}
          <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-secondary/60 transition-colors cursor-pointer focus:outline-hidden animate-fade-in">
                  <Menu className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 mt-2 p-1 border-border shadow-md">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
                  Dashboard
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/60 my-1" />
                
                {coreLinks.map((link) => {
                  const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                  return (
                    <DropdownMenuItem key={link.name} asChild className={`text-xs cursor-pointer ${isActive ? "bg-secondary font-medium" : ""}`}>
                      <Link href={link.href}>
                        <link.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{link.name}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                
                <DropdownMenuSeparator className="bg-border/60 my-1" />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
                  Outreach Channels
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/60 my-1" />
                
                {channelsLinks.map((link) => {
                  const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
                  return (
                    <DropdownMenuItem key={link.name} asChild className={`text-xs cursor-pointer ${isActive ? "bg-secondary font-medium" : ""}`}>
                      <Link href={link.href}>
                        <link.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{link.name}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-950 text-white dark:bg-neutral-50 dark:text-black font-black text-[13px] tracking-tighter shadow-xs border border-neutral-800 dark:border-neutral-200">
              H
            </div>
            <span className="font-extrabold text-sm tracking-tight text-foreground">
              HireFlow
            </span>
          </Link>
          
          {/* Segmented Tab Navigation for Desktop */}
          <div className="hidden lg:flex items-center gap-1 bg-secondary/60 dark:bg-secondary/40 p-1 rounded-lg border border-border/30">
            {/* Core Links */}
            {coreLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-1 text-[11px] font-medium transition-all rounded-md flex items-center gap-1.5 ${
                    isActive
                      ? "bg-background text-foreground shadow-xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  <link.icon className={`w-3.5 h-3.5 ${isActive ? "text-foreground" : "text-muted-foreground/85"}`} aria-hidden="true" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
            
            {/* Elegant thin vertical divider */}
            <div className="h-4 w-px bg-border/80 mx-1" />
            
            {/* Channel Links */}
            {channelsLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-1 text-[11px] font-medium transition-all rounded-md flex items-center gap-1.5 ${
                    isActive
                      ? "bg-background text-foreground shadow-xs border border-border/80"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  <link.icon className={`w-3.5 h-3.5 ${isActive ? "text-foreground" : "text-muted-foreground/85"}`} aria-hidden="true" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* User Authentication Status Section */}
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          ) : session.authenticated && session.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1.5 hover:bg-secondary/70 rounded-lg transition-colors cursor-pointer focus:outline-hidden">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-semibold text-xs shadow-xs border border-neutral-800 dark:border-neutral-200">
                    {getInitials(session.user.name)}
                  </div>
                  <span className="text-xs font-semibold hidden sm:inline-block text-foreground">
                    {session.user.name.split(" ")[0]}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-1 border-border p-1.5 shadow-md">
                <DropdownMenuLabel className="font-normal px-2 py-1.5">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-medium text-foreground leading-none">{session.user.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-none">{session.user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/60 my-1" />
                <DropdownMenuItem asChild className="text-xs cursor-pointer">
                  <Link href="/settings/profile">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>View Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-xs cursor-pointer">
                  <Link href="/tracker">
                    <Target className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Outreach Tracker</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/60 my-1" />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm text-destructive hover:bg-destructive/10 cursor-pointer focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <button className="inline-flex items-center justify-center rounded-lg bg-foreground text-background px-4 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs">
                Sign In
              </button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
