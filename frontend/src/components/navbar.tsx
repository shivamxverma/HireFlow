"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, ListChecks, Target, Mail, Linkedin, Megaphone, LogOut, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  const navLinks = [
    { name: "Explore", href: "/", icon: Compass },
    { name: "Telegram", href: "/telegram", icon: MessageSquare },
    { name: "Auto-Apply Queue", href: "/queue", icon: ListChecks },
    { name: "Tracker", href: "/tracker", icon: Target },
    { name: "Outreach", href: "/outreach", icon: Megaphone },
    { name: "Gmail", href: "/gmail", icon: Mail },
    { name: "LinkedIn", href: "/linkedin", icon: Linkedin },
    { name: "Profile", href: "/settings/profile", icon: User },
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
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-extrabold text-base tracking-tight text-foreground flex items-center gap-1.5">
            <span className="h-5 w-5 bg-foreground text-background flex items-center justify-center font-black rounded-sm text-xs leading-none">H</span>
            <span>HireFlow</span>
          </Link>
          
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-md flex items-center gap-2 ${
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  <link.icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {link.name}
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
            <div className="flex items-center gap-3">
              <Link href="/settings/profile" className="flex items-center gap-2 hover:opacity-85 transition-opacity">
                <div 
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary border border-border text-foreground font-semibold text-xs"
                  title={`${session.user.name} (${session.user.email})`}
                >
                  {getInitials(session.user.name)}
                </div>
                <span className="text-xs font-medium hidden sm:inline-block text-muted-foreground">
                  {session.user.name.split(" ")[0]}
                </span>
              </Link>
              <button 
                onClick={handleSignOut} 
                className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          ) : (
            <Link href="/login">
              <button className="inline-flex items-center justify-center rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-medium hover:bg-foreground/90 transition-colors cursor-pointer">
                Sign In
              </button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
