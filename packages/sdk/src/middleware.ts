import type { Request, Response } from "express";

type MerchantMetadata = {
  label?: string;
  icon?: string;
};

type TransactionRequest = {
  to: string;
  data: string;
  value?: string;
};

export function handleTransactionRequest(
  buildTx: (payerAddress: string, req: Request) => Promise<TransactionRequest>,
  getMerchantMetadata: (req: Request) => Promise<MerchantMetadata> | MerchantMetadata = () => ({})
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    if (req.method === "GET") {
      const metadata = await getMerchantMetadata(req);
      res.json({
        label: metadata.label ?? "",
        icon: metadata.icon ?? "",
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
      const transaction = await buildTx(account, req);
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
