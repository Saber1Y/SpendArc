#!/usr/bin/env bash
#
# One-command SpendArc deploy to Arc mainnet.
#
# The ONLY input you must provide is a funded Arc private key:
#
#   PRIVATE_KEY=0x<your-funded-key> ./deploy-mainnet.sh
#
# Optional:
#   EXECUTOR_ADDRESS=0x...   separate server signer (recommended for production; defaults to deployer)
#   ARC_RPC_URL=...          override RPC (defaults to Arc mainnet)
#
# Arc pays gas in USDC, so the key must hold a little USDC (~$0.25 covers the whole deploy).
#
set -euo pipefail

RPC="${ARC_RPC_URL:-https://rpc.mainnet.arc.io}"

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "error: set PRIVATE_KEY to a funded Arc private key, e.g.:" >&2
  echo "  PRIVATE_KEY=0xabc123... ./deploy-mainnet.sh" >&2
  exit 1
fi

command -v forge >/dev/null 2>&1 || { echo "error: forge (Foundry) not found on PATH." >&2; exit 1; }

DEPLOYER=$(cast wallet address --private-key "$PRIVATE_KEY")
BAL_WEI=$(cast balance "$DEPLOYER" --rpc-url "$RPC")
BAL_USDC=$(cast to-unit "$BAL_WEI" ether)

echo "Deployer:     $DEPLOYER"
echo "USDC balance: $BAL_USDC  (gas on Arc is paid in USDC)"
echo "RPC:          $RPC"
echo "Executor:     ${EXECUTOR_ADDRESS:-$DEPLOYER}$([ -z "${EXECUTOR_ADDRESS:-}" ] && echo '  (defaulting to deployer - set EXECUTOR_ADDRESS for a separate production signer)')"
echo

if [ "$BAL_WEI" = "0" ]; then
  echo "error: deployer has no USDC on Arc - fund it before deploying." >&2
  exit 1
fi

read -r -p "Deploy the factory + your reference vault to this chain? [y/N] " ok
case "$ok" in
  y|Y|yes|YES) ;;
  *) echo "aborted."; exit 1 ;;
esac

forge script script/DeployMainnet.s.sol \
  --rpc-url "$RPC" \
  --broadcast \
  -vvv

echo
echo "Done. Copy the NEXT_PUBLIC_FACTORY_ADDRESS / NEXT_PUBLIC_VAULT_ADDRESS lines above into web/.env.local,"
echo "then update the contract table in README.md."
