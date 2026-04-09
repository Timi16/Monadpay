import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { DEFAULT_MONAD_CHAIN_ID } from "@monadpay/sdk";

type RouterDeployment = {
  router?: string;
  chainId?: number;
  rpcUrl?: string;
};

function getDeploymentCandidates(chainId: number): string[] {
  const explicitPath = process.env.MONADPAY_DEPLOYMENT_PATH;

  return [
    ...(explicitPath ? [path.resolve(process.cwd(), explicitPath)] : []),
    path.resolve(process.cwd(), "deployments", `router.${chainId}.json`),
    path.resolve(process.cwd(), "deployments", "router.json"),
  ];
}

function readRouterDeployment(chainId: number): RouterDeployment | null {
  for (const candidate of getDeploymentCandidates(chainId)) {
    if (!existsSync(candidate)) {
      continue;
    }

    const parsed = JSON.parse(readFileSync(candidate, "utf8")) as RouterDeployment;
    return parsed;
  }

  return null;
}

export function getMonadChainId(): number {
  const rawValue = process.env.MONAD_CHAIN_ID;
  const chainId = Number.parseInt(rawValue ?? "", 10);

  if (Number.isInteger(chainId) && chainId > 0) {
    return chainId;
  }

  return DEFAULT_MONAD_CHAIN_ID;
}

export function getRouterAddress(): string {
  const envAddress = process.env.ROUTER_CONTRACT_ADDRESS;
  if (envAddress) {
    return envAddress;
  }

  const deployment = readRouterDeployment(getMonadChainId());
  if (deployment?.router) {
    return deployment.router;
  }

  throw new Error(
    "ROUTER_CONTRACT_ADDRESS is missing and no deployment manifest was found in deployments/"
  );
}
