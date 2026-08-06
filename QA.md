# SpendArc Test Flow

End-to-end test flow for SpendArc on Arc Testnet.
Covers the contract, the backend control-plane API, the dashboard UI, and the autonomous AI agent flow.
Run every UI step with the vault owner wallet connected (unless a step says otherwise).

## Live state (record this before every session)

- Vault: `0x0b860c25Dc6b2Df451AA66cFCdc7D6c6D7802F66` (deployed, funded ~15 USDC)
- USDC: `0x3600000000000000000000000000000000000000`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app` (tx: `/tx/<hash>`, address: `/address/<addr>`)
- Owner + executor + demo agent: `0x3F5b96A494061F7338Da529e3047809Ac6a7FB84` (Test Agent `agent_c720ee6d`, policy 5/tx + 20/day)
- Registered user agent (test artifact): Booth AI Agent `agent_8e3edcd8` at `0x71a56f6c2AF6eA95fFBD5AF0cfd8775A53b4D0c5` (policy 1/tx + 2/day)
- Vault USDC is consumed by approved spends and the demo.
  Top up by transferring USDC to the vault; the owner key pays all gas.

Baseline snapshot (record deltas before/after every session):

```bash
curl -s http://localhost:3000/api/agents
curl -s http://localhost:3000/api/transactions
curl -s "http://localhost:3000/api/agent-runs"
```

## Prerequisites

- `web/.env.local` has `NEXT_PUBLIC_VAULT_ADDRESS=0x0b860c25Dc6b2Df451AA66cFCdc7D6c6D7802F66`,
  `EXECUTOR_PRIVATE_KEY`, `VAULT_OWNER_PRIVATE_KEY`, and Privy keys.
- `npm run dev` in `web/`, app served at http://localhost:3000.
- `forge` installed (repo root), `cast` available.

---

## Phase 0 - Contract and static checks

```bash
forge test                         # 8 tests in test/SpendArcVault.t.sol
cd web && npm run typecheck && npm run build
```

Covered by the suite: executor spend (`executeSpendFor`), owner spend, non-authorized revert,
over-cap block, target-not-allowlisted block, inactive agent, duplicate action, caller-vs-agent policy.

---

## Phase 1 - Backend API (the user-agent control plane)

Run with the dev server up. Generate a fresh, unregistered wallet for each cycle:

```bash
cast wallet new          # -> Address: 0x<NEW>, Private key: ...
```

### 1a. Register a user agent

```bash
curl -s -X POST http://localhost:3000/api/agents/user \
  -H 'content-type: application/json' \
  -d '{"name":"Test Bot","address":"0x<NEW>"}'
```

Expected: `201` with `{agent: {id, address}, apiKey: "spend_...", policy, txHashes: [3 tx]}`.
The key is shown once and stored only as a hash.

Verify the on-chain registration (ground truth, independent of the app):

```bash
cast call 0x0b860c25Dc6b2Df451AA66cFCdc7D6c6D7802F66 \
  'getPolicy(address)((uint128,uint128,uint128,uint64,uint64,bool))' 0x<NEW> \
  --rpc-url https://rpc.testnet.arc.network
cast call 0x0b860c25Dc6b2Df451AA66cFCdc7D6c6D7802F66 \
  'allowedTarget(address,address)(bool)' 0x<NEW> 0x<NEW> \
  --rpc-url https://rpc.testnet.arc.network
cast call 0x0b860c25Dc6b2Df451AA66cFCdc7D6c6D7802F66 \
  'allowedToken(address,address)(bool)' 0x<NEW> 0x3600000000000000000000000000000000000000 \
  --rpc-url https://rpc.testnet.arc.network
```

Expected: policy `(1e6, 2e6, 0, ..., 0, true)`, `allowedTarget` true, `allowedToken` true.

### 1b. Introspect the leash (agent-facing auth)

```bash
curl -s http://localhost:3000/api/agents/me -H "Authorization: Bearer spend_<KEY>"
```

Expected: `{agent, policy: {maxPerTxUsdc: 1, dailyCapUsdc: 2, spentTodayUsdc: 0, active: true}, allowlists: {recipients: ["0x<NEW>"], tokens: [USDC]}}`.
No header or a bad key returns `401`.

### 1c. Spend with Bearer auth

```bash
curl -s -X POST http://localhost:3000/api/payments/request \
  -H 'content-type: application/json' -H "Authorization: Bearer spend_<KEY>" \
  -d '{"agentId":"agent_<ID>","recipient":"0x<NEW>","amount":"0.5","token":"USDC","purpose":"api test"}'
```

Expected: `{status: "APPROVED", executionStatus: "CONFIRMED", txHash: "0x..."}`.
Re-check `getPolicy` - `spentToday` = 500000.

Blocked paths (all return `BLOCKED` with a reason, no tx, no chain effect):

- `amount: "3"` -> `EXCEEDS_PER_TX_LIMIT` (1 USDC per-tx cap)
- `recipient: "0x1111...1111"` -> `RECIPIENT_NOT_ALLOWLISTED`

Auth negatives:

- Wrong or missing Bearer key -> `401 INVALID_API_KEY`
- Key belonging to a different agent than `agentId` -> `401`
- Same address through `/api/agents/user` again -> `409 ADDRESS_REGISTERED`

---

## Phase 2 - UI walkthrough (owner wallet)

### 2.1 Login gate

Open the app in a fresh/incognito window.
A full-screen gate shows with "Connect wallet or sign in".
Connect `0x3F5b...FB84` via Privy -> dashboard with the address in the sidebar footer + Disconnect.
Log out -> back to the gate. No data renders pre-login.

### 2.2 Overview (/dashboard)

KPI cards should match the on-chain snapshot:
Total USDC Controlled, Spent Today, Remaining Daily, Approved/Blocked counts, Agent Status.
Spending Analytics chart, Recent Activity (last 5 txs, explorer links on confirmed),
Policy Health (5/tx, 20/day, remaining, expiry Never), Agent Health, and the Vault Funds card
(deposit = 2 MetaMask txs, withdraw is owner-only).

### 2.3 Agents (/dashboard/agents) - the visitor flow

The page has one create surface: **Create your agent**.
The legacy operator "Create Agent" form was removed.

1. Register with a wallet that is NOT already registered.
   Existing wallets (owner, Booth AI Agent) return the `ADDRESS_REGISTERED` error state.
   Use a new email login (Privy mints a fresh embedded wallet) or a new MetaMask account.
2. **Connect wallet** -> the card swaps to show the connected address.
3. Enter a name -> **Register agent** -> ~10s while 3 on-chain txs land.
4. The **API key box** appears: the `spend_...` key, Copy button, "shown once" warning.
5. The **Give this to your AI agent** box appears: a pre-filled prompt with the agent id,
   key, wallet address, leash (1/tx, 2/day, self-only), the two API endpoints, and a Copy prompt button.
6. The new agent's **AgentCard** appears below with an Active badge.

Also on this page: the Vault Summary card (vault-wide USDC balance + remaining daily cap).

### 2.4 Control (/dashboard/control)

- **Launch demo** -> 3 scripted scenarios stream in real time against Test Agent
  (approved 1.5 USDC with a real tx, blocked over-cap, blocked un-allowlisted). Auto-opens the run detail.
- **Launch Autonomous QA Agent** card shows the harness command for Test Agent.
  Pasting an API key into the field appends `--api-key` and `--qa scripts/qa-user-agent.md`.
- **Previous Runs** lists runs for ALL agents (labeled with agent name).
  Clicking a run opens its detail: mission, passed/failed/model/run id, and a Live Event Feed
  (auto-refresh 2s) with SCENARIO / DECISION / APPROVED / BLOCKED / PASS / FAIL / END badges
  and tx links on approved events.

### 2.5 Spending (/dashboard/spending)

Manual operator spend form (no API key - operator path).
- Happy path: agent = Test Agent, recipient `0x3F5b...FB84`, amount 1.5 -> lifecycle
  REQUESTED -> POLICY CHECK -> APPROVED -> EXECUTED, green panel, explorer link to the tx.
- Blocked paths: amount 6 -> `EXCEEDS_PER_TX_LIMIT`; recipient `0x1111...` -> `RECIPIENT_NOT_ALLOWLISTED`.
- History table filter chips: All / Confirmed / Blocked / Failed, correct decision codes,
  tx-hash links on confirmed rows only.

### 2.6 Policies (/dashboard/policies)

On-Chain Policy card for the selected agent (5/tx, 20/day for Test Agent; 1/2 for user agents).
Owner-only edit goes through MetaMask and emits `PolicyUpdated` on-chain.
Server-Side Policy card is DB-only (instant, no wallet).
Fence check: server allows 3.5 but on-chain cap rejects -> FAILED "reverted" (the on-chain fence is the backstop).

### 2.7 Allowlist (/dashboard/allowlist)

Server-side adds/removes are instant and free.
On-chain adds are owner-gated (MetaMask + vault event).
A recipient must pass BOTH fences to receive funds.

### 2.8 Payments (/dashboard/payments)

Settlement Network = Arc Testnet (5042002).
Stat cards: Total Settled = CONFIRMED count, Pending, Failed = FAILED + BLOCKED, Vault address.
Recent Settlements show confirmed payments with "Settled on Arc Testnet".

### 2.9 Audit (/dashboard/audit)

Filter chips All / Created / Blocked.
Created shows management events (`agent_created_user`, `policy_updated`, `allowlist_added`, `agent_run_created`).
Blocked shows blocked/failed transaction rows.
Every event has timestamp, action, entity, and flattened key=value details.

### 2.10 Settings (/dashboard/settings)

Network (Arc Testnet 5042002, RPC, explorer), Vault (copy button, owner `0x3F5b...FB84`, Arcscan link),
USDC token, wallet role pill (Owner vs Viewer), env values, System Health checks.

---

## Phase 3 - Autonomous AI agent (the booth demo)

The AI agent is the decision brain; SpendArc is the policy leash.
Two ways to drive it, both against the user's freshly-registered agent.

### 3a. Harness (scripted scenarios, opencode brain)

```bash
cd web
node scripts/qa-agent.mjs --agent agent_<ID> \
  --qa scripts/qa-user-agent.md \
  --api-key spend_<KEY> \
  --model opencode/deepseek-v4-flash-free
```

The harness introspects the leash via `/api/agents/me` with the Bearer key,
then the opencode brain builds each request.
Expected output: `Leash: ... 1 USDC/tx, 2 USDC/day` then 3 scenarios -> 3 passed, 0 failed:

1. Approved 0.5 USDC to self -> `APPROVED` + `CONFIRMED` + tx hash
2. 1.5 USDC -> `BLOCKED EXCEEDS_PER_TX_LIMIT`
3. 0.5 USDC to `0x1111...` -> `BLOCKED RECIPIENT_NOT_ALLOWLISTED`

The run streams to `/dashboard/control` with `passed ✓ / failed ✗`.

### 3b. Handoff prompt (zero scripts - the real visitor flow)

1. Register an agent in the UI and copy the key.
2. Copy the **Give this to your AI agent** prompt.
3. Paste it into any AI agent (opencode, ChatGPT, Claude):

```bash
opencode run -m opencode/deepseek-v4-flash-free "I am an autonomous agent. <paste handoff prompt>"
```

The agent introspects its leash, makes a 0.5 USDC payment to the visitor's wallet,
and reports the tx hash or the block reason.

### 3c. On-chain verification

```bash
cast call 0x0b860c25Dc6b2Df451AA66cFCdc7D6c6D7802F66 \
  'getPolicy(address)((uint128,uint128,uint128,uint64,uint64,bool))' <AGENT_ADDR> \
  --rpc-url https://rpc.testnet.arc.network
# spentToday should reflect every approved USDC (manual + AI)
curl -s http://localhost:3000/api/agents/me -H "Authorization: Bearer spend_<KEY>"
```

---

## Phase 4 - Cross-cutting and negative checks

- Auth: every `/dashboard/*` bounces to the gate when logged out; no data leaks pre-login.
- Viewer mode: a second wallet / email login renders read-only -
  owner controls (Withdraw, Edit On-Chain Policy, Revoke, on-chain allowlist adds) hidden.
- Bearer auth: wrong key -> `401`; mismatched key/agentId -> `401`;
  duplicate registration -> `409`.
- RPC resilience: hard-refresh while the RPC is rate-limited;
  reads should retry and populate instead of erroring.

---

## Known caveats (not bugs, but worth knowing)

- `POST /api/agents/user` is self-claimed - the wallet address is asserted by the caller,
  with no server-side wallet-proof yet. Fine for a testnet booth demo, not production.
- `/api/payments/request` accepts requests without a Bearer key (operator path).
  With a key present it must match the `agentId`.
- The executor signing server-side payments uses `EXECUTOR_PRIVATE_KEY`;
  if missing, the happy-path spend returns FAILED with an execution error.
- Blocked requests never touch the chain; only APPROVED ones produce real txs.
- Policy is enforced in two stores: the server-side DB policy runs first (`evaluatePolicy`),
  then the on-chain vault policy is the backstop. A spend only succeeds when it passes both.
- The agent and the vault owner are the same key right now (`0x3F5b...FB84`);
  in production they should be separate.
- The old vault (`0xf23147Df...`) is abandoned - its bytecode has no `withdrawTokens`,
  and its ~2.5 USDC is stuck. Do not reference it as the production vault.
