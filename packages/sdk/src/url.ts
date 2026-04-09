import { Buffer } from "buffer";
import QRCode from "qrcode";
import { assertAmount, assertChecksumAddress, assertReference } from "./validation";

import type { TransferRequestParams } from "./types";

function appendOptionalParam(
  searchParams: URLSearchParams,
  key: "memo" | "label" | "message" | "expiresAt",
  value: string | number | undefined
): void {
  if (value !== undefined) {
    searchParams.set(key, String(value));
  }
}

export async function createTransferRequest(
  params: TransferRequestParams
): Promise<{ url: string; qrPng: Buffer }> {
  const recipient = assertChecksumAddress(params.recipient, "recipient");
  const token = assertChecksumAddress(params.token, "token");
  const reference = assertReference(params.reference);
  const amount = assertAmount(params.amount);

  const searchParams = new URLSearchParams({
    amount: amount.toString(),
    token,
    reference,
    chainId: String(params.chainId),
  });

  appendOptionalParam(searchParams, "memo", params.memo);
  appendOptionalParam(searchParams, "label", params.label);
  appendOptionalParam(searchParams, "message", params.message);
  appendOptionalParam(searchParams, "expiresAt", params.expiresAt);

  const url = `monadpay:${recipient}?${searchParams.toString()}`;
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    width: 300,
  });
  const base64 = dataUrl.split(",")[1];

  if (!base64) {
    throw new Error("failed to generate QR PNG");
  }

  return {
    url,
    qrPng: Buffer.from(base64, "base64"),
  };
}

export function parsePaymentUrl(url: string): TransferRequestParams {
  if (!url.startsWith("monadpay:")) {
    throw new Error("payment URL must use the monadpay: scheme");
  }

  const payload = url.slice("monadpay:".length);
  const [recipientPart, queryPart = ""] = payload.split("?");

  if (!recipientPart) {
    throw new Error("payment URL is missing a recipient");
  }

  const recipient = assertChecksumAddress(recipientPart, "recipient");
  const searchParams = new URLSearchParams(queryPart);

  const amountValue = searchParams.get("amount");
  if (!amountValue) {
    throw new Error("payment URL is missing amount");
  }

  let amount: bigint;
  try {
    amount = BigInt(amountValue);
  } catch {
    throw new Error("amount must be a valid integer");
  }
  assertAmount(amount);

  const tokenValue = searchParams.get("token");
  if (!tokenValue) {
    throw new Error("payment URL is missing token");
  }

  const referenceValue = searchParams.get("reference");
  if (!referenceValue) {
    throw new Error("payment URL is missing reference");
  }

  const chainIdValue = searchParams.get("chainId");
  if (!chainIdValue) {
    throw new Error("payment URL is missing chainId");
  }

  const chainId = Number.parseInt(chainIdValue, 10);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("chainId must be a positive integer");
  }

  const expiresAtValue = searchParams.get("expiresAt");
  let expiresAt: number | undefined;

  if (expiresAtValue !== null) {
    expiresAt = Number.parseInt(expiresAtValue, 10);
    if (!Number.isInteger(expiresAt)) {
      throw new Error("expiresAt must be a unix timestamp");
    }
  }

  return {
    recipient,
    amount,
    token: assertChecksumAddress(tokenValue, "token"),
    reference: assertReference(referenceValue),
    chainId,
    memo: searchParams.get("memo") ?? undefined,
    label: searchParams.get("label") ?? undefined,
    message: searchParams.get("message") ?? undefined,
    expiresAt,
  };
}

export function isExpired(params: TransferRequestParams): boolean {
  return params.expiresAt !== undefined && params.expiresAt < Math.floor(Date.now() / 1000);
}
