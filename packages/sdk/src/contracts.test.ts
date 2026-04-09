import { Interface, ZeroAddress } from "ethers";
import { describe, expect, it } from "vitest";

import {
  buildPaymentTransaction,
  monadPayEscrowAbi,
  monadPayRouterAbi,
} from "./contracts";

describe("contracts", () => {
  it("builds native router transactions", () => {
    const transaction = buildPaymentTransaction({
      routerAddress: "0x0000000000000000000000000000000000000001",
      recipient: "0x000000000000000000000000000000000000dEaD",
      token: ZeroAddress,
      amount: 25n,
      reference:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      memo: "coffee",
    });

    const iface = new Interface(monadPayRouterAbi);
    const decoded = iface.decodeFunctionData("payWithNative", transaction.data);

    expect(transaction.to).toBe("0x0000000000000000000000000000000000000001");
    expect(transaction.value).toBe("0x19");
    expect(decoded.paymentReference).toBe(
      "0x1111111111111111111111111111111111111111111111111111111111111111"
    );
    expect(decoded.merchant).toBe("0x000000000000000000000000000000000000dEaD");
    expect(decoded.memo).toBe("coffee");
  });

  it("builds ERC-20 router transactions", () => {
    const transaction = buildPaymentTransaction({
      routerAddress: "0x0000000000000000000000000000000000000001",
      recipient: "0x000000000000000000000000000000000000dEaD",
      token: "0x0000000000000000000000000000000000000002",
      amount: 50n,
      reference:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
    });

    const iface = new Interface(monadPayRouterAbi);
    const decoded = iface.decodeFunctionData("payWithToken", transaction.data);

    expect(transaction.value).toBe("0x0");
    expect(decoded.paymentReference).toBe(
      "0x2222222222222222222222222222222222222222222222222222222222222222"
    );
    expect(decoded.merchant).toBe("0x000000000000000000000000000000000000dEaD");
    expect(decoded.token).toBe("0x0000000000000000000000000000000000000002");
    expect(decoded.amount).toBe(50n);
  });

  it("exports the escrow ABI surface", () => {
    const iface = new Interface(monadPayEscrowAbi);

    expect(iface.getFunction("deposit")).toBeDefined();
    expect(iface.getFunction("release")).toBeDefined();
    expect(iface.getFunction("refund")).toBeDefined();
  });
});
