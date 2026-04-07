import { createServer } from "node:http";

import { prisma } from "./db";
import { startPaymentListener } from "./listener";
import { createApp } from "./app";

export const app = createApp();

export function listen(port = Number(process.env.PORT ?? 3001)) {
  const server = createServer(app);
  server.listen(port, () => {
    console.log(`MonadPay backend listening on ${port}`);
  });

  const listener = startPaymentListener();

  const shutdown = async () => {
    await listener.stop();
    await prisma.$disconnect();
    server.close();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return server;
}

if (require.main === module) {
  listen();
}
