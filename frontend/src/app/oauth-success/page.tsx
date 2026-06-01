"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function OAuthSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying secure OAuth credentials...");

  useEffect(() => {
    async function completeOAuth() {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setMessage("Authentication failed: Access token missing.");
        return;
      }

      try {
        // 1. Retrieve user profile details from the Express backend using the JWT token
        const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
        const meRes = await fetch(`${BACKEND_API}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!meRes.ok) {
          throw new Error("Failed to load user profile from authentication server.");
        }

        const meData = await meRes.json();
        if (!meData.success || !meData.data?.user) {
          throw new Error(meData.message || "Invalid session response from backend.");
        }

        const backendUser = meData.data.user;

        // 2. Synchronize session with Next.js Edge Middleware & state via local api/auth/login
        const syncRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "google",
            token,
            user: backendUser,
          }),
        });

        const syncData = await syncRes.json();

        if (syncRes.ok && syncData.success) {
          // 3. Keep full compatibility with automated email/outreach scripts by setting outreach_api_key in localStorage
          localStorage.setItem("outreach_api_key", token);
          
          setStatus("success");
          setMessage("Secure session synchronized successfully! Redirecting...");
          
          setTimeout(() => {
            router.refresh();
            router.push("/");
          }, 1500);
        } else {
          throw new Error(syncData.message || "Failed to establish Next.js session.");
        }
      } catch (err: unknown) {
        console.error("[OAuth Success Sync Error]", err);
        setStatus("error");
        const errMsg = err instanceof Error ? err.message : "A secure connection could not be established with the server.";
        setMessage(errMsg);
      }
    }

    completeOAuth();
  }, [router, searchParams]);

  return (
    <div className="success-wrapper">
      <div className="bg-glow bg-glow-primary" />
      <div className="bg-glow bg-glow-secondary" />

      <div className="glass-card">
        <div className="icon-container">
          {status === "verifying" && (
            <div className="spinner" aria-label="Loading" />
          )}
          {status === "success" && (
            <div className="checkmark" aria-label="Success">✓</div>
          )}
          {status === "error" && (
            <div className="error-icon" aria-label="Error">✕</div>
          )}
        </div>

        <h2>
          {status === "verifying" && "Security Verification"}
          {status === "success" && "Welcome Back!"}
          {status === "error" && "Authentication Error"}
        </h2>
        
        <p className={`message ${status}`}>{message}</p>

        {status === "error" && (
          <button onClick={() => router.push("/login")} className="btn-retry">
            Return to Login
          </button>
        )}
      </div>

      <style jsx>{`
        .success-wrapper {
          min-height: 80vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: linear-gradient(135deg, #090d16 0%, #0d1222 50%, #17112a 100%);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          overflow: hidden;
          padding: 2rem 1.5rem;
        }

        .bg-glow {
          position: absolute;
          width: min(600px, 90vw);
          height: min(600px, 90vw);
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.12;
          z-index: 1;
          pointer-events: none;
        }

        .bg-glow-primary {
          background: radial-gradient(circle, #6366f1 0%, rgba(99, 102, 241, 0) 70%);
          top: -20%;
          left: -10%;
        }

        .bg-glow-secondary {
          background: radial-gradient(circle, #a855f7 0%, rgba(168, 85, 247, 0) 70%);
          bottom: -20%;
          right: -10%;
        }

        .glass-card {
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 28px;
          padding: 3rem 2rem;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.1);
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          text-align: center;
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .icon-container {
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 3.5px solid rgba(99, 102, 241, 0.15);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .checkmark {
          width: 56px;
          height: 56px;
          background: rgba(34, 197, 94, 0.15);
          border: 1.5px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.8rem;
          font-weight: bold;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.25);
          animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        .error-icon {
          width: 56px;
          height: 56px;
          background: rgba(239, 68, 68, 0.15);
          border: 1.5px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
          font-weight: bold;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.25);
          animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        @keyframes pop {
          from { transform: scale(0.6); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.01em;
        }

        .message {
          font-size: 0.95rem;
          line-height: 1.5;
          margin: 0;
        }

        .message.verifying { color: #94a3b8; }
        .message.success { color: #4ade80; font-weight: 500; }
        .message.error { color: #f87171; }

        .btn-retry {
          width: 100%;
          padding: 0.75rem;
          background: #312e81;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-retry:hover {
          background: #3730a3;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}

export default function OAuthSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", backgroundColor: "#090d16" }}>
        <div style={{ width: "30px", height: "30px", border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    }>
      <OAuthSuccessContent />
    </Suspense>
  );
}
