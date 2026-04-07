CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SETTLED', 'EXPIRED', 'REFUNDED');

CREATE TABLE "Merchant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUri" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "allowedTokens" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentRecord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference" TEXT NOT NULL,
    "merchantId" UUID NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "txHash" TEXT,
    "payer" TEXT,
    "token" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3),
    "webhookFired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Merchant_address_key" ON "Merchant"("address");
CREATE UNIQUE INDEX "PaymentRecord_reference_key" ON "PaymentRecord"("reference");

ALTER TABLE "PaymentRecord"
ADD CONSTRAINT "PaymentRecord_merchantId_fkey"
FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
