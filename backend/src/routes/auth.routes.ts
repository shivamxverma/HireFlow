import { Router, Request, Response, NextFunction } from "express";
import bcryptjs from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../services/prisma.js";
import { generateTokenPair, jwtCookieOptions } from "../shared/jwt.js";
import { requireAuth, AuthenticatedRequest } from "./auth.middleware.js";

const router = Router();

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "hireflow_jwt_access_secret_2026_x18";

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback/google"
);

// Helper to validate origin is allowed (localhost, internal IPs, vercel apps, etc.)
const isAllowedOrigin = (origin: string): boolean => {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".vercel.app") ||
      url.hostname.endsWith(".github.dev")
    );
  } catch {
    return false;
  }
};

/**
 * POST /api/v1/auth/register
 * Register a new user using Email & Password.
 */
router.post("/register", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, username, displayName } = req.body;

    if (!email || !password || !username) {
      res.status(400).json({ success: false, message: "Email, password, and username are required." });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: "A user with this email or username already exists.",
      });
      return;
    }

    // Hash the password securely
    const saltRounds = 10;
    const passwordHash = await bcryptjs.hash(password, saltRounds);

    // Create the User and AuthMethod records in an atomic transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          username,
          displayName: displayName || username,
          role: "USER",
          isEmailVerified: false,
        },
      });

      await tx.authMethod.create({
        data: {
          userId: createdUser.id,
          provider: "EMAIL_PASSWORD",
          email,
          passwordHash,
        },
      });

      return createdUser;
    });

    res.status(201).json({
      success: true,
      message: "Registration completed successfully.",
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          displayName: newUser.displayName,
          role: newUser.role,
        },
      },
    });
  } catch (error) {
    console.error("[Auth Register Error]", error);
    res.status(500).json({ success: false, message: "Internal server error during registration." });
  }
});

/**
 * POST /api/v1/auth/login
 * Log in using Email & Password credentials.
 */
router.post("/login", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and password are required." });
      return;
    }

    // Locate the user record
    const userRecord = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username: email }],
      },
    });

    if (!userRecord) {
      res.status(401).json({ success: false, message: "Invalid email or password." });
      return;
    }

    // Find the email/password auth method
    const authMethodRecord = await prisma.authMethod.findUnique({
      where: { userId: userRecord.id },
    });

    if (!authMethodRecord || authMethodRecord.provider !== "EMAIL_PASSWORD" || !authMethodRecord.passwordHash) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials or authentication method.",
      });
      return;
    }

    // Match password hashes
    const isMatch = await bcryptjs.compare(password, authMethodRecord.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: "Invalid email or password." });
      return;
    }

    if (userRecord.isBanned) {
      res.status(403).json({ success: false, message: "This account has been banned." });
      return;
    }

    // Sign Access and Refresh JWTs
    const { accessToken, refreshToken } = generateTokenPair({
      userId: userRecord.id,
      role: userRecord.role,
    });

    // Save tokens inside secure httpOnly cookies
    res.cookie("token", accessToken, jwtCookieOptions(false));
    res.cookie("refreshToken", refreshToken, jwtCookieOptions(true));

    res.status(200).json({
      success: true,
      message: "Successfully logged in.",
      data: {
        user: {
          id: userRecord.id,
          email: userRecord.email,
          username: userRecord.username,
          displayName: userRecord.displayName,
          role: userRecord.role,
          avatarUrl: userRecord.avatarUrl,
          sessionToken: accessToken,
        },
      },
    });
  } catch (error) {
    console.error("[Auth Login Error]", error);
    res.status(500).json({ success: false, message: "Internal server error during login." });
  }
});

/**
 * GET /api/v1/auth/google
 * Generate a cryptographically signed OAuth state and redirect user to Google.
 */
router.get("/google", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const origin = req.query.origin?.toString() || "http://localhost:3000";

    if (!isAllowedOrigin(origin)) {
      res.status(400).json({ success: false, message: "Disallowed redirect origin." });
      return;
    }

    // Defeat CSRF / Session hijacking via signed JWT state containing origin and nonce
    const nonce = crypto.randomBytes(16).toString("hex");
    const state = jwt.sign({ origin, nonce }, ACCESS_TOKEN_SECRET, { expiresIn: "10m" });

    const authorizeUrl = googleClient.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      state,
    });

    res.redirect(authorizeUrl);
  } catch (error) {
    console.error("[Google OAuth Initiator Error]", error);
    res.status(500).send("Internal server error initializing Google Auth.");
  }
});

/**
 * GET /api/v1/auth/google/callback
 * Process authorization code from Google OAuth servers.
 */
router.get("/google/callback", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const code = req.query.code?.toString();
    const state = req.query.state?.toString();

    if (!code || !state) {
      res.status(400).send("Authorization code or state parameter is missing.");
      return;
    }

    // Verify cryptographic signature of the OAuth state vector
    let decodedState: { origin: string; nonce: string };
    try {
      decodedState = jwt.verify(state, ACCESS_TOKEN_SECRET) as { origin: string; nonce: string };
    } catch {
      res.status(400).send("Invalid or expired OAuth state parameter.");
      return;
    }

    const { origin } = decodedState;
    if (!isAllowedOrigin(origin)) {
      res.status(400).send("Callback origin parameter is not allowed.");
      return;
    }

    // Exchange auth code for tokens
    const { tokens } = await googleClient.getToken(code);
    if (!tokens.id_token) {
      res.status(400).send("Failed to retrieve ID Token from Google.");
      return;
    }

    // Decode and verify the ID token payload
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).send("Invalid token payload returned by Google.");
      return;
    }

    const { sub, email, name, picture } = payload;

    // Search if User already exists with this Google sub
    let authMethodRecord = await prisma.authMethod.findUnique({
      where: { googleSub: sub },
      include: { user: true },
    });

    let targetUser = authMethodRecord?.user;

    if (!targetUser) {
      // Find user by email to link them, or create fresh
      let existingUserByEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUserByEmail) {
        // Link GOOGLE_OAUTH provider to their existing profile
        targetUser = existingUserByEmail;
        await prisma.authMethod.create({
          data: {
            userId: targetUser.id,
            provider: "GOOGLE_OAUTH",
            googleSub: sub,
            googleEmail: email,
          },
        });
      } else {
        // Generate a clean username: shivam.verma_2a8b
        const cleanName = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
        const randHex = crypto.randomBytes(2).toString("hex");
        const uniqueUsername = `${cleanName}_${randHex}`;

        // Create atomic new User profile + Google AuthMethod mappings
        targetUser = await prisma.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: {
              email,
              username: uniqueUsername,
              displayName: name || cleanName,
              avatarUrl: picture || null,
              role: "USER",
              isEmailVerified: true,
            },
          });

          await tx.authMethod.create({
            data: {
              userId: createdUser.id,
              provider: "GOOGLE_OAUTH",
              googleSub: sub,
              googleEmail: email,
            },
          });

          return createdUser;
        });
      }
    }

    if (targetUser.isBanned) {
      res.status(403).send("This account has been banned.");
      return;
    }

    // Generate JWT access & refresh tokens
    const { accessToken, refreshToken } = generateTokenPair({
      userId: targetUser.id,
      role: targetUser.role,
    });

    // Save tokens inside secure httpOnly cookies
    res.cookie("token", accessToken, jwtCookieOptions(false));
    res.cookie("refreshToken", refreshToken, jwtCookieOptions(true));

    // Redirect the browser to the frontend landing flow
    res.redirect(302, `${origin}/oauth-success?token=${accessToken}`);
  } catch (error) {
    console.error("[Google OAuth Callback Error]", error);
    res.status(500).send("Authentication callback failed.");
  }
});

/**
 * GET /api/v1/auth/me
 * Load active database details for currently logged-in user profile.
 */
router.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    message: "User session loaded successfully.",
    data: {
      user: req.user,
    },
  });
});

/**
 * POST /api/v1/auth/logout
 * Deletes user sessions and wipes local cookies.
 */
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token", jwtCookieOptions(false));
  res.clearCookie("refreshToken", jwtCookieOptions(true));

  res.status(200).json({
    success: true,
    message: "Logged out successfully. Cookie tokens purged.",
  });
});

export default router;
