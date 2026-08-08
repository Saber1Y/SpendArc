# SpendArc Test Flow

End-to-end test flow for SpendArc on Arc Testnet.
Covers the contracts (factory + per-user vault), the backend control-plane API, the dashboard UI, and the autonomous AI agent flow.

## Product model (read this first)

Every visitor gets their **own** on-chain vault, funded with their **own** USDC, and their agent spends under a leash the visitor controls:

- The visitor's wallet is simultaneously the vault **owner** and the vault **agent**.
- The platform **executor** (server key) can only `executeSpendFor` within the leash - it can never change the policy, deposit, or withdraw.
- The factory deploys one vault per wallet (`vaultOf(owner)`), self-configured with the leash the visitor chose (max-per-tx, daily cap, expiry) and pre-allowlisted to USDC + the visitor's own address.

The operator-plane demo still exists on a shared vault for the owner's own agent.

## Live state (record this before every session)

- Factory: `0x47ad98eec8c771d514e5576f7738d43ea91ef7c2` (deployed via `script/DeployFactoryArc.s.sol`)
- Shared operator vault (legacy / owner plane): `0x0b860c25Dc6b2Df451AA66cFCdc7D6c6D7802F66`
- USDC: `0x3600000000000000000000000000000000000000` (6 decimals on this network)
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app` (tx: `/tx/<hash>`, address: `/address/<addr>`)
- Owner + executor + demo agent: `0x3F5b96A494061F7338Da529e3047809Ac6a7FB84` (Test Agent, policy 5/tx + 20/day on the shared vault)
- Faucet grant is **3 USDC + 0.05 gas** (temporary while the operator refills; see caveats)

Baseline snapshot (record deltas before/after every session):

```bash
curl -s http://localhost:3000/api/agents
curl -s http://localhost:3000/api/transactions
curl -s "http://localhost:3000/api/agent-runs"
```

## Prerequisites

- `web/.env.local` has `NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_VAULT_ADDRESS`,
  `EXECUTOR_PRIVATE_KEY`, `VAULT_OWNER_PRIVATE_KEY`, and Privy keys.
- `npm run dev` in `web/`, app served at http://localhost:3000.
- `forge` installed (repo root), `cast` available.

---

## Phase 0 - Contract and static checks

```bash
forge test                         # 60 tests in test/SpendArcVault.t.sol + test/SpendArcVaultFactory.t.sol
cd web && npm run typecheck
```

Covered by the suite: per-user vault creation (one per owner, duplicate revert, `maxPerTx <= dailyCap`
guard, executor lockout from policy/withdraw), deposit pulls USDC from the caller, within-leash
`executeSpendFor`, over-cap block, no-transfer block, and shared-vault spend/policy paths.

---

## Phase 1 - Backend API (the user-agent control plane)

Run with the dev server up. Generate a fresh, unregistered wallet for each cycle:

```bash
cast wallet new          # -> Address: 0x<NEW>, Private key: ...
```

### 1a. Create + fund a per-user vault (the on-chain half)

Create the vault with a leash (5/tx, 10/day), approve USDC, and deposit the visitor's own funds:

```bash
# 1. Faucet the wallet (operator signs; 3 USDC + 0.05 gas)
curl -s -X POST http://localhost:3000/api/fund -H 'content-type: application/json' -d '{"address":"0x<NEW>"}'

# 2. Create the vault via the factory (signs with the visitor key)
cast send 0x47ad98eec8c771d514e5576f7738d43ea91ef7c2 \
  'createVault(uint128,uint128,uint64)' 5000000 10000000 0 \
  --rpc-url https://rpc.testnet.arc.network --private-key <NEW_KEY>

# 3. Read back the vault address
cast call 0x47ad98eec8c771d514e5576f7738d43ea91ef7c2 \
  'vaultOf(address)(address)' 0x<NEW> --rpc-url https://rpc.testnet.arc.network

# 4. Approve + deposit (0x<VAULT> from step 3)
cast send 0x3600000000000000000000000000000000000000 'approve(address,uint256)' 0x<VAULT> 3000000 \
  --rpc-url https://rpc.testnet.arc.network --private-key <NEW_KEY>
cast send 0x<VAULT> 'deposit(uint256)' 3000000 \
  --rpc-url https://rpc.testnet.arc.network --private-key <NEW_KEY>
```

Verify the vault is self-configured (owner = agent = visitor, USDC allowlisted):

```bash
cast call 0x<VAULT> 'getPolicy(address)((uint128,uint128,uint128,uint64,uint64,bool))' 0x<NEW> --rpc-url https://rpc.testnet.arc.network
cast call 0x<VAULT> 'allowedToken(address,address)(bool)' 0x<NEW> 0x3600000000000000000000000000000000000000 --rpc-url https://rpc.testnet.arc.network
```

Expected: policy `(5e6, 1e7, 0, ..., 0, true)`, USDC allowlisted, vault holds 3 USDC.

### 1b. Register the agent (binds the wallet to its vault)

```bash
curl -s -X POST http://localhost:3000/api/agents/user \
  -H 'content-type: application/json' \
  -d '{"name":"Test Bot","address":"0x<NEW>","vaultAddress":"0x<VAULT>"}'
```

Expected: `201` with `{agent: {id, vaultAddress}, apiKey: "spend_...", policy: {maxPerTx: 5000000, dailyCap: 10000000}, vaultAddress, txHashes: []}`.
No owner-signed txs happen - the server verifies the vault on-chain (owner == caller, canonical USDC)
and mirrors its leash into the DB. The key is shown once and stored only as a hash.

### 1c. Introspect the leash (agent-facing auth)

```bash
curl -s http://localhost:3000/api/agents/me -H "Authorization: Bearer spend_<KEY>"
```

Expected: `{agent, policy: {maxPerTxUsdc: 5, dailyCapUsdc: 10, spentTodayUsdc: 0, active: true}, allowlists: {recipients: ["0x<NEW>"], tokens: [USDC]}}`.
No header or a bad key returns `401`.

### 1d. Spend with Bearer auth (vault funds, executor executes within leash)

```bash
curl -s -X POST http://localhost:3000/api/payments/request \
  -H 'content-type: application/json' -H "Authorization: Bearer spend_<KEY>" \
  -d '{"agentId":"agent_<ID>","recipient":"0x<NEW>","amount":"0.5","token":"USDC","purpose":"api test"}'
```

Expected: `{status: "APPROVED", executionStatus: "CONFIRMED", txHash: "0x...", network: "Arc Testnet"}`.
Re-check `getPolicy` - `spentToday` = 500000 and the vault balance dropped by 0.5 USDC.

Blocked paths (all return `BLOCKED` with a reason, no tx, no chain effect):

- `amount: "6"` -> `EXCEEDS_PER_TX_LIMIT` (5 USDC per-tx cap)
- `recipient: "0x1111...1111"` -> `RECIPIENT_NOT_ALLOWLISTED`

Auth negatives:

- Wrong or missing Bearer key -> `401 INVALID_API_KEY`
- Key belonging to a different agent than `agentId` -> `401`
- Same address through `/api/agents/user` again -> `409 ADDRESS_REGISTERED`

---

## Phase 2 - UI walkthrough

### 2.1 Login gate

Open the app in a fresh/incognito window.
A full-screen gate shows with "Connect wallet or sign in".
Connect via Privy -> dashboard with the address in the sidebar footer + Disconnect.
Log out -> back to the gate. No data renders pre-login.

### 2.2 Overview (/dashboard)

KPI cards should match the on-chain snapshot:
Total USDC Controlled, Spent Today, Remaining Daily, Approved/Blocked counts, Agent Status.
Spending Analytics chart, Recent Activity (last 5 txs, explorer links on confirmed),
Policy Health, Agent Health, and the Vault Funds card (deposit = 2 MetaMask txs, withdraw is owner-only).

### 2.3 Agents (/dashboard/agents) - the visitor flow

The dashboard is role-split. The vault owner gets the full operator plane.
A visitor (any other connected wallet) gets a user workspace with the 3-step vault onboarding:

1. **Step 1 - Create your vault.** Leash number inputs (default 5/tx, 10/day; clamped to 1-10/tx, 1-25/day,
   per-tx never above daily). "Create vault" signs `factoryAbi.createVault` via the connected wallet.
   The UI polls `vaultOf(address)` and shows the vault card (address + live USDC balance).
2. **Step 2 - Fund and deposit.** "Get testnet funds (0.05 gas + 3 USDC)" POSTs `/api/fund`.
   Enter a deposit amount (default 3), "Approve USDC", then "Deposit X USDC" (`vaultAbi.deposit`).
   The visitor's own money now sits in their own vault.
3. **Step 3 - Register your agent.** Name + POST `/api/agents/user` with `{name, address, vaultAddress}`.
   The API key box appears (shown once) plus a handoff prompt referencing "my SpendArc vault at <vault>".

Below the handoff, the visitor sees ONLY their own AgentCard, a Spending leash meter,
and their Transaction History. No other agents, no Vault Summary, no settlement details.

A returning visitor whose agent is already registered sees an "Agent registered for this wallet" note
plus their AgentCard and history (the key is gone by design).

### 2.4 Control (/dashboard/control) - owner plane

Launch demo / QA harness scenarios against Test Agent on the shared vault, streamed live.
Previous Runs lists runs for all agents with a live event feed.

### 2.5 Spending (/dashboard/spending) - owner plane

Manual operator spend form on the shared vault (no API key - operator path).
Blocked paths: amount 6 -> `EXCEEDS_PER_TX_LIMIT`; recipient `0x1111...` -> `RECIPIENT_NOT_ALLOWLISTED`.

### 2.6 Policies (/dashboard/policies)

- **Per-user vault agents:** the leash edit returns **unsigned calldata** for the visitor to sign in
  their own wallet (`/api/policies/{agentId}/update`). After the tx confirms, the UI calls
  `/api/policies/{agentId}/sync` to mirror the on-chain values into the DB.
  Clamped to 10/tx, 25/day, per-tx <= daily. A policy that diverges from the chain returns `ONCHAIN_MISMATCH` on sync.
- **Shared-vault agents (owner plane):** the server owner key signs the update directly.
- Server-Side Policy card is DB-only (instant, no wallet).
- Fence check: server allows 3.5 but on-chain cap rejects -> FAILED "reverted" (the on-chain fence is the backstop).

Verified live: visitor lowered 5/10 -> 0.1/1 on their own vault, signed in-wallet, synced
(`spent_today` preserved), then a 0.5 spend was blocked with `EXCEEDS_PER_TX_LIMIT`.

### 2.7 Allowlist (/dashboard/allowlist)

Per-user vaults are pre-allowlisted to USDC + the visitor's own address at creation.
Server-side adds/removes on the shared vault are instant and free; on-chain adds are owner-gated.

### 2.8 Payments (/dashboard/payments)

Settlement Network = Arc Testnet (5042002).
Stat cards: Total Settled = CONFIRMED count, Pending, Failed = FAILED + BLOCKED, Vault address.

### 2.9 Audit (/dashboard/audit)

Filter chips All / Created / Blocked. Every event has timestamp, action, entity, and flattened key=value details.

### 2.10 Settings (/dashboard/settings)

Network (Arc Testnet 5042002, RPC, explorer), Vault (copy button, owner, Arcscan link),
USDC token, wallet role pill, env values, System Health checks.

---

## Phase 3 - Autonomous AI agent (the booth demo)

The AI agent is the decision brain; SpendArc is the policy leash.
Run against the visitor's freshly-registered agent (their own vault).

### 3a. Harness (scripted scenarios, opencode brain)

```bash
cd web
node scripts/qa-agent.mjs --agent agent_<ID> \
  --qa scripts/qa-user-agent.md \
  --api-key spend_<KEY> \
  --model opencode/deepseek-v4-flash-free
```

Expected output: `Leash: ... 5 USDC/tx, 10 USDC/day` then 3 scenarios -> 3 passed, 0 failed:

1. Approved 0.5 USDC to self -> `APPROVED` + `CONFIRMED` + tx hash
2. 6 USDC -> `BLOCKED EXCEEDS_PER_TX_LIMIT`
3. 0.5 USDC to `0x1111...` -> `BLOCKED RECIPIENT_NOT_ALLOWLISTED`

### 3b. Handoff prompt (zero scripts - the real visitor flow)

1. Create the vault, fund + deposit, register in the UI, and copy the API key.
2. Copy the **Give this to your AI agent** prompt.
3. Paste it into any AI agent (opencode, ChatGPT, Claude):

```bash
opencode run -m opencode/deepseek-v4-flash-free "I am an autonomous agent. <paste handoff prompt>"
```

The agent introspects its leash, makes a 0.5 USDC payment from the visitor's own vault,
and reports the tx hash or the block reason.

### 3c. On-chain verification

```bash
cast call 0x<VAULT> 'getPolicy(address)((uint128,uint128,uint128,uint64,uint64,bool))' <AGENT_ADDR> --rpc-url https://rpc.testnet.arc.network
# spentToday should reflect every approved USDC; the vault balance should be deposit minus spends
curl -s http://localhost:3000/api/agents/me -H "Authorization: Bearer spend_<KEY>"
```

---

## Phase 4 - Cross-cutting and negative checks

- Auth: every `/dashboard/*` bounces to the gate when logged out; no data leaks pre-login.
- Viewer mode: a second wallet renders read-only - owner controls hidden.
- Bearer auth: wrong key -> `401`; mismatched key/agentId -> `401`; duplicate registration -> `409`.
- Per-user vault isolation: agent A's executor cannot spend agent B's vault (executor executes only
  within the vault the payment was routed to); one vault per owner (factory revert on duplicate).
- RPC resilience: hard-refresh while the RPC is rate-limited; reads should retry and populate instead of erroring.

---

## Known caveats (not bugs, but worth knowing)

- `POST /api/agents/user` is self-claimed - the wallet address is asserted by the caller,
  with no server-side wallet-proof yet. Fine for a testnet booth demo, not production.
- The faucet grant is temporarily **3 USDC + 0.05 gas** (`USDC_BASE = 3_000_000n` in `app/api/fund/route.ts`)
  while the operator refills. The UI labels/deposit default match 3. Restore to 10 when the operator is topped up.
- All external Arc USDC faucets are captcha/GitHub-gated (Circle, arc-faucet.dev, zkCodex), so the operator
  must be refilled manually or via the sim's recovered funds.
- The Arc RPC rate-limits raw tx submission; back-to-back txs need a short delay (`sim-visitor.mjs` sleeps ~1.2s).
- Arc pays gas from the same USDC balance, so a transfer of the full balance fails estimation;
  leave a ~0.4 USDC gas buffer (this is why `sim-visitor.mjs` and manual sweeps keep a reserve).
- The factory is one vault per owner, so repeat test runs need a fresh wallet (the sim generates one each run
  and prints the key for manual recovery).
- `web/sim-visitor.mjs` is the end-to-end reference: fund -> create vault -> deposit -> register ->
  introspect -> 0.5 spend -> leash edit (0.1/1) + sync -> overspend blocked -> withdraw + refund the operator.
- `/api/payments/request` accepts requests without a Bearer key (operator path).
  With a key present it must match the `agentId`.
- Policy is enforced in two stores: the server-side DB policy runs first (`evaluatePolicy`),
  then the on-chain vault policy is the backstop. A spend only succeeds when it passes both.
- The old vault (`0xf23147Df...`) is abandoned - its bytecode has no `withdrawTokens`, and its funds are stuck.
  Do not reference it as the production vault.
