# MonadPay Frontend Integration

The frontend integration flow is:

1. Call `GET /api/config` on app boot to read `chainId` and `routerAddress`.
2. Create or select a merchant profile with `POST /api/merchant/register`.
3. Create a payment with `POST /api/payment/create`.
4. Render the returned `url` as QR and keep the `reference`.
5. For wallet-based checkout, call `GET /api/payment/:reference/transaction` for label/icon metadata.
6. Then call `POST /api/payment/:reference/transaction` with `{ "account": "<payer-address>" }`.
7. Submit the returned `transaction` via the wallet.
8. Poll `GET /api/payment/:reference` or `GET /api/payment/:reference/verify?txHash=...` until settled.

Useful backend outputs:

- `url`: MonadPay URI for QR/deep-link payment flows.
- `qrPng`: Base64 PNG if the frontend does not want to generate QR itself.
- `transactionRequestUrl`: Wallet-friendly endpoint for direct transaction payload generation.
- `routerAddress`: Live router contract address resolved by the backend.

OpenAPI / Swagger:

- Live backend spec: `GET /api/openapi.json`
- Repo source: [apps/backend/src/openapi.ts](/Users/ik/Documents/Monadpay/apps/backend/src/openapi.ts)

Wallet POST example:

```json
{
  "account": "0x000000000000000000000000000000000000dEaD"
}
```

Transaction response example:

```json
{
  "transaction": {
    "to": "0xRouterAddress",
    "data": "0x...",
    "value": "0x0",
    "chainId": "10143"
  }
}
```
