import express from "express";

import { createApiRouter } from "./api";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", createApiRouter());
  return app;
}
