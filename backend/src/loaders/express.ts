import express, { Express, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { apiRouter } from "../api/index.js";

export function initExpress({ expressApp }: { expressApp: Express }): void {
  // CORS configuration
  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, bypass-tunnel-reminder");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Request logging
  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[Express] Incoming Request: ${req.method} ${req.url}`);
    next();
  });

  // Parsers
  expressApp.use(cookieParser());
  expressApp.use(express.json({ limit: "50mb" }));
  expressApp.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Main API Router Aggregator
  expressApp.use(apiRouter);

  // Global Error Handler boundary
  expressApp.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("💥 Express Error Boundary Caught Exception:", err);
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal server error.";
    res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      data: err.data || null,
    });
  });
}
