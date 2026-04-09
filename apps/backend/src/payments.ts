import type { Merchant, PaymentRecord } from "@prisma/client";

import { buildPaymentTransaction } from "@monadpay/sdk";

type StoredPayment = PaymentRecord & {
  merchant: Merchant;
};

export function buildStoredPaymentTransaction(
  payment: StoredPayment,
  routerAddress: string
) {
  return buildPaymentTransaction({
    routerAddress,
    recipient: payment.merchant.address,
    token: payment.token,
    amount: BigInt(payment.amount),
    reference: payment.reference,
    memo: payment.memo ?? "",
  });
}

export function assertPendingPayment<T extends PaymentRecord>(
  payment: T | null
): asserts payment is T {
  if (!payment) {
    const error = new Error("payment not found") as Error & { statusCode?: number };
    error.statusCode = 404;
    throw error;
  }

  if (payment.status !== "PENDING") {
    const error = new Error("payment is no longer payable") as Error & { statusCode?: number };
    error.statusCode = 409;
    throw error;
  }
}
