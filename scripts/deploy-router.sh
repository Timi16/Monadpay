#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

if ! command -v forge >/dev/null 2>&1; then
  echo "forge is required but not installed" >&2
  exit 1
fi

if [ -z "${MONAD_RPC_URL:-}" ]; then
  echo "MONAD_RPC_URL is required" >&2
  exit 1
fi

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "PRIVATE_KEY is required" >&2
  exit 1
fi

FORGE_ARGS="--rpc-url $MONAD_RPC_URL --broadcast"

if [ "${VERIFY_DEPLOYMENT:-0}" = "1" ]; then
  FORGE_ARGS="$FORGE_ARGS --verify"
fi

echo "Deploying MonadPayRouter using $MONAD_RPC_URL"
cd "$ROOT_DIR"

# shellcheck disable=SC2086
forge script script/Deploy.s.sol:DeployRouter $FORGE_ARGS "$@"

echo "Deployment complete. Manifests written to deployments/router.json and deployments/router.<chainId>.json"
