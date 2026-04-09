export enum PaymentStatus {
  PENDING = "PENDING",
  SETTLED = "SETTLED",
  EXPIRED = "EXPIRED",
  REFUNDED = "REFUNDED",
}

export type PaymentRequest = {
  reference: string;
  recipient: string;
  amount: bigint;
  token: string;
  memo?: string;
  label?: string;
  message?: string;
  expiresAt?: number;
};

export type TransferRequestParams = PaymentRequest & {
  chainId: number;
};

export type TransactionRequestParams = {
  url: string;
  label?: string;
  icon?: string;
};

export type VerifyPaymentResult = {
  valid: boolean;
  txHash: string;
  blockNumber: number;
  payer: string;
  amount: bigint;
  token: string;
};

export type MerchantProfile = {
  address: string;
  name: string;
  logoUri: string;
  webhookUrl: string;
  allowedTokens: string[];
};

export type WebhookPayload = {
  reference: string;
  txHash: string;
  blockNumber: number;
  payer: string;
  merchant: string;
  token: string;
  amount: string;
  memo: string;
  settledAt: number;
};

export type PaymentRecord = {
  id: string;
  reference: string;
  merchantId: string;
  status: PaymentStatus;
  txHash?: string;
  payer?: string;
  token: string;
  amount: string;
  memo?: string;
  settledAt?: number;
  webhookFired: boolean;
};

export type PaymentTransaction = {
  to: string;
  data: string;
  value: string;
};
