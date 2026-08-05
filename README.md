<div align="center">

# SpendArc

**Agent Spending Control Plane**

Policy-checked spend vaults for autonomous agents on **Arc testnet**. The agent holds
nothing - a funded vault enforces caps, allowlists, daily limits and dedup on-chain,
while a server-side policy gate blocks off-policy calls before they ever touch the chain.

[Architecture](./architecture.md) · [Security](./security.md) · [Adversarial Testing](./adversarialtesting.md)

`Arc testnet 5042002` · `Solidity` · `Foundry` · `Next.js` · `viem` · `MIT`

</div>

---

## The idea

Autonomous agents need to move money to act - pay a vendor, settle a task, swap on a DEX. Hand one an
unrestricted key and a single prompt injection, hallucinated action, or runaway loop can drain it.

SpendArc gives the agent a wallet that **holds nothing** and can only ever move value **inside policy**,
enforced by **two independent fences**:

- **Fence 1 - control plane (server).** Every payment request is checked against the app's policy store
  (active, not expired, per-tx cap, daily cap, recipient and token allowlists) before anything is sent to
  the chain. An off-policy request is answered with a structured `BLOCKED` decision and never broadcast.
- **Fence 2 - contract layer (`SpendArcVault`).** Any `executeSpend` call is re-checked against the full
  on-chain policy (active, expiry, token allowed, target allowed, per-tx cap, daily cap, dedup via a unique
  `actionId`) **before** a single micro-unit of USDC moves. Blocked actions emit an on-chain `AgentActionBlocked`
  record and move nothing - no revert, no state change.

Neither fence substitutes the other. See **[architecture.md](./architecture.md)** for the full design and
**[security.md](./security.md)** for the guarantees and threat model.

## Live on Arc testnet 5042002

RPC `https://rpc.testnet.arc.network` · Explorer `https://testnet.arcscan.app`

| Contract | Address |
|----------|---------|
| **SpendArcVault** | [`0xf23147Df55089eA6bA87BF24bb4eEE6f7Cea182b`](https://testnet.arcscan.app/address/0xf23147Df55089eA6bA87BF24bb4eEE6f7Cea182b) |
| **Agent / owner** | [`0x3F5b96A494061F7338Da529e3047809Ac6a7FB84`](https://testnet.arcscan.app/address/0x3F5b96A494061F7338Da529e3047809Ac6a7FB84) |
| **USDC (testnet)** | [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) |

### Proven on-chain artifacts

- **Approved spend** (1.5 USDC, under the 5 USDC per-tx cap): tx
  [`0xa1295391…`](https://testnet.arcscan.app/tx/0xa12953915fba548cb16128bb53fa5c51c406f7d051a922db8dc0b2be3678ad5b)
- **Blocked-by-policy** (6 USDC vs the 5 USDC cap - `AgentActionBlocked`, nothing moved): tx
  [`0x892fa9cf…`](https://testnet.arcscan.app/tx/0x892fa9cf430c86a1fa5266ca2ca1b9617694ce1579fa223e672bf67c652fc81b)

The two are the *same* agent with one variable changed (1.5 USDC vs 6 USDC against the 5 USDC cap) - the
difference lives entirely in the on-chain events and the untouched balances. The marketing site reads both
receipts live on every page load.

## Repository layout

```
src/                      Solidity - SpendArcVault.sol
test/                     Foundry suite (unit + fork tests)
script/                   deploy scripts (DeployArc, ...)
client/                   TypeScript agent client (viem)
web/                      Next.js frontend (marketing + dashboard + API routes)
lib/                      vendored deps (OpenZeppelin, forge-std)
foundry.toml              evm_version
```

## Quick start

```bash
# Contracts - build + test (Foundry)
forge build
forge test

# Frontend - marketing + dashboard + API
cd web && npm install && npm run dev   # http://localhost:3000
```

Copy `web/.env.example` to `web/.env.local` and fill in the Arc RPC, the deployed vault address, the
Privy app ID, and the two signer keys (`EXECUTOR_PRIVATE_KEY` broadcasts vault spends, the vault owner key
configures policy). The dashboard is fully live in read-only mode without them; owner-write controls need
the owner wallet connected.

## Documentation

- **[architecture.md](./architecture.md)** - the two fences, components, the payment lifecycle.
- **[security.md](./security.md)** - guarantees, threat model, and key management.
- **[adversarialtesting.md](./adversarialtesting.md)** - the test strategy: unit, differential fuzz,
  fork-against-real-chain, and on-chain acceptance.

## License

[MIT](./LICENSE).
