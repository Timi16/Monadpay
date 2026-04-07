import type { Request, Response } from "express";

export function handleTransactionRequest(
  buildTx: (payerAddress: string) => Promise<{ to: string; data: string; value?: string }>
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    if (req.method === "GET") {
      res.json({
        label: process.env.MERCHANT_NAME ?? "",
        icon: process.env.MERCHANT_ICON_URL ?? "",
      });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "method not allowed" });
      return;
    }

    const account = typeof req.body?.account === "string" ? req.body.account : "";
    if (!account) {
      res.status(400).json({ error: "missing account" });
      return;
    }

    try {
      const transaction = await buildTx(account);
      res.json({
        transaction: {
          ...transaction,
          chainId: process.env.MONAD_CHAIN_ID,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "failed to build transaction",
      });
    }
  };
}
