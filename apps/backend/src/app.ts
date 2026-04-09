import express from "express";

import { createApiRouter } from "./api";
import { openApiDocument } from "./openapi";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  app.get("/api/docs", (_req, res) => {
    res.type("text/plain").send(
      [
        "MonadPay API docs",
        "",
        "OpenAPI JSON: /api/openapi.json",
        "Frontend integration guide: docs/frontend-integration.md",
      ].join("\n")
    );
  });
  app.use("/api", createApiRouter());
  return app;
}
