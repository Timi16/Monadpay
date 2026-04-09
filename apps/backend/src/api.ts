import { JsonRpcProvider, WebSocketProvider, getAddress, hexlify, randomBytes } from "ethers";
import express from "express";

import { createTransferRequest, handleTransactionRequest, verifyPayment } from "@monadpay/sdk";
import { prisma } from "./db";
import { getMonadChainId, getRouterAddress } from "./config";
import { assertPendingPayment, buildStoredPaymentTransaction } from "./payments";
import { dispatchWebhook } from "./webhook";

function getProvider() {
  const url = process.env.MONAD_RPC_URL ?? "";
  return url.startsWith("ws") ? new WebSocketProvider(url) : new JsonRpcProvider(url);
}

export function createApiRouter() {
  const router = express.Router();
  const provider = getProvider();
  const routerAddress = getRouterAddress();

  router.post("/payment/create", async (req, res) => {
    const { merchantId, amount, token, memo, expiresAt } = req.body ?? {};

    if (!merchantId || !amount || !token) {
      res.status(400).json({ error: "merchantId, amount, and token are required" });
      return;
    }

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
      res.status(404).json({ error: "merchant not found" });
      return;
    }

    const normalizedToken = getAddress(token);
    if (!merchant.allowedTokens.includes(normalizedToken)) {
      res.status(400).json({ error: "token not enabled for merchant" });
      return;
    }

    const reference = hexlify(randomBytes(32)).toLowerCase();
    const request = await createTransferRequest({
      reference,
      recipient: merchant.address,
      amount: BigInt(amount),
      token: normalizedToken,
      memo,
      expiresAt,
      label: merchant.name,
      chainId: getMonadChainId(),
    });

    await prisma.paymentRecord.create({
      data: {
        reference,
        merchantId: merchant.id,
        status: "PENDING",
        token: normalizedToken,
        amount: String(amount),
        memo,
      },
    });

    res.json({
      reference,
      url: request.url,
      qrPng: request.qrPng.toString("base64"),
      routerAddress,
      transactionRequestUrl: `/api/payment/${reference}/transaction`,
    });
  });

  router.get("/payment/:reference", async (req, res) => {
    const payment = await prisma.paymentRecord.findUnique({
      where: { reference: req.params.reference.toLowerCase() },
    });

    if (!payment) {
      res.status(404).json({ error: "payment not found" });
      return;
    }

    res.json(payment);
  });

  router.get("/payment/:reference/verify", async (req, res) => {
    const payment = await prisma.paymentRecord.findUnique({
      where: { reference: req.params.reference.toLowerCase() },
    });

    const txHash =
      typeof req.query.txHash === "string" ? req.query.txHash : payment?.txHash ?? undefined;

    if (!txHash) {
      res.status(400).json({ error: "txHash is required when the payment has not settled yet" });
      return;
    }

    const result = await verifyPayment(
      txHash,
      req.params.reference.toLowerCase(),
      routerAddress,
      provider
    );

    res.json(result);
  });

  router.get("/merchant/:id/payments", async (req, res) => {
    const page = Math.max(Number.parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? "20"), 10) || 20, 1), 100);
    const from = req.query.from ? Number.parseInt(String(req.query.from), 10) : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const payments = await prisma.paymentRecord.findMany({
      where: {
        merchantId: req.params.id,
        ...(status ? { status: status as never } : {}),
        ...(from ? { createdAt: { gte: new Date(from * 1_000) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json(payments);
  });

  router.post("/merchant/register", async (req, res) => {
    const { address, name, logoUri, webhookUrl, allowedTokens } = req.body ?? {};

    if (!address || !name || !logoUri || !webhookUrl || !Array.isArray(allowedTokens)) {
      res.status(400).json({ error: "invalid merchant payload" });
      return;
    }

    const merchant = await prisma.merchant.upsert({
      where: { address: getAddress(address) },
      update: {
        name,
        logoUri,
        webhookUrl,
        allowedTokens: allowedTokens.map((tokenAddress: string) => getAddress(tokenAddress)),
      },
      create: {
        address: getAddress(address),
        name,
        logoUri,
        webhookUrl,
        allowedTokens: allowedTokens.map((tokenAddress: string) => getAddress(tokenAddress)),
      },
    });

    res.json(merchant);
  });

  router.all(
    "/payment/:reference/transaction",
    handleTransactionRequest(
      async (_payerAddress, req) => {
        const reference = String(req.params.reference).toLowerCase();
        const payment = await prisma.paymentRecord.findUnique({
          where: { reference },
          include: { merchant: true },
        });

        assertPendingPayment(payment);
        return buildStoredPaymentTransaction(payment, routerAddress);
      },
      async (req) => {
        const reference = String(req.params.reference).toLowerCase();
        const payment = await prisma.paymentRecord.findUnique({
          where: { reference },
          include: { merchant: true },
        });

        assertPendingPayment(payment);
        return {
          label: payment.merchant.name,
          icon: payment.merchant.logoUri,
        };
      }
    )
  );

  router.get("/config", (_req, res) => {
    res.json({
      chainId: getMonadChainId(),
      routerAddress,
    });
  });

  router.get("/merchant/:id/stats", async (req, res) => {
    const payments = await prisma.paymentRecord.findMany({
      where: { merchantId: req.params.id, status: "SETTLED" },
      orderBy: { createdAt: "asc" },
    });

    const totalVolume = payments.reduce<Record<string, string>>((accumulator, payment) => {
      const current = BigInt(accumulator[payment.token] ?? "0");
      accumulator[payment.token] = (current + BigInt(payment.amount)).toString();
      return accumulator;
    }, {});

    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);

    const dailySeries = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const dayKey = date.toISOString().slice(0, 10);
      const matching = payments.filter(
        (payment) => (payment.settledAt ?? payment.createdAt).toISOString().slice(0, 10) === dayKey
      );

      return {
        date: dayKey,
        count: matching.length,
        volume: matching.reduce<Record<string, string>>((accumulator, payment) => {
          const current = BigInt(accumulator[payment.token] ?? "0");
          accumulator[payment.token] = (current + BigInt(payment.amount)).toString();
          return accumulator;
        }, {}),
      };
    });

    res.json({
      totalVolume,
      count: payments.length,
      dailySeries,
    });
  });

  router.post("/webhook/retry/:paymentId", async (req, res) => {
    const payment = await prisma.paymentRecord.findUnique({
      where: { id: req.params.paymentId },
      include: { merchant: true },
    });

    if (!payment) {
      res.status(404).json({ error: "payment not found" });
      return;
    }

    await dispatchWebhook(payment);
    res.json({ ok: true });
  });

  return router;
}
