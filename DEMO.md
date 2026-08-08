# SpendArc Demo Recording Guide

This is the narrated recording flow for the SpendArc submission video.
Run it end-to-end against the live product at `http://localhost:3000`.

The demo tells the story of an AI agent with a spending leash:
an on-chain vault that no key can drain, with per-service budgets on top.

## Pre-flight checklist

- [ ] Dev server running: `cd web && npm run dev` (log: `/tmp/spendarc-dev.log`)
- [ ] Operator wallet funded: 3+ USDC + 3+ ETH on Arc testnet
      (see "Operator balance" in QA.md). Each visitor gets 3 USDC + 0.05 ETH gas,
      so one fresh wallet per recording session.
- [ ] Fresh browser profile (no Privy/embedded wallet state, no existing visitor).
- [ ] Screen recording on, 1200x800+ window, system audio off (narrate over it).
- [ ] Arcscan tab ready for the final step.
- [ ] QA.md section 2 verified (service allowlist + per-service budget live).

## Recording script

1. **Landing** - open `/`. Show "Give your agent a leash" hero, HowItWorks
   (Create your vault / Fund it / Hand your agent a key), the live proof feed at the bottom
   (the latest on-chain approval + the latest block, with amounts and tx hashes).
2. **Connect + create vault** - connect a fresh wallet (Privy embedded wallet).
   Choose a leash: 5 USDC/tx, 10 USDC/day, 7 days. Click create.
   Narrate: "This deploys a vault on Arc testnet. The vault itself enforces the leash."
3. **Fund + deposit** - the demo faucet tops the wallet with 3 USDC + gas.
   Deposit the 3 USDC into the vault. Show the vault balance tick up.
4. **Register your agent** - pick an agent name + mission (e.g. "Marketing analyst").
   Copy the API key. Show the handoff prompt ("how to run your agent").
5. **Dashboard + leash meter** - show the My Agent view: per-tx limit, daily cap,
   spent today, remaining. Emphasize this is read from the vault on-chain.
6. **Allow a service** - open Policies -> Service payments. Enter a third-party service
   address, a label, and a per-service budget (e.g. 0.10/tx, 0.25/day). Sign the
   allowlist change in your wallet. It syncs: on-chain `allowedTarget = true`,
   DB mirrored, budget shown as a chip on the row.
   Narrate: "The vault allows this specific address. I also cap what it can draw per tx and per day."
7. **Agent pays the service** - paste the handoff prompt into the AI agent, tell it to
   pay the allowed service 0.05 USDC for the mission. The payment is `APPROVED` +
   `CONFIRMED`; show it in the transaction feed and the proof card. The service received
   the funds.
8. **Per-service budget blocks overspend** - have the agent pay the service 0.15 USDC
   (over its 0.10/tx budget). Show `BLOCKED EXCEEDS_SERVICE_PER_TX_LIMIT` in the feed and
   the proof card. Then send two 0.09 payments (0.18/day cumulative) and a third
   (0.27/day) -> `BLOCKED EXCEEDS_SERVICE_DAILY_LIMIT`.
   Narrate: "The vault leash is the backstop; the per-service budget is the tighter rule."
9. **Global leash blocks a drain** - tell the agent to pay itself 6 USDC.
   Show `BLOCKED EXCEEDS_PER_TX_LIMIT` (on-chain revert) in the feed.
10. **Tighten the leash** - in Policies, lower per-tx to 0.01 and sync.
    Show the meter drop and confirm the on-chain policy changed.
11. **Audit + Arcscan** - open the Audit log (every decision recorded), then open Arcscan
    for the vault address: show `policy`, `allowedTarget`, and the approved transfer.

## Submission artifacts

| Artifact | Source |
| --- | --- |
| Recording (mp4) | OBS / QuickTime of the flow above |
| Proof feed on landing | `web/app/api/transactions/proof/route.ts` |
| On-chain verification | `node scripts/verify-proof.mjs` (or QA.md cast commands) |

## Notes

- Keep the recording under 3 minutes; steps 1-5 fast, 6-10 the meat.
- Use a fresh wallet per take; the faucet grants one 3 USDC + gas per visitor.
- The operator faucet only holds ~3.15 USDC, so refill from the main wallet
  between takes if you record more than once.
