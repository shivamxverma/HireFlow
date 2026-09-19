"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Menu } from "lucide-react";
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

  const coreLinks = [
    { name: "Discover", href: "/", icon: Compass },
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
            
          </div>
        </div>

        <div className="flex items-center gap-2 p-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-black font-semibold text-xs shadow-xs border border-neutral-800 dark:border-neutral-200">
            {getInitials("Shivam Verma")}
          </div>
          <span className="text-xs font-semibold hidden sm:inline-block text-foreground">Shivam</span>
        </div>
      </div>
    </nav>
  );
}
