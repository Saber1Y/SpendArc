# SpendArc UI QA Walkthrough

This walkthrough verifies the SpendArc web UI end-to-end against its live on-chain and server state on Arc Testnet. Run every step with the vault owner wallet connected (unless a step says otherwise).

## Prerequisites

- Wallet key for `0x3F5b96A494061F7338Da529e3047809Ac6a7FB84` (vault owner) loaded in MetaMask, with some testnet USDC in it.
- `EXECUTOR_PRIVATE_KEY` present in `web/.env.local` (required for server-side spend execution).
- `npm run dev` in `web/`, app served at http://localhost:3000.
- Registered agent `agent_c720ee6d` ("Test Agent", address `0x3F5b…FB84`) exists in the DB and vault.

Live contract state you'll compare against:
- Vault: `0xf23147Df55089eA6bA87BF24bb4eEE6f7Cea182b`
- USDC: `0x3600000000000000000000000000000000000000`
- Explorer: https://testnet.arcscan.app (tx: `/tx/<hash>`, address: `/address/<addr>`)
- On-chain policy (both stores): 5/tx + 20/day, expiry never, active.

## 0. Baseline snapshot (record these before every session)

Numbers drift as you test, so record a snapshot first and treat every later check as a *delta* from it.

```bash
curl -s http://localhost:3000/api/policies/agent_c720ee6d | python3 -m json.tool
curl -s "http://localhost:3000/api/transactions?agentId=agent_c720ee6d" | python3 -m json.tool
curl -s http://localhost:3000/api/allowlist/agent_c720ee6d | python3 -m json.tool
```

Record:
- `BAL` = vault USDC balance (Overview "Total USDC Controlled", Agent Health "Vault balance")
- `SPENT` = spent today (Overview "Spent Today")
- `CONF` / `BLOCK` / `FAIL` = transaction counts by `execution_status`
- `MAX_TX`, `DAILY` = per-tx and daily caps in both stores
- Allowlist: recipient count + token count

Typical starting point after a fresh QA run: `BAL≈4.0`, `SPENT=6.0`, `CONF=4`, `BLOCK=11`, `FAIL=1`, caps 5/20, 1 recipient + 1 token.

## 1. Login gate

1. Open the app in a fresh/incognito window. You should see a full-screen gate with "SpendArc" / "Agent spending control plane" and a "Connect wallet or sign in" button - no sidebar, no dashboard data.
2. Click "Connect wallet or sign in" → Privy modal appears with wallet + email options.
3. Pick Wallet → MetaMask → approve the connection. You should land on the dashboard with the sidebar footer showing `0x3F5b…FB84` and a "Disconnect" hint below it.
4. Click the address in the footer → you log out and are dumped back to the login gate. Log back in with the same wallet.
5. Optional: log in with an email instead. Privy creates a viewer embedded wallet - everything renders read-only because it is not the owner.

Verify: no data visible pre-login; correct address + Disconnect appear after login; logout returns to the gate.

## 2. Overview (/dashboard)

1. Header: "Arc Testnet" green dot, your truncated address, "Settlement: Active" (Active = policy loaded).
2. KPI cards should read: Total USDC Controlled ≈ `$BAL`, Spent Today ≈ `$SPENT`, Remaining Daily ≈ `$DAILY - $SPENT`, Approved = `CONF`, Blocked = `BLOCK`, Agent Status = Active.
3. Spending Analytics: bar chart + "N approved / M blocked" legend.
4. Recent Activity: last 5 transactions with green/red badges, amounts, "to 0x…", the decision reason on blocked ones, and explorer links where a tx hash exists.
5. Policy Health card: `MAX_TX`/tx, `DAILY`/day, remaining, expiry "Never", "Allowlisted recipients: <recipient count>", "Allowlisted tokens: <token count>". Daily cap meter ≈ `SPENT/DAILY` used.
6. Agent Health: wallet `0x3F5b…FB84`, Authorization Active, Vault balance `BAL` USDC, Current allowance `DAILY - SPENT` USDC.

### Vault Funds card (this moves testnet money)

1. Deposit: enter `2` → Deposit. MetaMask pops twice (approve, then transfer). Status: "Approving USDC..." → "Depositing..." → "Deposit confirmed". Balance goes to `BAL + 2`.
2. Confirm on Arcscan: search the vault address, check the USDC transfers landed (approval + transfer).
3. Withdraw: enter recipient `0x3F5b…FB84` (or any address) + `1` → Withdraw. One MetaMask popup → "Withdrawal confirmed". Balance back to `BAL + 1`.
4. Verify the receiver got the 1 USDC on Arcscan.

Verify: KPI numbers match on-chain reality; deposit = 2 txs; withdraw is owner-gated (the Withdraw section only renders for the owner wallet).

## 3. Spending (/dashboard/spending)

1. Agent selector: pick "Test Agent".
2. Happy path: Recipient default `0x3F5b…FB84` (allowlisted), Amount `1.5`, Purpose "qa test" → Submit Spending Request.
3. Expect: lifecycle stepper runs REQUESTED → POLICY CHECK → APPROVED → EXECUTED, then a green panel with the amount and an explorer link to the CONFIRMED tx.
4. Blocked path (each should produce a red panel with the specific reason, no chain tx):
   - Amount `6` (over 5/tx) → EXCEEDS_PER_TX_LIMIT
   - Amount `2` to an un-allowlisted recipient like `0x1111111111111111111111111111111111111111` → RECIPIENT_NOT_ALLOWLISTED
   - On the Policies page, set the **Server-Side Policy** daily cap to `0`, then submit any amount → EXCEEDS_DAILY_LIMIT. **Restore the server-side daily cap to 20 afterwards.**
5. History table: filter chips All/Confirmed/Blocked/Failed. Verify each filter shows only its matching rows:
   - Confirmed → only `execution_status=CONFIRMED`
   - Blocked → only `execution_status=BLOCKED`
   - Failed → only `execution_status=FAILED` (this filter no longer includes blocked rows)
   - Correct Decision codes shown, and tx-hash explorer links on confirmed rows only.

Verify: approved request = real on-chain tx you can open on Arcscan; each blocked request returns its specific policy reason with zero money moved; Failed filter never mixes in blocked rows.

## 4. Policies (/dashboard/policies)

1. On-Chain Policy card: Active pill, "Expires never", tiles `5.00` / `20.00` / spent / remaining.
2. Edit On-Chain Policy (owner only): change Per-tx to `3`, keep Daily `20`, Expiry days `0`, Active on → Save. MetaMask pops → "Saving..." → "Confirming on-chain...". After refetch, tiles show `3.00`.
3. Verify on Arcscan that the vault's `PolicyUpdated` event fired for agent `0x3F5b…FB84`.
4. Server-Side Policy: Edit → set per-tx `4`, save → GET shows `4` USDC. Note this is a DB value, no MetaMask.
5. Fence check (the point of having two stores): submit a `3.5` spend on the Spending page. Server-side policy allows it (3.5 ≤ 4), so it reaches the chain, and the vault's on-chain policy rejects it (3.5 > 3) → red panel / FAILED with a "reverted" reason. This proves the on-chain fence is the backstop.
6. ⚠️ Restore state: put on-chain Per-tx back to `5` and Server-Side per-tx back to `5`.

### Emergency Revoke (test last - it's the off switch)

1. Click Revoke Agent → Confirm Revoke. Verify the On-Chain card flips to "Revoked" and the Spending page can no longer complete a spend (all requests fail on-chain).
2. You cannot un-revoke from the UI. Restore by calling `setAgentPolicy(agent, 5e6, 20e6, 0, true)` from cast/script with the owner key, or re-run the deploy/seed script.

Verify: revoked policy blocks spends at the vault; policy can be re-armed only off-UI.

## 5. Agents (/dashboard/agents)

1. Create Agent: name "qa-agent-2", address `0x3F5b…FB84` (or any valid address) → Create. Card appears with ID, Active/No-Policy pill, vault balance, explorer link.
2. Verify the row persists after refresh (stored in SQLite `web/data/spendarc.db`).
3. Check the Audit page afterwards for an `agent_created` event.
4. Note: a brand-new agent has a fresh server-side policy with per-tx 0 and no on-chain policy. A spend against it is blocked at the **server-side** fence (per-tx 0), and would also be rejected on-chain. Don't expect spending to work for it until the owner sets both policies.

Verify: create persists; audit trail shows the event; new agent cannot spend until policy exists in both stores.

## 6. Allowlist (/dashboard/allowlist)

1. Server-Side Recipients: see the seeded entry (own address, "test self"). Add `0x2222222222222222222222222222222222222222` label "qa" → appears. Remove it → disappears (soft-delete in DB, no wallet popup).
2. On-Chain Recipients (owner only): add `0x2222…2222` → Add On-Chain → MetaMask → `TargetAllowlisted` event. Verify on Arcscan.
3. On-Chain Tokens: token input defaults to USDC → Add On-Chain → `TokenAllowlisted`.
4. Cross-check (both fences matter): to send to `0x2222…2222` it must be allowlisted in **both** stores. Add it to the server-side API allowlist AND the on-chain allowlist → the spend goes through. `0x3333…` (in neither store) is blocked at the server fence with RECIPIENT_NOT_ALLOWLISTED.
5. ⚠️ There is no on-chain remove in the UI - you can only add. Don't add junk addresses unless you're fine keeping them or removing via cast.

Verify: server-side adds/removes are instant and free; on-chain adds emit vault events; a recipient must pass BOTH fences to receive funds.

## 7. Payments (/dashboard/payments)

1. Settlement Network card shows "Arc Testnet (5042002)".
2. Stat cards: Total Settled = CONFIRMED count, Pending = the rest, Failed = FAILED + BLOCKED, Vault = `0xf23147Df5...` (first 10 chars).
3. Recent Settlements: confirmed payments appear with "Settled on Arc Testnet". After doing a spend on the Spending page, refresh and confirm it shows up.

Verify: settlement counts match the transaction history; a fresh approved spend appears here.

## 8. Audit Log (/dashboard/audit)

1. Filter chips All Events / Created / Blocked:
   - Created → management events (agent_created, policy_updated, allowlist_added, agent_run_created)
   - Blocked → transaction rows whose recorded decision was BLOCKED or FAILED (this filter is no longer empty)
2. Each entry shows timestamp, action, entity type, and flattened key=value details.
3. Live check: do a policy edit + a spend + an allowlist add, then refresh - all three should appear with new timestamps.

Verify: the Blocked filter lists blocked/failed transactions; management events appear under Created.

## 9. Settings (/dashboard/settings)

1. Network: Arc Testnet (5042002), the RPC URL, explorer URL.
2. Vault: copy button works (clipboard), owner shows `0x3F5b…FB84`, "View on Arcscan" link opens the vault, USDC token address shown.
3. Wallet: connected address + role pill (green Owner for `0x3F5b…FB84`; flips to Viewer for an email/viewer login).
4. Environment: shows `NEXT_PUBLIC_VAULT_ADDRESS` and explorer values.
5. System Health: all 4 checks green once state loads (vault deployed, owner set, USDC configured, /api/agents reachable).

Verify: network/env values match `.env.local`; owner vs viewer role renders correctly.

## 10. Agent Control (/dashboard/control)

1. Launch card shows the command to run the autonomous QA agent, e.g. `node scripts/qa-agent.mjs --agent agent_c720ee6d`, with a working Copy button.
2. Previous Runs list: each run shows mission, run id, `passed ✓ / failed ✗`, and a status pill (Running / Completed / Completed (with failures) / Failed).
3. Click a run → detail view: mission, Passed/Failed/Model/Run ID stats, and a Live Event Feed that auto-refreshes every 2s with kind badges (SCENARIO / DECISION / APPROVED / BLOCKED / PASS / FAIL / END) and tx links on approved events.

Verify: launching from the terminal produces a live feed here in real time.

## 11. Cross-cutting checks

- RPC resilience: hard-refresh each page while the rate limit is hot; the Policies/Overview reads should retry and populate instead of erroring. Policies page has an explicit Retry button if it does fail.
- Auth: every /dashboard/* page bounces to the login gate when logged out; there is no data leak pre-login.
- Viewer mode: log in with a second wallet / email → sidebar shows that address, all owner controls (Withdraw section, Edit On-Chain Policy, Revoke, On-Chain allowlist adds) are hidden or disabled, everything else still renders read-only.

## Automatable QA scenarios (parsed by `npm run qa:agent`)

The agent brain reads each ```` ```scenario ```` block below, builds the request via `/api/payments/request`, and checks the response against `expected`.

### Scenario: Happy path - approved spend

```scenario
{
  "title": "Happy path - approved spend",
  "request": {"recipient": "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84", "amount": 1.5, "purpose": "qa test"},
  "expected": {"status": "APPROVED", "executionStatus": "CONFIRMED", "hasTx": true}
}
```

### Scenario: Over per-tx limit

```scenario
{
  "title": "Amount 6 exceeds 5/tx",
  "request": {"recipient": "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84", "amount": 6, "purpose": "qa test"},
  "expected": {"status": "BLOCKED", "reason": "EXCEEDS_PER_TX_LIMIT"}
}
```

### Scenario: Un-allowlisted recipient

```scenario
{
  "title": "Recipient not allowlisted",
  "request": {"recipient": "0x1111111111111111111111111111111111111111", "amount": 2, "purpose": "qa test"},
  "expected": {"status": "BLOCKED", "reason": "RECIPIENT_NOT_ALLOWLISTED"}
}
```

### Scenario: Daily cap hit

```scenario
{
  "title": "Daily limit zeroed",
  "setup": {"setDailyCapUsd": 0},
  "request": {"recipient": "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84", "amount": 0.5, "purpose": "qa test"},
  "expected": {"status": "BLOCKED", "reason": "EXCEEDS_DAILY_LIMIT"},
  "teardown": {"setDailyCapUsd": 20}
}
```

### Scenario: History rows present

```scenario
{
  "title": "Transaction history has confirmed + blocked rows",
  "verifyHistory": {"agentId": "agent_c720ee6d", "expectConfirmed": true, "expectBlocked": true}
}
```

## Known caveats (not bugs, but worth knowing)

- API routes have no auth - `/api/agents`, `/api/policies/...`, `/api/payments/request` etc. are callable by anyone on the network. Fine for a testnet demo, not production.
- The "agent" and the "vault owner" are the same key right now (`0x3F5b…FB84`); in production they should be separate.
- The executor signing server-side payments uses `EXECUTOR_PRIVATE_KEY` - if that env var is missing, the happy-path spend comes back FAILED with "Execution error".
- Blocked requests don't touch the chain (server-side denial only); only APPROVED ones produce real txs. On-chain rejections (e.g. the two-fence check in section 4) surface as FAILED.
- Spending policy is enforced in two stores: the server-side DB policy runs first (`evaluatePolicy`), then the on-chain vault policy is the backstop. A spend only succeeds when it passes both.
- The Overview "Allowlisted recipients / tokens" counts reflect the server-side allowlist (same store `evaluatePolicy` checks), not the on-chain vault allowlist.
