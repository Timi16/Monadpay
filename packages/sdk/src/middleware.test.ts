import { createServer } from "node:net";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleTransactionRequest } from "./middleware";

function buildApp(
  buildTx: (
    payerAddress: string,
    req: express.Request
  ) => Promise<{ to: string; data: string; value?: string }>,
  getMerchantMetadata: (req: express.Request) => Promise<{ label?: string; icon?: string }> | { label?: string; icon?: string } = () => ({})
) {
  const app = express();
  app.use(express.json());
  app.all("/merchant/:merchantId/transaction", handleTransactionRequest(buildTx, getMerchantMetadata));
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
    delete process.env.MONAD_CHAIN_ID;
  });

  it("GET returns merchant-specific label and icon", async () => {
    const response = await request(
      buildApp(vi.fn(), (req) => ({
        label: `Merchant ${req.params.merchantId}`,
        icon: `https://example.com/${req.params.merchantId}.png`,
      }))
    ).get("/merchant/merchant-123/transaction");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      label: "Merchant merchant-123",
      icon: "https://example.com/merchant-123.png",
    });
  });

  it("POST with valid account calls buildTx and returns transaction object", async () => {
    process.env.MONAD_CHAIN_ID = "10143";
    const buildTx = vi.fn().mockResolvedValue({
      to: "0x0000000000000000000000000000000000000001",
      data: "0x1234",
      value: "0x0",
    });

    const response = await request(buildApp(buildTx))
      .post("/merchant/merchant-123/transaction")
      .send({
        account: "0x000000000000000000000000000000000000dEaD",
      });

    expect(response.status).toBe(200);
    expect(buildTx).toHaveBeenCalledWith(
      "0x000000000000000000000000000000000000dEaD",
      expect.objectContaining({
        params: expect.objectContaining({ merchantId: "merchant-123" }),
      })
    );
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
    const response = await request(buildApp(vi.fn()))
      .post("/merchant/merchant-123/transaction")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "missing account" });
  });

  it("POST buildTx throws returns 500", async () => {
    const response = await request(
      buildApp(async () => {
        throw new Error("boom");
      })
    )
      .post("/merchant/merchant-123/transaction")
      .send({ account: "0x000000000000000000000000000000000000dEaD" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "boom" });
  });

  it("POST respects error status codes from buildTx", async () => {
    const response = await request(
      buildApp(async () => {
        const error = new Error("payment not found") as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      })
    )
      .post("/merchant/merchant-123/transaction")
      .send({ account: "0x000000000000000000000000000000000000dEaD" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "payment not found" });
  });
});
