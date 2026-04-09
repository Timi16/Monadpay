const paymentRecordSchema = {
  type: "object",
  required: [
    "id",
    "reference",
    "merchantId",
    "status",
    "token",
    "amount",
    "webhookFired",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    reference: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
    merchantId: { type: "string", format: "uuid" },
    status: {
      type: "string",
      enum: ["PENDING", "SETTLED", "EXPIRED", "REFUNDED"],
    },
    txHash: { type: "string", nullable: true },
    payer: { type: "string", nullable: true },
    token: { type: "string" },
    amount: { type: "string" },
    memo: { type: "string", nullable: true },
    settledAt: { type: "string", format: "date-time", nullable: true },
    webhookFired: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
  },
} as const;

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "MonadPay Backend API",
    version: "0.1.0",
    description:
      "Solana Pay-style payment API for Monad. Frontends create payment intents, fetch transaction payloads, and verify settlement against the live router deployment.",
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Local backend",
    },
  ],
  tags: [
    { name: "Payments" },
    { name: "Merchants" },
    { name: "System" },
  ],
  paths: {
    "/api/config": {
      get: {
        tags: ["System"],
        summary: "Read active chain and router configuration",
        responses: {
          "200": {
            description: "Current backend config",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["chainId", "routerAddress"],
                  properties: {
                    chainId: { type: "integer" },
                    routerAddress: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/payment/create": {
      post: {
        tags: ["Payments"],
        summary: "Create a payment intent and payment URL",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["merchantId", "amount", "token"],
                properties: {
                  merchantId: { type: "string", format: "uuid" },
                  amount: {
                    type: "string",
                    description: "Token amount in smallest units as a base-10 integer string",
                  },
                  token: { type: "string" },
                  memo: { type: "string" },
                  expiresAt: {
                    type: "integer",
                    description: "Unix timestamp in seconds",
                  },
                },
              },
              examples: {
                erc20: {
                  value: {
                    merchantId: "6b5d0cfd-4cda-4dc0-8b16-4b6a64f2f6a5",
                    amount: "1000000000000000000",
                    token: "0x0000000000000000000000000000000000000000",
                    memo: "order-124",
                    expiresAt: 1_900_000_000,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Payment intent created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "reference",
                    "url",
                    "qrPng",
                    "routerAddress",
                    "transactionRequestUrl",
                  ],
                  properties: {
                    reference: { type: "string", pattern: "^0x[a-fA-F0-9]{64}$" },
                    url: { type: "string" },
                    qrPng: {
                      type: "string",
                      description: "Base64-encoded PNG bytes",
                    },
                    routerAddress: { type: "string" },
                    transactionRequestUrl: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid payload or token not enabled",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Merchant not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/payment/{reference}": {
      get: {
        tags: ["Payments"],
        summary: "Fetch a stored payment record",
        parameters: [
          {
            name: "reference",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Payment record",
            content: {
              "application/json": {
                schema: paymentRecordSchema,
              },
            },
          },
          "404": {
            description: "Payment not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/payment/{reference}/verify": {
      get: {
        tags: ["Payments"],
        summary: "Verify a payment transaction against the router event log",
        parameters: [
          {
            name: "reference",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "txHash",
            in: "query",
            required: false,
            schema: { type: "string" },
            description:
              "Required if the payment is not already settled and no txHash is stored yet.",
          },
        ],
        responses: {
          "200": {
            description: "Verification result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["valid", "txHash", "blockNumber", "payer", "amount", "token"],
                  properties: {
                    valid: { type: "boolean" },
                    txHash: { type: "string" },
                    blockNumber: { type: "integer" },
                    payer: { type: "string" },
                    amount: { type: "string" },
                    token: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing txHash",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/payment/{reference}/transaction": {
      get: {
        tags: ["Payments"],
        summary: "Fetch transaction-request metadata for wallet UX",
        parameters: [
          {
            name: "reference",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Merchant metadata for wallet request flows",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["label", "icon"],
                  properties: {
                    label: { type: "string" },
                    icon: { type: "string" },
                  },
                },
              },
            },
          },
          "404": {
            description: "Payment not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "Payment is no longer payable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Payments"],
        summary: "Build the router calldata for a wallet to submit",
        parameters: [
          {
            name: "reference",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["account"],
                properties: {
                  account: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Wallet-ready transaction payload",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["transaction"],
                  properties: {
                    transaction: {
                      type: "object",
                      required: ["to", "data", "value", "chainId"],
                      properties: {
                        to: { type: "string" },
                        data: { type: "string" },
                        value: { type: "string" },
                        chainId: { type: "string", nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Missing account",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Payment not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "Payment is no longer payable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/merchant/register": {
      post: {
        tags: ["Merchants"],
        summary: "Create or update a merchant profile",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["address", "name", "logoUri", "webhookUrl", "allowedTokens"],
                properties: {
                  address: { type: "string" },
                  name: { type: "string" },
                  logoUri: { type: "string" },
                  webhookUrl: { type: "string", format: "uri" },
                  allowedTokens: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Merchant record",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "id",
                    "address",
                    "name",
                    "logoUri",
                    "webhookUrl",
                    "allowedTokens",
                    "createdAt",
                  ],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    address: { type: "string" },
                    name: { type: "string" },
                    logoUri: { type: "string" },
                    webhookUrl: { type: "string" },
                    allowedTokens: {
                      type: "array",
                      items: { type: "string" },
                    },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid merchant payload",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/merchant/{id}/payments": {
      get: {
        tags: ["Merchants"],
        summary: "List merchant payments",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
          {
            name: "from",
            in: "query",
            required: false,
            schema: { type: "integer" },
            description: "Unix timestamp in seconds",
          },
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: ["PENDING", "SETTLED", "EXPIRED", "REFUNDED"],
            },
          },
        ],
        responses: {
          "200": {
            description: "Payment list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: paymentRecordSchema,
                },
              },
            },
          },
        },
      },
    },
    "/api/merchant/{id}/stats": {
      get: {
        tags: ["Merchants"],
        summary: "Read 30-day settlement stats for a merchant",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Stats payload",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["totalVolume", "count", "dailySeries"],
                  properties: {
                    totalVolume: {
                      type: "object",
                      additionalProperties: { type: "string" },
                    },
                    count: { type: "integer" },
                    dailySeries: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["date", "count", "volume"],
                        properties: {
                          date: { type: "string" },
                          count: { type: "integer" },
                          volume: {
                            type: "object",
                            additionalProperties: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/webhook/retry/{paymentId}": {
      post: {
        tags: ["Payments"],
        summary: "Retry webhook delivery for a settled payment",
        parameters: [
          {
            name: "paymentId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Webhook retried",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ok"],
                  properties: {
                    ok: { type: "boolean" },
                  },
                },
              },
            },
          },
          "404": {
            description: "Payment not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
} as const;
