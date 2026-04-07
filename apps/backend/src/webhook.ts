import { createHmac } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import type { Merchant, PaymentRecord } from "@prisma/client";

import { prisma } from "./db";

export async function dispatchWebhook(record: PaymentRecord & { merchant: Merchant }): Promise<void> {
  const payload = {
    reference: record.reference,
    txHash: record.txHash ?? "",
    blockNumber: 0,
    payer: record.payer ?? "",
    merchant: record.merchant.address,
    token: record.token,
    amount: record.amount,
    memo: "",
    settledAt: record.settledAt ? Math.floor(record.settledAt.getTime() / 1000) : 0,
  };

  const secret = process.env.WEBHOOK_SECRET ?? "";
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  const backoff = [1_000, 2_000, 4_000];

  for (let attempt = 0; attempt < backoff.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      console.info(
        `[webhook] attempt ${attempt + 1} for reference ${record.reference} -> ${record.merchant.webhookUrl}`
      );

      const response = await fetch(record.merchant.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-monadpay-signature": signature,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        await prisma.paymentRecord.update({
          where: { id: record.id },
          data: { webhookFired: true },
        });
        return;
      }

      console.warn(`[webhook] non-2xx response ${response.status} for ${record.reference}`);
    } catch (error) {
      clearTimeout(timeout);
      console.error(`[webhook] failed attempt ${attempt + 1} for ${record.reference}`, error);
    }

    if (attempt < backoff.length - 1) {
      await delay(backoff[attempt]);
    }
  }

  throw new Error(`failed to deliver webhook for payment ${record.reference}`);
}
