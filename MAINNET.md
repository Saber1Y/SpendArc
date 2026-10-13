# Mainnet deployment and go-live checklist

This document covers deploying SpendArc to **Arc mainnet** (chain id `5042`) and the security steps that must be in place before the app handles real USDC.

## Network

| Parameter | Value |
|-----------|-------|
| Chain id | `5042` |
| RPC | `https://rpc.mainnet.arc.io` |
| Explorer | `https://explorer.arc.io` |
| Gas token | USDC (native, 18 decimals) |
| USDC ERC-20 interface | `0x3600000000000000000000000000000000000000` (6 decimals) |

Arc uses USDC to pay gas, so the deployer and executor wallets each need a small USDC balance on Arc before they can transact.

## Keys

Use two **separate, fresh** mainnet keys. Do not reuse testnet keys.

- `VAULT_OWNER_PK` / `VAULT_OWNER_PRIVATE_KEY` - deploys the factory and the reference vault.
  It is used only by the Foundry deploy scripts and never by the running web app.
  Keep it offline after deployment.
- `EXECUTOR_PRIVATE_KEY` - the server key that submits `executeSpendFor`.
  It can only move value inside each agent's on-chain leash and can never change policy or withdraw, so its blast radius is bounded.

Neither key is ever committed. `.env`, `.env.*` and `cache/` are gitignored.

## 1. Build and test

```bash
forge build
forge test
```

All contract tests must pass before deploying.

## 2. Deploy (one command)

The only input you must provide is a funded Arc private key. From the repo root:

```bash
PRIVATE_KEY=0x<your-funded-key> ./deploy-mainnet.sh
```

This deploys the `SpendArcVaultFactory` and creates your own reference vault through it (a conservative $1/tx, $5/day leash), then prints the `NEXT_PUBLIC_FACTORY_ADDRESS` and `NEXT_PUBLIC_VAULT_ADDRESS` lines to paste into `web/.env.local`.
The whole deploy costs roughly $0.13-0.25 in USDC gas at current prices.

Recommended: pass a separate server signer so the executor key is not your deployer key:

```bash
PRIVATE_KEY=0x<deployer-key> EXECUTOR_ADDRESS=0x<executor-wallet> ./deploy-mainnet.sh
```

The script defaults the RPC to Arc mainnet and USDC to the native token; override with `ARC_RPC_URL` / `USDC_ADDRESS` if needed.
`script/DeployFactoryArc.s.sol` and `script/DeployArc.s.sol` remain available if you prefer to deploy the factory and a reference vault separately with explicit env vars.

## 4. Configure the web app

Copy `web/.env.example` to `web/.env.local` and fill in:

- `NEXT_PUBLIC_ARC_CHAIN_ID=5042`, `NEXT_PUBLIC_ARC_RPC_URL`, `NEXT_PUBLIC_ARC_EXPLORER_URL`.
- `NEXT_PUBLIC_FACTORY_ADDRESS` and `NEXT_PUBLIC_VAULT_ADDRESS` from the deploy output.
- `NEXT_PUBLIC_PRIVY_APP_ID`.
- `EXECUTOR_PRIVATE_KEY` (the executor key only - not the owner key).
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (required - see below).

Then update the contract table in `README.md` with the deployed addresses.

## 5. Provision Turso (required in production)

The server-side policy fence reads from a libSQL/Turso database.
A local SQLite file does not persist on serverless hosts, so the app refuses to start in production without `TURSO_DATABASE_URL`.
Provision a Turso database and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

## 6. Verify

```bash
cd web && npm install && npm run typecheck && npm run build && npm start
```

Then walk the full flow against mainnet with a few USDC:
create a vault, deposit, register an agent (one wallet signature), make one approved payment under the cap, and one blocked payment over the cap.
Confirm the approved spend emits `AgentActionApproved` and the blocked spend emits `AgentActionBlocked` and moves nothing.

## Security checklist (must be true before go-live)

These were addressed in the mainnet-hardening pass; re-verify after any change.

- [x] Payments require a valid agent API key (`Authorization: Bearer`); no key = `401`, never processed.
- [x] Agent registration requires a wallet-ownership signature over the canonical challenge; no shared-vault registration path.
- [x] The server allowlist/policy store is a read-only mirror of the chain; it is written only by the `/sync` endpoints after an owner-signed on-chain change is verified.
- [x] No server faucet. Users fund their own vaults.
- [x] `GET /api/agents` never returns the API-key hash or other secrets.
- [x] The vault performs no arbitrary calls: a spend with non-empty calldata reverts, and only ERC-20 USDC transfers move value.
- [x] A vault-blocked spend is recorded as failed/blocked, never as confirmed, because the executor decodes the receipt events.
- [x] The executor key and owner key are different, and the owner key is not used by the running app.
- [x] Turso is provisioned so the policy fence persists across deploys.
- [ ] Set conservative initial leash ceilings in `web/lib/policyLimits.ts` for the amount of USDC you are comfortable exposing.

## Not a substitute for a full audit

This hardening pass is a deadline-scoped review, appropriate for a microgrant demo with small caps.
It is not an audit-grade sign-off for holding significant user funds.
Commission a professional audit before raising the caps or onboarding real value at scale.
