# Backend Architecture & Design Document

This document provides a comprehensive overview of the architecture, folder structure, design patterns, configuration, and dependencies of the backend module. You can use this as a reference guide to replicate this setup in other projects.

---

## 🏗️ Design Patterns & Architecture

The backend follows a highly structured, scalable, and modular design pattern combining the **Three-Tier Architecture**, the **Loader Pattern**, and **Strict Schema Enforcement** for configurations and inputs.

### 1. The Loader Pattern
Instead of initializing everything (database, middleware, logger, external clients) inside `index.ts`, startup configurations are modularized into **Loaders** under [src/loaders/](file:///Users/shivamverma/Desktop/projects/CodeSM/backend/src/loaders).
*   **Startup Orchestration:** [src/index.ts](file:///Users/shivamverma/Desktop/projects/CodeSM/backend/src/index.ts) calls the main loader function.
*   **Separation of Concerns:** Individual services (e.g., PostgreSQL connection, Express setup, OAuth config, Redis connection) load sequentially and print clean, descriptive messages.
*   **Graceful Shutdown:** Implemented directly in `index.ts`. On receiving `SIGTERM` or `SIGINT` signals, the server closes the HTTP listener, waits for active connections, closes the PostgreSQL database pool, and exits. A fallback timeout forces shutdown if it hangs.

### 2. Three-Tier Modular Layering
API resources are encapsulated into self-contained directories under [src/api/](file:///Users/shivamverma/Desktop/projects/CodeSM/backend/src/api). Each resource is structured as follows:

```
src/api/<resource>/
├── <resource>-route.ts       # Router Layer
├── <resource>-controller.ts  # Controller Layer
├── <resource>-service.ts     # Service (Business Logic) Layer
├── <resource>-schema.ts      # Validation (Yup Schema) Layer
├── <resource>-types.ts       # TypeScript Interfaces/Types
└── <resource>-helper.ts      # Resource-specific Helper Functions (optional)
```

*   **Router Layer:** Defines routes, path mappings, and binds validation/authentication middlewares before handing off to the controller.
*   **Controller Layer:** Extract request parameters (`body`, `query`, `params`), invoke corresponding service methods, and format responses. Controllers do not run business or database logic. They are wrapped in a generic `asyncHandler` to avoid repetitive try-catch blocks.
*   **Service Layer:** Executes core business logic, accesses the database (PostgreSQL via Drizzle, MongoDB via Mongoose), manages transactions, and triggers side-effects (e.g., sending emails).

### 3. Decoupled Database Schema
Rather than keeping the database schema solely in the backend, the project structures the database schema as a separate local package:
*   Located in the root project at [db-schema/](file:///Users/shivamverma/Desktop/projects/CodeSM/db-schema).
*   Linked in the backend's `package.json` using `"db-schema": "file:../db-schema"`.
*   This pattern enables sharing schema definitions and TS interfaces easily across both the main API `backend` and background execution `workers`.

---

## 📁 Directory Structure & File Breakdown

Below is the directory mapping of the backend, explaining the role of each directory and configuration file.

```
backend/
├── dist/                      # Compiled JS output directory
├── drizzle/                   # Drizzle Kit generated migrations & SQL files
├── logs/                      # Winston file logging (error and combined rotation logs)
├── public/                    # Static assets
├── src/                       # TypeScript codebase source
│   ├── api/                   # API modular subdirectories
│   │   ├── auth/              # Authentication module (Email/Password, Google OAuth)
│   │   ├── problem/           # Coding problems management
│   │   ├── submission/        # Code submissions and evaluations
│   │   ├── interview/         # Interview session logic
│   │   └── index.ts           # Central router aggregator
│   ├── config/                # Environment variable schema validation & export
│   ├── db/                    # Local schema references / database connection imports
│   ├── loaders/               # Startup initializers (Express, Postgres, Logger, OAuth, Redis)
│   ├── scripts/               # Migration scripts (e.g., MongoDB users/problems/submissions to Postgres)
│   ├── services/              # External services (AWS S3, AI Gemini, Email dispatch)
│   ├── shared/                # Global middlewares (JWT verification, rate limiter, general helpers)
│   ├── types/                 # Shared TypeScript global types
│   ├── utils/                 # Utilities (ApiError, ApiResponse, asyncHandler, Constants)
│   └── index.ts               # Application entry point & server runner
├── Dockerfile                 # Docker configuration for development
├── Dockerfile.prod            # Docker configuration for production
├── drizzle.config.ts          # Drizzle ORM configuration (specifies PostgreSQL credentials & output)
├── package.json               # Backend configuration, dependencies, and execution scripts
├── pnpm-lock.yaml             # Lockfile for dependency trees
└── tsconfig.json              # TypeScript compilation configurations
```

---

## 🛠️ Tech Stack & Key Dependencies

The backend is configured to run on **Bun** (for fast local runtime execution) or **Node.js**.

### Core Engine & Languages
*   **Runtime:** Bun (`bun run src/index.ts`)
*   **Language:** TypeScript
*   **Framework:** Express (version 5.x)

### Database & ORM
*   **ORM:** Drizzle ORM
*   **Driver:** Node-Postgres (`pg`)
*   **Database Migration Engine:** Drizzle Kit
*   **Migration Support:** Mongoose (handles legacy MongoDB migrations to PostgreSQL)

### Operations, Queue & Cache
*   **Queueing Engine:** BullMQ & Bull
*   **Redis Client:** ioredis

### Utility & Middlewares
*   **Logging:** Winston & Winston Daily Rotate File (for daily logs organization)
*   **Validation:** Yup (schema-based validation for configurations and request payloads)
*   **Authentication:** Passport, Passport Google OAuth 2.0, jsonwebtoken (JWT), and bcryptjs
*   **External Service Integrations:** AWS SDK S3 client, Cloudinary, Nodemailer, Google Generative AI (Gemini SDK), Google Cloud Text-to-Speech

---

## 🔄 Request Lifecycle & Flows

To maintain consistency, every incoming HTTP request follows a strict lifecycle flow.

```
[Client Request]
       │
       ▼
[Rate Limiter Middleware] (shared/ratelimiter)
       │
       ▼
[Express Router] (api/index & api/<module>/<module>-route)
       │
       ├── Protect Route? ──► [verifyJWT Middleware] (shared/middleware)
       │                                │
       ▼                                ▼
[Yup Schema Validation] ◄───────────────┘ (shared/middleware & api/<module>/<module>-schema)
       │
       ▼
[Controller Handler] (api/<module>/<module>-controller)
       │
       ▼
[Service Logic Layer] (api/<module>/<module>-service)
       │
       ▼
[Database / Ext Services] (drizzle db / mongoose / AWS / Gemini)
       │
   (Success)
       ▼
[ApiResponse Formatter] (utils/ApiResponse)
       │
       ▼
[Client Response (JSON)]
```

### 1. Global Middleware Execution
*   **Rate Limiting:** Every request passes through a flexible rate limiter (`rateLimitMiddleware`) to prevent DDoS or brute-force requests.
*   **JWT Verification:** For protected routes, `verifyJWT` parses cookies or the `Authorization` header, verifies the JWT signature, queries Postgres to fetch the active user details, and attaches them to `req.user`.

### 2. Validation (`validate` middleware)
Located in [src/shared/middleware.ts](file:///Users/shivamverma/Desktop/projects/CodeSM/backend/src/shared/middleware.ts#L13):
*   Validates the body, query parameters, or route params against a Yup schema.
*   Merges validated fields back to the request object.
*   Catches validation errors and returns a formatted `400 Bad Request` with all error messages merged.

### 3. Controller Execution & Response Formatting
*   Controllers handle exceptions by utilizing `asyncHandler` (which automatically routes exceptions to the Express error boundary via `next(err)`).
*   Controllers use the standard **`ApiResponse`** class:
    ```typescript
    res.status(httpStatus.OK).json(
      new ApiResponse(httpStatus.OK, "Login successful", data)
    );
    ```

---

## 📦 Copy-Paste Boilerplate Guide

To migrate or replicate this backend structure to another project, copy the following core building blocks.

### 1. Server Entry Point & Shutdown ([src/index.ts](file:///Users/shivamverma/Desktop/projects/CodeSM/backend/src/index.ts))
```typescript
import express from 'express';
import loaders from './loaders';
import logger from './loaders/logger';
import env from './config/index';
import { closeDatabaseConnection } from './loaders/postgres';

async function startServer() {
    const app = express();
    await loaders({ expressApp: app });

    const port = Number(env.PORT) || 8000;
    const server = app.listen(port, '0.0.0.0', () => {
        logger.info(`🛡️ Server listening on port: ${port} 🛡️`);
    }).on('error', (err) => {
        logger.error('Error in server', err);
        process.exit(1);
    });

    const shutdown = async (signal: string) => {
        logger.info(`${signal} received, closing server gracefully...`);
        server.close(async () => {
            try {
                await closeDatabaseConnection();
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
```

### 2. Standardized API Response ([src/utils/ApiResponse.ts](file:///Users/shivamverma/Desktop/projects/CodeSM/backend/src/utils/ApiResponse.ts))
```typescript
export interface ApiResponseBody<T = any> {
  statusCode: number;
  message: string;
  data: T | null;
  success: boolean;
}

class ApiResponse<T = any> implements ApiResponseBody<T> {
  statusCode: number;
  message: string;
  data: T | null;
  success: boolean;

  constructor(statusCode: number, arg2: T | string | null, arg3?: T | string | null) {
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 300;

    if (typeof arg2 === 'string') {
      this.message = arg2;
      this.data = (arg3 ?? null) as T | null;
    } else {
      this.data = (arg2 ?? null) as T | null;
      this.message = typeof arg3 === 'string' ? arg3 : '';
    }
  }
}

export { ApiResponse };
```

### 3. Standardized API Error ([src/utils/ApiError.ts](file:///Users/shivamverma/Desktop/projects/CodeSM/backend/src/utils/ApiError.ts))
```typescript
class ApiError extends Error {
    public statusCode: number;
    public success: boolean;
    public data: any;
    public isOperational: boolean;
  
    constructor(message: string, statusCode: number, data?: any) {
      super(message);
      this.statusCode = statusCode;
      this.success = statusCode >= 200 && statusCode < 300;
      this.isOperational = true;
      this.data = data;
      Error.captureStackTrace(this, this.constructor);
    }
}
export default ApiError;
```

### 4. Async Handler wrapper ([src/utils/asyncHandler.ts](file:///Users/shivamverma/Desktop/projects/CodeSM/backend/src/utils/asyncHandler.ts))
```typescript
import { Request, Response, NextFunction } from 'express';

const asyncHandler = (fn: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err: any) => {
      next(err);
    });
  };
};

export default asyncHandler;
```

### 5. Input Validation Middleware ([src/shared/middleware.ts](file:///Users/shivamverma/Desktop/projects/CodeSM/backend/src/shared/middleware.ts#L13-L57))
```typescript
import * as yup from 'yup';
import { Request, Response, NextFunction } from 'express';

export const validate = (location: 'query' | 'body' | 'params', schema: yup.ObjectSchema<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = await schema.validate(req[location], { abortEarly: false });
      Object.assign(req[location], validatedData);
      next();
    } catch (error: unknown) {
      if (error instanceof yup.ValidationError) {
        return res.status(400).json({ error: error.errors.join(', ') });
      }
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };
};
```
