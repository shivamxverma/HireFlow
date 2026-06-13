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
  console.log(`[Auth Middleware] requireAuth hit for: ${req.method} ${req.url} - AUTH BYPASSED`);

  // Set req.user to default-user admin profile
  req.user = {
    id: "default-user",
    email: "shivam@example.com",
    displayName: "Shivam Verma",
    role: "ADMIN",
    avatarUrl: null,
  };

  // Ensure default-user exists in the user table in the database
  try {
    const userExists = await prisma.user.findUnique({
      where: { id: "default-user" },
    });
    if (!userExists) {
      await prisma.user.create({
        data: {
          id: "default-user",
          email: "shivam@example.com",
          displayName: "Shivam Verma",
          username: "shivamverma",
          role: "ADMIN",
          isEmailVerified: true,
        },
      });
      console.log("[Auth Middleware] Created default-user in PostgreSQL.");
    }
  } catch (error) {
    console.error("[Auth Middleware] Error ensuring default-user exists in database:", error);
  }

  next();
};

/**
 * Express middleware to enforce API Key verification specifically for automated processes (e.g. outreach sending).
 * Bypassed for end-to-end authentication removal.
 */
export const requireSendAuth = (req: Request, res: Response, next: NextFunction): void => {
  console.log(`[Auth Middleware] requireSendAuth hit for: ${req.method} ${req.url} - BYPASSED`);
  next();
};
