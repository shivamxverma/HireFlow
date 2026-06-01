import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { verifyAccessToken } from "../shared/jwt.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string | null;
    displayName: string | null;
    role: string;
    avatarUrl: string | null;
  } | null;
}

/**
 * Express middleware to enforce authentication.
 * Checks for:
 * 1. Bearer JWT token in standard Authorization header.
 * 2. Static OUTREACH_API_KEY in X-API-Key or Authorization headers.
 * 3. Secure HTTP-Only JWT token in req.cookies.token.
 * 4. High-fidelity oauth-mock-session-token for dev workflows.
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  console.log(`[Auth Middleware] requireAuth hit for: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS" || req.path === "/api/auth/callback/google") {
    next();
    return;
  }

  // 1. Extract token from Header, X-API-Key, or HTTP-Only cookie
  const authHeader = req.headers["authorization"]?.toString();
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
  const tokenFromApiKey = req.headers["x-api-key"]?.toString();
  const tokenFromCookie = req.cookies?.token;

  const token = tokenFromHeader || tokenFromApiKey || tokenFromCookie;
  const expectedKey = process.env.OUTREACH_API_KEY;

  // 2. Validate against legacy/admin API Key
  const isValidApiKey = typeof token === "string" && expectedKey && token === expectedKey;
  if (isValidApiKey) {
    req.user = {
      id: "admin-api-key",
      email: "admin@jobscraper.internal",
      displayName: "Admin API Key User",
      role: "ADMIN",
      avatarUrl: null,
    };
    next();
    return;
  }

  // 3. Validate against mock session token
  const isValidOAuthSession = typeof token === "string" && token.startsWith("oauth-mock-session-token-");
  if (isValidOAuthSession) {
    req.user = {
      id: "mock-user-id",
      email: "shivam@example.com",
      displayName: "Shivam Verma",
      role: "USER",
      avatarUrl: null,
    };
    next();
    return;
  }

  // 4. Validate JWT Token
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      
      // Look up user in PostgreSQL
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (user) {
        if (user.isBanned) {
          res.status(403).json({
            success: false,
            message: "Access Denied: Your account has been suspended.",
          });
          return;
        }

        req.user = {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          avatarUrl: user.avatarUrl,
        };
        next();
        return;
      }
    } catch (err) {
      console.warn("[Auth Middleware] Invalid JWT token parsed:", err instanceof Error ? err.message : String(err));
    }
  }

  console.warn(`[Auth Middleware] Unauthorized access attempt blocked from IP: ${req.ip} on ${req.method} ${req.url}`);
  res.status(401).json({
    success: false,
    message: "Unauthorized: Please log in using Google or GitHub to access this feature.",
  });
};

/**
 * Express middleware to enforce API Key verification specifically for automated processes (e.g. outreach sending).
 */
export const requireSendAuth = (req: Request, res: Response, next: NextFunction): void => {
  console.log(`[Auth Middleware] requireSendAuth hit for: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.toString().split(" ")[1];
  const expectedKey = process.env.OUTREACH_API_KEY;

  if (!expectedKey) {
    console.error("[Auth Middleware] Critical Configuration Error: OUTREACH_API_KEY is not set in backend .env.");
    res.status(500).json({
      success: false,
      message: "Security Error: OUTREACH_API_KEY is not configured on the server. Please set it in your environment variables.",
    });
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    console.warn(`[Auth Middleware] Unauthorized email sending attempt blocked from IP: ${req.ip} on ${req.method} ${req.url}`);
    res.status(401).json({
      success: false,
      message: "Unauthorized: Invalid or missing API key.",
    });
    return;
  }

  next();
};
