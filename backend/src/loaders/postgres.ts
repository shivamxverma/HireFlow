import { prisma } from "../services/prisma.js";

export async function verifyDatabaseConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("📂 Database connection verified successfully.");
  } catch (error) {
    console.error("❌ Database connection verification failed:", error);
    throw error;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log("📂 Database connection closed successfully.");
  } catch (error) {
    console.error("❌ Error closing database connection:", error);
    throw error;
  }
}
