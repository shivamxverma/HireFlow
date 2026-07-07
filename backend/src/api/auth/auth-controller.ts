import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { AuthService } from "./auth-service.js";
import { jwtCookieOptions } from "../../shared/jwt.js";
import { AuthenticatedRequest } from "../../shared/middleware.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const newUser = await AuthService.registerUser(req.body);
  res.status(201).json(
    new ApiResponse(201, {
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        displayName: newUser.displayName,
        role: newUser.role,
      },
    }, "Registration completed successfully.")
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { user, tokens } = await AuthService.loginUser(email, password);

  // Set cookies
  res.cookie("token", tokens.accessToken, jwtCookieOptions(false));
  res.cookie("refreshToken", tokens.refreshToken, jwtCookieOptions(true));

  res.status(200).json(
    new ApiResponse(200, {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        sessionToken: tokens.accessToken,
      },
    }, "Successfully logged in.")
  );
});

export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const origin = req.query.origin?.toString() || "http://localhost:3000";
  const authorizeUrl = AuthService.generateGoogleAuthUrl(origin);
  res.redirect(authorizeUrl);
});

export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  const code = req.query.code?.toString() || "";
  const state = req.query.state?.toString() || "";

  if (!code || !state) {
    res.status(400).send("Authorization code or state parameter is missing.");
    return;
  }

  try {
    const { user, tokens, origin } = await AuthService.processGoogleCallback(code, state);

    res.cookie("token", tokens.accessToken, jwtCookieOptions(false));
    res.cookie("refreshToken", tokens.refreshToken, jwtCookieOptions(true));

    res.redirect(302, `${origin}/oauth-success?token=${tokens.accessToken}`);
  } catch (error: any) {
    console.error("[Google OAuth Callback Error]", error);
    res.status(500).send(error.message || "Authentication callback failed.");
  }
});

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json(
    new ApiResponse(200, {
      user: req.user,
    }, "User session loaded successfully.")
  );
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  res.clearCookie("token", jwtCookieOptions(false));
  res.clearCookie("refreshToken", jwtCookieOptions(true));

  res.status(200).json(
    new ApiResponse(200, null, "Logged out successfully. Cookie tokens purged.")
  );
});
