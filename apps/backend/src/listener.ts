import { Contract, WebSocketProvider, hexlify, isHexString } from "ethers";

import { monadPayRouterAbi } from "@monadpay/sdk";
import { prisma } from "./db";
import { getRouterAddress } from "./config";
import { dispatchWebhook } from "./webhook";

type ListenerOptions = {
  wsUrl?: string;
  routerAddress?: string;
};

type ListenerHandle = {
  stop: () => Promise<void>;
};

function normalizeReference(value: unknown): string {
  if (typeof value === "string" && isHexString(value)) {
    return value.toLowerCase();
  }

  return hexlify(value as Uint8Array).toLowerCase();
}

function attachReconnect(
  provider: WebSocketProvider,
  reconnect: () => void
): void {
  const socket = (provider as unknown as {
    websocket?: { on?: (event: string, handler: () => void) => void };
  }).websocket;

  socket?.on?.("close", reconnect);
}

export function startPaymentListener(options: ListenerOptions = {}): ListenerHandle {
  const wsUrl = options.wsUrl ?? process.env.MONAD_RPC_URL ?? "";
  const routerAddress = options.routerAddress ?? getRouterAddress();

  if (!wsUrl || !routerAddress) {
    throw new Error("MONAD_RPC_URL and ROUTER_CONTRACT_ADDRESS are required");
  }

  let provider: WebSocketProvider | null = null;
  let contract: Contract | null = null;
  let closed = false;
  let reconnectDelay = 5_000;

  const connect = () => {
    if (closed) {
      return;
    }

    provider = new WebSocketProvider(wsUrl);
    contract = new Contract(routerAddress, monadPayRouterAbi, provider);

    const onPaymentReceived = async (
      paymentReference: unknown,
      payer: string,
      _merchant: string,
      token: string,
      amount: bigint,
      _memo: string,
      event: { log: { transactionHash: string } }
    ) => {
      try {
        const reference = normalizeReference(paymentReference);
        const existing = await prisma.paymentRecord.findUnique({
          where: { reference },
          include: { merchant: true },
        });

        if (!existing) {
          return;
        }

        const settledRecord = await prisma.paymentRecord.update({
          where: { id: existing.id },
          data: {
            status: "SETTLED",
            txHash: event.log.transactionHash,
            payer,
            token,
            amount: amount.toString(),
            settledAt: new Date(),
          },
          include: { merchant: true },
        });

        await dispatchWebhook(settledRecord);
      } catch (error) {
        console.error("[listener] failed to process PaymentReceived", error);
      }
    };

    contract.on("PaymentReceived", onPaymentReceived);

    attachReconnect(provider, () => {
      if (closed) {
        return;
      }

      console.warn(`[listener] websocket closed, reconnecting in ${reconnectDelay}ms`);
      contract?.off("PaymentReceived", onPaymentReceived);
      provider?.destroy();

      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
        connect();
      }, reconnectDelay);
    });
  };

  connect();

  return {
    stop: async () => {
      closed = true;
      contract?.removeAllListeners();
      provider?.destroy();
    },
  };
}
