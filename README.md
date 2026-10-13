<div align="center">

# SpendArc

**Agent Spending Control Plane**

Policy-checked spend vaults for autonomous agents on **Arc**. Anyone gets their own vault
in minutes: pick a leash, fund it with USDC, and hand any AI agent a scoped API key. The agent holds
nothing - a funded vault enforces caps, allowlists, daily limits and dedup on-chain, while a
server-side policy gate blocks off-policy calls before they ever touch the chain.

[Architecture](./architecture.md) · [Security](./security.md) · [Adversarial Testing](./adversarialtesting.md) · [Mainnet Deploy](./MAINNET.md)

`Arc mainnet 5042` · `Solidity` · `Foundry` · `Next.js` · `viem` · `MIT`

</div>

---

## The idea

Autonomous agents need to move money to act - pay a vendor, settle a task, swap on a DEX. Hand one an
unrestricted key and a single prompt injection, hallucinated action, or runaway loop can drain it.

SpendArc gives the agent a wallet that **holds nothing** and can only ever move value **inside policy**.
The product is self-serve:

1. **Create your vault.** One signature deploys a vault owned by *your* wallet (via the
   `SpendArcVaultFactory`, one vault per wallet). It is pre-configured with the leash you chose -
   max per transaction, daily cap, expiry - and pre-allowlisted to USDC and your own address.
2. **Fund it.** You deposit USDC into the vault from your own wallet (Arc uses USDC for gas, so a
   small USDC balance covers both). The agent can only spend what is in the vault - it never holds a
   balance itself.
3. **Hand your agent a key.** Register the agent and mint a one-time API key. Any AI agent (opencode,
   ChatGPT, Claude) introspects its leash and makes payments inside it. The visitor owns the vault, so
   tightening the leash or allowlisting a **third-party service** are signed in *their* wallet, then
   mirrored to the server. Each allowed service can carry its own **per-service budget** (per-tx and
   daily) enforced by the server fence on top of the vault's leash.

Operators get a **fleet control plane** on top of the self-serve flow: every agent wallet in one view,
per-agent leashes and balances, a full audit trail of every approved/blocked decision, and policy
changes (lower a leash, revoke an agent) applied per agent from a single console.

Every payment is enforced by **two independent fences**:

- **Fence 1 - control plane (server).** Every payment request is checked against the app's policy store
  (active, not expired, per-tx cap, daily cap, per-service budgets, recipient and token allowlists) before
  anything is sent to
  the chain. An off-policy request is answered with a structured `BLOCKED` decision and never broadcast.
- **Fence 2 - contract layer (`SpendArcVault`).** Any `executeSpend` call is re-checked against the full
  on-chain policy (active, expiry, token allowed, target allowed, per-tx cap, daily cap, dedup via a unique
  `actionId`) **before** a single micro-unit of USDC moves. Blocked actions emit an on-chain
  `AgentActionBlocked` record and move nothing - no revert, no state change.

Neither fence substitutes the other. See **[architecture.md](./architecture.md)** for the full design and
**[security.md](./security.md)** for the guarantees and threat model.

## Live on Arc mainnet 5042

RPC `https://rpc.mainnet.arc.io` · Explorer `https://explorer.arc.io`

| Contract | Address |
|----------|---------|
| **SpendArcVaultFactory** | `<fill in after mainnet deploy>` |
| **SpendArcVault (reference)** | `<fill in after mainnet deploy>` |
| **USDC (native ERC-20 interface)** | [`0x3600000000000000000000000000000000000000`](https://explorer.arc.io/address/0x3600000000000000000000000000000000000000) |

Every visitor gets their own vault from the factory. See **[MAINNET.md](./MAINNET.md)** for the deploy
steps and for recording the live factory address, create-vault tx, deposit tx, and an approved +
blocked spend pair once deployed.

## Try it in your own wallet

Open the live app and walk through the full flow - connect, create a vault with a leash, deposit
USDC, register an agent (one wallet signature proves ownership), and hand the scoped API key to a
real AI agent. Every step is real and on-chain.

## Repository layout

```
src/                      Solidity - SpendArcVaultFactory.sol, SpendArcVault.sol, MockUSD.sol
test/                     Foundry suite (unit + per-service budget tests)
script/                   deploy scripts (DeployFactoryArc, DeployArc)
web/                      Next.js frontend (marketing + dashboard + API routes)
lib/                      vendored deps (OpenZeppelin, forge-std)
MAINNET.md                mainnet deployment + go-live checklist
```

## Quick start

```bash
# Contracts - build + test (Foundry)
forge build
forge test

# Frontend - marketing + dashboard + API
cd web && npm install && npm run dev   # http://localhost:3000
```

Copy `web/.env.example` to `web/.env.local` and fill in the Arc RPC/chain id, the deployed factory and
reference vault addresses, the Privy app ID, the `EXECUTOR_PRIVATE_KEY` that broadcasts vault spends,
and the Turso credentials. `VAULT_OWNER_PRIVATE_KEY` is used only by the deploy scripts, never by the
running app, and must be a different key from the executor. The dashboard is fully live in read-only
mode without the server keys; owner-write controls use the connected wallet. See
**[MAINNET.md](./MAINNET.md)** for the full go-live checklist.

Users fund their own vaults by depositing USDC from their wallet - there is no server faucet. The
factory allows one vault per owner.

## Documentation

- **[architecture.md](./architecture.md)** - the two fences, components, the payment lifecycle.
- **[security.md](./security.md)** - guarantees, threat model, and key management.
- **[adversarialtesting.md](./adversarialtesting.md)** - the test strategy: unit, differential fuzz,
  fork-against-real-chain, and on-chain acceptance.
- **[MAINNET.md](./MAINNET.md)** - mainnet deployment steps and the pre-submission checklist.

## License

[MIT](./LICENSE).
