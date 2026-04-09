import { ZeroAddress } from "ethers";
import { describe, expect, it } from "vitest";

import type { TransferRequestParams } from "./types";
import { createTransferRequest, isExpired, parsePaymentUrl } from "./url";

describe("url", () => {
  it("roundtrips ERC-20 and native requests", async () => {
    const erc20Params: TransferRequestParams = {
      recipient: "0x000000000000000000000000000000000000dEaD",
      amount: 1250n,
      token: "0x0000000000000000000000000000000000000001",
      reference:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      chainId: 10143,
      memo: "invoice-1",
      label: "Coffee",
      message: "Thanks",
      expiresAt: 1_900_000_000,
    };

    const nativeParams: TransferRequestParams = {
      recipient: "0x000000000000000000000000000000000000dEaD",
      amount: 999n,
      token: ZeroAddress,
      reference:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
      chainId: 10143,
    };

    const erc20Request = await createTransferRequest(erc20Params);
    const nativeRequest = await createTransferRequest(nativeParams);

    expect(parsePaymentUrl(erc20Request.url)).toEqual(erc20Params);
    expect(parsePaymentUrl(nativeRequest.url)).toEqual(nativeParams);
  });

  it("returns a PNG buffer", async () => {
    const request = await createTransferRequest({
      recipient: "0x000000000000000000000000000000000000dEaD",
      amount: 1n,
      token: ZeroAddress,
      reference:
        "0x3333333333333333333333333333333333333333333333333333333333333333",
      chainId: 10143,
    });

    expect([...request.qrPng.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("throws on missing recipient", () => {
    expect(() =>
      parsePaymentUrl(
        "monadpay:?amount=1&token=0x0000000000000000000000000000000000000000&reference=0x4444444444444444444444444444444444444444444444444444444444444444&chainId=10143"
      )
    ).toThrow("payment URL is missing a recipient");
  });

  it("throws on invalid address", () => {
    expect(() =>
      parsePaymentUrl(
        "monadpay:0x000000000000000000000000000000000000dead?amount=1&token=0x0000000000000000000000000000000000000000&reference=0x4444444444444444444444444444444444444444444444444444444444444444&chainId=10143"
      )
    ).toThrow("recipient must be a valid checksum address");
  });

  it("reports expiry for past timestamps", () => {
    expect(
      isExpired({
        recipient: "0x000000000000000000000000000000000000dEaD",
        amount: 1n,
        token: ZeroAddress,
        reference:
          "0x5555555555555555555555555555555555555555555555555555555555555555",
        chainId: 10143,
        expiresAt: 1,
      })
    ).toBe(true);
  });

  it("throws when amount is zero", async () => {
    await expect(
      createTransferRequest({
        recipient: "0x000000000000000000000000000000000000dEaD",
        amount: 0n,
        token: ZeroAddress,
        reference:
          "0x6666666666666666666666666666666666666666666666666666666666666666",
        chainId: 10143,
      })
    ).rejects.toThrow("amount must be greater than zero");
  });
});
