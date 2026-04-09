# MonadPay

MonadPay is a Solana Pay style payment flow for Monad EVM, split into contracts, an SDK, and a webhook-driven backend.
Merchant identity is multi-tenant and database-backed; merchant metadata is not global `.env` config.
The SDK now owns the router/escrow ABI surface and can build wallet-ready calldata for backend transaction request endpoints.

## Architecture

```text
+--------+      +----------------+      +-------+      +----------+      +----+      +---------+      +----------+
| Wallet | ---> | MonadPayRouter | ---> | Event | ---> | Listener | ---> | DB | ---> | Webhook | ---> | Merchant |
+--------+      +----------------+      +-------+      +----------+      +----+      +---------+      +----------+
```

## Quickstart

1. Clone the repo.
2. Install Foundry.
3. Run `yarn install`.
4. Copy `.env.example` to `.env`.
5. Run `forge test --offline`.
6. Deploy with `yarn deploy:router`.
7. Confirm `deployments/router.json` or `ROUTER_CONTRACT_ADDRESS` is available for the backend.
8. Start the backend with `yarn workspace @monadpay/backend dev`.

## Live Deployment

`yarn deploy:router` loads `.env`, requires `MONAD_RPC_URL` and `PRIVATE_KEY`, runs the Foundry deploy script, and writes:

- `deployments/router.json`
- `deployments/router.<chainId>.json`

Optional:

- Set `VERIFY_DEPLOYMENT=1` to append `--verify`
- Pass extra `forge script` args after the command, for example `yarn deploy:router -- --resume`

## SDK Example

```ts
const request = await createTransferRequest(params);
console.log(request.url);

const tx = buildPaymentTransaction({
  routerAddress,
  recipient: params.recipient,
  token: params.token,
  amount: params.amount,
  reference: params.reference,
  memo: params.memo,
});
console.log(tx);

const result = await verifyPayment(txHash, params.reference, routerAddress, provider);
console.log(result.valid);
```

## Payment URL Format

`monadpay:<recipient>?amount=<value>&token=<address>&reference=<bytes32>&chainId=<id>&memo=<encoded>&label=<encoded>&message=<encoded>&expiresAt=<unix>`

## Webhook Payload

```json
{
  "reference": "0x...",
  "txHash": "0x...",
  "blockNumber": 0,
  "payer": "0x...",
  "merchant": "0x...",
  "token": "0x...",
  "amount": "1000000000000000000",
  "memo": "",
  "settledAt": 1712428800
}
```

## Transaction Request Endpoint

The backend exposes `GET` and `POST /api/payment/:reference/transaction`.
`GET` returns merchant label/icon metadata and `POST` returns a router transaction payload with `to`, `data`, `value`, and `chainId`.

## API Docs

Frontend-facing OpenAPI docs are available at:

- `GET /api/openapi.json`
- `GET /api/docs`

There is also a repo guide at [docs/frontend-integration.md](/Users/ik/Documents/Monadpay/docs/frontend-integration.md).

## Testnet Contract

Deployment template: `https://explorer.monad.xyz/address/$ROUTER_CONTRACT_ADDRESS`
