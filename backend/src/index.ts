import express from "express";
import loaders from "./loaders/index.js";
import env from "./config/index.js";
import { closeDatabaseConnection } from "./loaders/postgres.js";

async function startServer() {
  const app = express();
  await loaders({ expressApp: app });

  const port = Number(env.PORT) || 3000;
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`🛡️ Server listening on port: ${port} 🛡️`);
  }).on("error", (err) => {
    console.error("Error in server", err);
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, closing server gracefully...`);
    server.close(async () => {
      try {
        await closeDatabaseConnection();
        console.log("Graceful shutdown complete.");
        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
