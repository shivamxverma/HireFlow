import * as yup from "yup";
import { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";

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
 * Input validation middleware
 */
export const validate = (location: 'query' | 'body' | 'params', schema: yup.ObjectSchema<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = await schema.validate(req[location], { abortEarly: false });
      Object.assign(req[location], validatedData);
      next();
    } catch (error: any) {
      if (error && error.name === "ValidationError") {
        return res.status(400).json({ error: error.errors?.join(', ') || error.message });
      }
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };
};

/**
 * Express middleware to enforce authentication.
 * Bypass mode active, inserts default-user profile if missing.
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  console.log(`[Auth Middleware] requireAuth hit for: ${req.method} ${req.url} - AUTH BYPASSED`);

  req.user = {
    id: "default-user",
    email: "shivam@example.com",
    displayName: "Shivam Verma",
    role: "ADMIN",
    avatarUrl: null,
  };

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
 * Express middleware to enforce API Key verification specifically for automated processes.
 * Bypassed for end-to-end authentication removal.
 */
export const requireSendAuth = (req: Request, res: Response, next: NextFunction): void => {
  console.log(`[Auth Middleware] requireSendAuth hit for: ${req.method} ${req.url} - BYPASSED`);
  next();
};
