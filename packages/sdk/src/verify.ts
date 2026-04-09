import { Interface, ZeroAddress, getAddress, getBytes, hexlify } from "ethers";
import type { Provider } from "ethers";

import { monadPayRouterAbi } from "./contracts";
import type { VerifyPaymentResult } from "./types";

const routerInterface = new Interface(monadPayRouterAbi);
const paymentReceivedEvent = routerInterface.getEvent("PaymentReceived");

function invalidResult(txHash: string, blockNumber = 0): VerifyPaymentResult {
  return {
    valid: false,
    txHash,
    blockNumber,
    payer: ZeroAddress,
    amount: 0n,
    token: ZeroAddress,
  };
}

function normalizeReference(reference: string): string {
  return hexlify(getBytes(reference)).toLowerCase();
}

export async function verifyPayment(
  txHash: string,
  reference: string,
  routerAddress: string,
  provider: Provider
): Promise<VerifyPaymentResult> {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || !paymentReceivedEvent) {
    return invalidResult(txHash);
  }

  const normalizedRouter = getAddress(routerAddress);
  const targetLog = receipt.logs.find(
    (log) =>
      getAddress(log.address) === normalizedRouter &&
      log.topics[0] === paymentReceivedEvent.topicHash
  );

  if (!targetLog) {
    return invalidResult(txHash, receipt.blockNumber);
  }

  try {
    const decodedLog = routerInterface.decodeEventLog(
      paymentReceivedEvent,
      targetLog.data,
      targetLog.topics
    );

    if (normalizeReference(decodedLog.paymentReference) !== normalizeReference(reference)) {
      return invalidResult(txHash, receipt.blockNumber);
    }

    return {
      valid: true,
      txHash,
      blockNumber: receipt.blockNumber,
      payer: decodedLog.payer,
      amount: decodedLog.amount,
      token: decodedLog.token,
    };
  } catch {
    return invalidResult(txHash, receipt.blockNumber);
  }
}
