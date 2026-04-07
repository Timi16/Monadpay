import { createHmac } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { BaseContract, ContractTransactionResponse } from "ethers";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import mockErc20Artifact from "../../../contracts/out/MockERC20.sol/MockERC20.json";
import routerArtifact from "../../../contracts/out/MonadPayRouter.sol/MonadPayRouter.json";
import { prisma } from "./db";
import { startPaymentListener } from "./listener";

const hasAnvil = spawnSync("anvil", ["--version"], { stdio: "ignore" }).status === 0;
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runIntegration = hasAnvil && hasDatabase;
const describeIntegration = runIntegration ? describe : describe.skip;

type RouterContract = BaseContract & {
  waitForDeployment(): Promise<RouterContract>;
  getAddress(): Promise<string>;
  payWithToken(
    paymentReference: string,
    merchant: string,
    token: string,
    amount: bigint,
    memo: string
  ): Promise<ContractTransactionResponse>;
};

type MockTokenContract = BaseContract & {
  waitForDeployment(): Promise<MockTokenContract>;
  getAddress(): Promise<string>;
  mint(to: string, amount: bigint): Promise<ContractTransactionResponse>;
  approve(spender: string, amount: bigint): Promise<ContractTransactionResponse>;
};

describeIntegration("listener integration", () => {
  const httpUrl = "http://127.0.0.1:8547";
  const wsUrl = "ws://127.0.0.1:8547";
  const merchantAddress = "0x000000000000000000000000000000000000bEEF";
  const anvilKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  let anvil: ReturnType<typeof spawn>;
  let provider: JsonRpcProvider;
  let wallet: Wallet;
  let webhookApp: ReturnType<typeof express>;
  let webhookServer: Server;
  let webhookUrl = "";
  let receivedBody = "";
  let receivedSignature = "";

  beforeAll(async () => {
    process.env.WEBHOOK_SECRET = "test-secret";
    anvil = spawn("anvil", ["--port", "8547"], {
      stdio: "ignore",
    });

    provider = new JsonRpcProvider(httpUrl);
    wallet = new Wallet(anvilKey, provider);

    for (let index = 0; index < 20; index += 1) {
      try {
        await provider.getBlockNumber();
        break;
      } catch {
        await delay(250);
      }
    }

    webhookApp = express();
    webhookApp.use(express.json());
    webhookApp.post("/webhook", (req, res) => {
      receivedBody = JSON.stringify(req.body);
      receivedSignature = String(req.headers["x-monadpay-signature"] ?? "");
      res.status(200).json({ ok: true });
    });

    webhookServer = webhookApp.listen(0);
    const address = webhookServer.address() as AddressInfo;
    webhookUrl = `http://127.0.0.1:${address.port}/webhook`;
  }, 30_000);

  afterAll(async () => {
    await prisma.paymentRecord.deleteMany();
    await prisma.merchant.deleteMany();
    await prisma.$disconnect();
    webhookServer.close();
    anvil.kill("SIGTERM");
  });

  it(
    "updates the payment record and fires a signed webhook",
    async () => {
      const routerFactory = new ContractFactory(
        routerArtifact.abi,
        routerArtifact.bytecode.object,
        wallet
      );
      const router = (await routerFactory.deploy()) as RouterContract;
      await router.waitForDeployment();

      const tokenFactory = new ContractFactory(
        mockErc20Artifact.abi,
        mockErc20Artifact.bytecode.object,
        wallet
      );
      const token = (await tokenFactory.deploy()) as MockTokenContract;
      await token.waitForDeployment();

      const reference =
        "0x9999999999999999999999999999999999999999999999999999999999999999";

      const merchant = await prisma.merchant.create({
        data: {
          address: merchantAddress,
          name: "Merchant",
          logoUri: "https://example.com/logo.png",
          webhookUrl,
          allowedTokens: [await token.getAddress()],
        },
      });

      await prisma.paymentRecord.create({
        data: {
          reference,
          merchantId: merchant.id,
          status: "PENDING",
          token: await token.getAddress(),
          amount: "1000",
        },
      });

      const listener = startPaymentListener({
        wsUrl,
        routerAddress: await router.getAddress(),
      });

      await token.mint(await wallet.getAddress(), 1000n);
      await token.approve(await router.getAddress(), 1000n);
      const tx = await router.payWithToken(
        reference,
        merchantAddress,
        await token.getAddress(),
        1000n,
        "memo"
      );
      await tx.wait();

      for (let index = 0; index < 15; index += 1) {
        const payment = await prisma.paymentRecord.findUnique({
          where: { reference },
        });

        if (payment?.status === "SETTLED" && payment.webhookFired) {
          break;
        }

        await delay(200);
      }

      const settledPayment = await prisma.paymentRecord.findUnique({
        where: { reference },
      });

      expect(settledPayment?.status).toBe("SETTLED");
      expect(receivedBody).not.toBe("");
      expect(receivedSignature).toBe(
        createHmac("sha256", "test-secret").update(receivedBody).digest("hex")
      );

      await listener.stop();
    },
    30_000
  );
});
