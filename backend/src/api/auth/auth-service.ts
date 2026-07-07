import bcryptjs from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../../services/prisma.js";
import env from "../../config/index.js";
import { generateTokenPair } from "../../shared/jwt.js";

const googleClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

export class AuthService {
  static isAllowedOrigin(origin: string): boolean {
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
  }

  static async registerUser(data: { email: string; password?: string; username: string; displayName?: string }) {
    const { email, password, username, displayName } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new Error("A user with this email or username already exists.");
    }

    let passwordHash = "";
    if (password) {
      const saltRounds = 10;
      passwordHash = await bcryptjs.hash(password, saltRounds);
    }

    // Create User and AuthMethod records atomically
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
          passwordHash: passwordHash || null,
        },
      });

      return createdUser;
    });

    return newUser;
  }

  static async loginUser(emailOrUsername: string, password?: string) {
    const userRecord = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
    });

    if (!userRecord) {
      throw new Error("Invalid email or password.");
    }

    const authMethodRecord = await prisma.authMethod.findUnique({
      where: { userId: userRecord.id },
    });

    if (!authMethodRecord || authMethodRecord.provider !== "EMAIL_PASSWORD" || !authMethodRecord.passwordHash) {
      throw new Error("Invalid credentials or authentication method.");
    }

    if (password) {
      const isMatch = await bcryptjs.compare(password, authMethodRecord.passwordHash);
      if (!isMatch) {
        throw new Error("Invalid email or password.");
      }
    } else {
      throw new Error("Password is required.");
    }

    if (userRecord.isBanned) {
      throw new Error("This account has been banned.");
    }

    const tokens = generateTokenPair({
      userId: userRecord.id,
      role: userRecord.role,
    });

    return { user: userRecord, tokens };
  }

  static generateGoogleAuthUrl(origin: string) {
    if (!AuthService.isAllowedOrigin(origin)) {
      throw new Error("Disallowed redirect origin.");
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    const state = jwt.sign({ origin, nonce }, env.ACCESS_TOKEN_SECRET, { expiresIn: "10m" });

    const authorizeUrl = googleClient.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      state,
    });

    return authorizeUrl;
  }

  static async processGoogleCallback(code: string, state: string) {
    let decodedState: { origin: string; nonce: string };
    try {
      decodedState = jwt.verify(state, env.ACCESS_TOKEN_SECRET) as { origin: string; nonce: string };
    } catch {
      throw new Error("Invalid or expired OAuth state parameter.");
    }

    const { origin } = decodedState;
    if (!AuthService.isAllowedOrigin(origin)) {
      throw new Error("Callback origin parameter is not allowed.");
    }

    const { tokens } = await googleClient.getToken(code);
    if (!tokens.id_token) {
      throw new Error("Failed to retrieve ID Token from Google.");
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error("Invalid token payload returned by Google.");
    }

    const { sub, email, name, picture } = payload;

    let authMethodRecord = await prisma.authMethod.findUnique({
      where: { googleSub: sub },
      include: { user: true },
    });

    let targetUser = authMethodRecord?.user;

    if (!targetUser) {
      let existingUserByEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUserByEmail) {
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
        const cleanName = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
        const randHex = crypto.randomBytes(2).toString("hex");
        const uniqueUsername = `${cleanName}_${randHex}`;

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
      throw new Error("This account has been banned.");
    }

    const newTokens = generateTokenPair({
      userId: targetUser.id,
      role: targetUser.role,
    });

    return { user: targetUser, tokens: newTokens, origin };
  }
}
