import { Interface, ZeroAddress } from "ethers";
import { describe, expect, it, vi } from "vitest";

import { monadPayRouterAbi } from "./contracts";
import { verifyPayment } from "./verify";

const iface = new Interface(monadPayRouterAbi);
const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const routerAddress = "0x0000000000000000000000000000000000000001";
const merchant = "0x0000000000000000000000000000000000000002";
const payer = "0x000000000000000000000000000000000000dEaD";
const token = ZeroAddress;
const reference =
  "0x7777777777777777777777777777777777777777777777777777777777777777";

function buildReceipt(logAddress = routerAddress, logReference = reference) {
  const event = iface.getEvent("PaymentReceived");
  const encoded = iface.encodeEventLog(event, [logReference, payer, merchant, token, 10n, "memo"]);

  return {
    blockNumber: 42,
    logs: [
      {
        address: logAddress,
        topics: encoded.topics,
        data: encoded.data,
      },
    ],
  };
}

describe("verifyPayment", () => {
  it("test_verifyPayment_valid", async () => {
    const provider = {
      getTransactionReceipt: vi.fn().mockResolvedValue(buildReceipt()),
    };

    await expect(
      verifyPayment(txHash, reference, routerAddress, provider as never)
    ).resolves.toMatchObject({
      valid: true,
      txHash,
      blockNumber: 42,
      payer,
      amount: 10n,
      token,
    });
  });

  it("test_verifyPayment_wrongReference", async () => {
    const provider = {
      getTransactionReceipt: vi.fn().mockResolvedValue(
        buildReceipt(
          routerAddress,
          "0x8888888888888888888888888888888888888888888888888888888888888888"
        )
      ),
    };

    await expect(
      verifyPayment(txHash, reference, routerAddress, provider as never)
    ).resolves.toMatchObject({
      valid: false,
    });
  });

  it("test_verifyPayment_noReceipt", async () => {
    const provider = {
      getTransactionReceipt: vi.fn().mockResolvedValue(null),
    };

    await expect(
      verifyPayment(txHash, reference, routerAddress, provider as never)
    ).resolves.toMatchObject({
      valid: false,
    });
  });

  it("test_verifyPayment_wrongContract", async () => {
    const provider = {
      getTransactionReceipt: vi.fn().mockResolvedValue(
        buildReceipt("0x0000000000000000000000000000000000001234")
      ),
    };

    await expect(
      verifyPayment(txHash, reference, routerAddress, provider as never)
    ).resolves.toMatchObject({
      valid: false,
    });
  });
});
