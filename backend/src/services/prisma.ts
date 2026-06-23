import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Prevent multiple instances of Prisma Client in development due to hot reloading
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: ["info", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
