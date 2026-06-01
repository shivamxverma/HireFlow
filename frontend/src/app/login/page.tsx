"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, UserPlus, CheckCircle2, ArrowRight } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Dynamic document title
  useEffect(() => {
    document.title = isSignUp ? "Create Account | HireFlow" : "Sign In | HireFlow";
  }, [isSignUp]);

  // If already authenticated, redirect home
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const json = await res.json();
        if (json.authenticated) {
          router.replace(callbackUrl);
        }
      } catch (err) {
        console.error("Session check failed", err);
      }
    }
    checkSession();
  }, [router, callbackUrl]);

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setLoading(provider);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        if (json.data?.redirectUrl) {
          window.location.href = json.data.redirectUrl;
          return;
        }

        // Fetch session tokens and cache key in local storage to preserve compatibility with outreach routes
        localStorage.setItem("outreach_api_key", json.data.user.sessionToken);
        
        // Dynamic push callback
        router.refresh();
        router.push(callbackUrl);
      } else {
        setError(json.message || "Failed to log in via OAuth.");
        setLoading(null);
      }
    } catch (err) {
      console.error(err);
      setError("Network error connecting to auth server.");
      setLoading(null);
    }
  };

  return (
    <div className="login-wrapper">
      {/* Floating Ambient Background Blobs */}
      <div className="bg-blob bg-blob-terracotta" />
      <div className="bg-blob bg-blob-gold" />
      <div className="bg-blob bg-blob-accent" />

      <div className="glass-card">
        {/* Tab Switcher */}
        <div className="tab-container" role="tablist">
          <button
            className={`tab-btn ${!isSignUp ? "active" : ""}`}
            onClick={() => setIsSignUp(false)}
            role="tab"
            aria-selected={!isSignUp}
          >
            Sign In
          </button>
          <button
            className={`tab-btn ${isSignUp ? "active" : ""}`}
            onClick={() => setIsSignUp(true)}
            role="tab"
            aria-selected={isSignUp}
          >
            Create Account
          </button>
        </div>

        <header className="glass-card-header">
          <div className="portal-icon-wrapper" aria-hidden="true">
            {isSignUp ? (
              <UserPlus className="portal-icon icon-signup" />
            ) : (
              <KeyRound className="portal-icon icon-signin" />
            )}
          </div>
          <h2>{isSignUp ? "Join HireFlow" : "Welcome Back"}</h2>
          <p className="subtitle">
            {isSignUp
              ? "Get started with HireFlow. Track your job applications, automate recruiter follow-ups, and land your next role."
              : "Sign in to access your saved job tracking, resume matches, and automated outreach tools."}
          </p>
        </header>

        {error && <div className="error-alert">⚠️ {error}</div>}

        {/* Value Proposition List for Sign Up */}
        {isSignUp && (
          <div className="value-prop-list">
            <div className="value-prop-item">
              <CheckCircle2 className="check-icon" />
              <span>Automated job outreach (LinkedIn & Gmail)</span>
            </div>
            <div className="value-prop-item">
              <CheckCircle2 className="check-icon" />
              <span>Kanban board applicant tracking system</span>
            </div>
            <div className="value-prop-item">
              <CheckCircle2 className="check-icon" />
              <span>AI-powered email & DM template generator</span>
            </div>
          </div>
        )}

        <div className="action-buttons">
          <button
            onClick={() => handleOAuthLogin("google")}
            disabled={loading !== null}
            className={`auth-btn btn-google ${loading === "google" ? "btn-loading" : ""}`}
            aria-label={isSignUp ? "Sign up with Google" : "Sign in with Google"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.86-4.53-6.16-4.53z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>{loading === "google" ? "Verifying..." : `${isSignUp ? "Sign Up" : "Continue"} with Google`}</span>
            <ArrowRight className="btn-arrow" />
          </button>

          <button
            onClick={() => handleOAuthLogin("github")}
            disabled={loading !== null}
            className={`auth-btn btn-github ${loading === "github" ? "btn-loading" : ""}`}
            aria-label={isSignUp ? "Sign up with GitHub" : "Sign in with GitHub"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
            </svg>
            <span>{loading === "github" ? "Verifying..." : `${isSignUp ? "Sign Up" : "Continue"} with GitHub`}</span>
            <ArrowRight className="btn-arrow" />
          </button>
        </div>

        <footer className="card-footer">
          <p>
            By continuing, you authorize access token caching. The explore listings are always free.
          </p>
        </footer>
      </div>

      <style jsx>{`
        .login-wrapper {
          min-height: 88vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background-color: #f7f4ed; /* Warm cream background */
          font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
          overflow: hidden;
          padding: 2.5rem 1.5rem;
        }

        /* Animated Ambient Background Blobs */
        .bg-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.22;
          z-index: 1;
          pointer-events: none;
        }

        .bg-blob-terracotta {
          background: #b65f2a; /* Terracotta Primary */
          width: 450px;
          height: 450px;
          top: -10%;
          left: -5%;
          animation: float1 18s ease-in-out infinite alternate;
        }

        .bg-blob-gold {
          background: #d97706; /* Warm Gold */
          width: 500px;
          height: 500px;
          bottom: -15%;
          right: -5%;
          animation: float2 22s ease-in-out infinite alternate;
        }

        .bg-blob-accent {
          background: #a855f7;
          width: 300px;
          height: 300px;
          top: 35%;
          right: 25%;
          opacity: 0.08;
          animation: float1 25s ease-in-out infinite alternate-reverse;
        }

        @keyframes float1 {
          0% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(40px, 60px) scale(1.15);
          }
          100% {
            transform: translate(-20px, -40px) scale(0.9);
          }
        }

        @keyframes float2 {
          0% {
            transform: translate(0, 0) scale(1.1);
          }
          50% {
            transform: translate(-50px, -70px) scale(0.9);
          }
          100% {
            transform: translate(30px, 30px) scale(1.05);
          }
        }

        .glass-card {
          width: 100%;
          max-width: 460px;
          background: rgba(255, 253, 248, 0.65);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(182, 95, 42, 0.12); /* Rust-tinted thin border */
          border-radius: 32px;
          padding: 2.75rem 2.5rem;
          box-shadow: 0 30px 70px rgba(42, 27, 10, 0.07), 
                      inset 0 1px 0 rgba(255, 255, 255, 0.6);
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 1.85rem;
          animation: slideUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(35px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Tab Switcher */
        .tab-container {
          display: flex;
          background: rgba(49, 37, 24, 0.05);
          padding: 4px;
          border-radius: 16px;
          border: 1px solid rgba(49, 37, 24, 0.03);
        }

        .tab-btn {
          flex: 1;
          padding: 0.65rem;
          border: none;
          background: transparent;
          border-radius: 12px;
          font-size: 0.88rem;
          font-weight: 600;
          color: #766858;
          cursor: pointer;
          transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tab-btn:hover {
          color: #21170f;
        }

        .tab-btn.active {
          background: #ffffff;
          color: #21170f;
          box-shadow: 0 4px 12px rgba(42, 27, 10, 0.08);
        }

        .glass-card-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.65rem;
        }

        .portal-icon-wrapper {
          width: 60px;
          height: 60px;
          border-radius: 18px;
          background: rgba(182, 95, 42, 0.07);
          border: 1px solid rgba(182, 95, 42, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.4rem;
        }

        :global(.portal-icon) {
          width: 26px;
          height: 26px;
          color: #b65f2a; /* Rust */
        }

        :global(.icon-signup) {
          animation: pulseScale 2.5s infinite alternate;
        }

        :global(.icon-signin) {
          animation: rotateLock 3s infinite alternate;
        }

        @keyframes pulseScale {
          0% { transform: scale(0.94); }
          100% { transform: scale(1.06); }
        }

        @keyframes rotateLock {
          0% { transform: rotate(-5deg); }
          100% { transform: rotate(5deg); }
        }

        .glass-card-header h2 {
          font-size: 1.6rem;
          font-weight: 800;
          color: #21170f;
          margin: 0;
          letter-spacing: -0.025em;
        }

        .subtitle {
          font-size: 0.88rem;
          color: #766858;
          line-height: 1.5;
          margin: 0;
        }

        .error-alert {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.15);
          color: #dc2626;
          font-size: 0.85rem;
          padding: 0.75rem 1rem;
          border-radius: 14px;
          text-align: center;
          font-weight: 600;
        }

        /* Value Propositions */
        .value-prop-list {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          background: rgba(182, 95, 42, 0.03);
          border: 1px dashed rgba(182, 95, 42, 0.15);
          border-radius: 18px;
          padding: 1.1rem 1.25rem;
          animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .value-prop-item {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          font-size: 0.82rem;
          color: #21170f;
          font-weight: 550;
        }

        :global(.check-icon) {
          width: 16px;
          height: 16px;
          color: #b65f2a;
          flex-shrink: 0;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .auth-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1.25rem;
          border-radius: 16px;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid transparent;
        }

        .btn-google {
          background: #ffffff;
          color: #21170f;
          border: 1px solid rgba(49, 37, 24, 0.1);
          box-shadow: 0 2px 4px rgba(42, 27, 10, 0.02);
        }

        .btn-google:hover {
          background: #fdfcf9;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(42, 27, 10, 0.06);
          border-color: rgba(182, 95, 42, 0.25);
        }

        .btn-github {
          background: #21170f; /* Dark brown/black matching the brand */
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(33, 23, 15, 0.15);
        }

        .btn-github:hover {
          background: #352518;
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(33, 23, 15, 0.25);
        }

        .btn-loading {
          opacity: 0.65;
          cursor: not-allowed;
          pointer-events: none;
        }

        :global(.btn-arrow) {
          width: 16px;
          height: 16px;
          opacity: 0;
          transform: translateX(-6px);
          transition: all 250ms ease;
        }

        .auth-btn:hover :global(.btn-arrow) {
          opacity: 1;
          transform: translateX(0);
        }

        .card-footer {
          text-align: center;
          border-top: 1px solid rgba(49, 37, 24, 0.08);
          padding-top: 1.1rem;
        }

        .card-footer p {
          font-size: 0.75rem;
          color: #8c7d70;
          line-height: 1.5;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "88vh", backgroundColor: "#f7f4ed" }}>
        <div style={{ width: "32px", height: "32px", border: "3px solid #b65f2a", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1.2s linear infinite" }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

