import { ZeroAddress } from "ethers";
import { describe, expect, it } from "vitest";

import { assertPendingPayment, buildStoredPaymentTransaction } from "./payments";

describe("payments", () => {
  it("builds a native payment transaction from a stored record", () => {
    const transaction = buildStoredPaymentTransaction(
      {
        id: "payment-id",
        reference:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        merchantId: "merchant-id",
        status: "PENDING",
        txHash: null,
        payer: null,
        token: ZeroAddress,
        amount: "25",
        memo: "coffee",
        settledAt: null,
        webhookFired: false,
        createdAt: new Date(),
        merchant: {
          id: "merchant-id",
          address: "0x000000000000000000000000000000000000dEaD",
          name: "Coffee",
          logoUri: "https://example.com/logo.png",
          webhookUrl: "https://example.com/webhook",
          allowedTokens: [ZeroAddress],
          createdAt: new Date(),
        },
      },
      "0x0000000000000000000000000000000000000001"
    );

    expect(transaction.to).toBe("0x0000000000000000000000000000000000000001");
    expect(transaction.value).toBe("0x19");
    expect(transaction.data.startsWith("0x")).toBe(true);
  });

  it("rejects non-pending payments", () => {
    expect(() =>
      assertPendingPayment({
        id: "payment-id",
        reference:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        merchantId: "merchant-id",
        status: "SETTLED",
        txHash: null,
        payer: null,
        token: ZeroAddress,
        amount: "25",
        memo: null,
        settledAt: null,
        webhookFired: false,
        createdAt: new Date(),
      })
    ).toThrow("payment is no longer payable");
  });
});
