import { Router } from "express";
import { register, login, googleAuth, googleCallback, getMe, logout } from "./auth-controller.js";
import { registerSchema, loginSchema } from "./auth-schema.js";
import { validate, requireAuth } from "../../shared/middleware.js";

export const authRouter = Router();

authRouter.post("/register", validate("body", registerSchema), register);
authRouter.post("/login", validate("body", loginSchema), login);
authRouter.get("/google", googleAuth);
authRouter.get("/google/callback", googleCallback);
authRouter.get("/me", requireAuth, getMe);
authRouter.post("/logout", logout);
