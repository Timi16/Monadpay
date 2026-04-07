import { createServer } from "node:net";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleTransactionRequest } from "./middleware";

function buildApp(
  buildTx: (payerAddress: string) => Promise<{ to: string; data: string; value?: string }>
) {
  const app = express();
  app.use(express.json());
  app.all("/transaction", handleTransactionRequest(buildTx));
  return app;
}

const canBindLocalPort = await new Promise<boolean>((resolve) => {
  const server = createServer();
  server.once("error", () => resolve(false));
  server.listen(0, "127.0.0.1", () => {
    server.close(() => resolve(true));
  });
});

const describeMiddleware = canBindLocalPort ? describe : describe.skip;

describeMiddleware("handleTransactionRequest", () => {
  afterEach(() => {
    delete process.env.MERCHANT_NAME;
    delete process.env.MERCHANT_ICON_URL;
    delete process.env.MONAD_CHAIN_ID;
  });

  it("GET returns label and icon", async () => {
    process.env.MERCHANT_NAME = "MonadPay";
    process.env.MERCHANT_ICON_URL = "https://example.com/icon.png";

    const response = await request(buildApp(vi.fn())).get("/transaction");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      label: "MonadPay",
      icon: "https://example.com/icon.png",
    });
  });

  it("POST with valid account calls buildTx and returns transaction object", async () => {
    process.env.MONAD_CHAIN_ID = "10143";
    const buildTx = vi.fn().mockResolvedValue({
      to: "0x0000000000000000000000000000000000000001",
      data: "0x1234",
      value: "0x0",
    });

    const response = await request(buildApp(buildTx)).post("/transaction").send({
      account: "0x000000000000000000000000000000000000dEaD",
    });

    expect(response.status).toBe(200);
    expect(buildTx).toHaveBeenCalledWith("0x000000000000000000000000000000000000dEaD");
    expect(response.body).toEqual({
      transaction: {
        to: "0x0000000000000000000000000000000000000001",
        data: "0x1234",
        value: "0x0",
        chainId: "10143",
      },
    });
  });

  it("POST missing account returns 400", async () => {
    const response = await request(buildApp(vi.fn())).post("/transaction").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "missing account" });
  });

  it("POST buildTx throws returns 500", async () => {
    const response = await request(
      buildApp(async () => {
        throw new Error("boom");
      })
    )
      .post("/transaction")
      .send({ account: "0x000000000000000000000000000000000000dEaD" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "boom" });
  });
});
