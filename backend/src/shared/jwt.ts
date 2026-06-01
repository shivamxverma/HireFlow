import jwt from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "hireflow_jwt_access_secret_2026_x18";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "hireflow_jwt_refresh_secret_2026_y99";

export interface UserJwtPayload {
  userId: string;
  role: string;
}

/**
 * Generate Access and Refresh JWTs for a user session
 */
export const generateTokenPair = (payload: UserJwtPayload) => {
  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: "30d" });
  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: "1y" });

  return { accessToken, refreshToken };
};

/**
 * Verify Access Token and decode payload
 */
export const verifyAccessToken = (token: string): UserJwtPayload => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as UserJwtPayload;
};

/**
 * Verify Refresh Token and decode payload
 */
export const verifyRefreshToken = (token: string): UserJwtPayload => {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as UserJwtPayload;
};

/**
 * Standard cookie configuration options for JWT cookies
 */
export const jwtCookieOptions = (isRefreshToken = false) => {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true, // Neutralizes XSS credential stealing
    secure: isProd, // Requires HTTPS in production
    sameSite: (isProd ? "lax" : "none") as "lax" | "none" | "strict",
    path: "/",
    maxAge: isRefreshToken ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000,
  };
};
