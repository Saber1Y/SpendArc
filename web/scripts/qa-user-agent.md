# SpendArc User-Agent QA Scenarios (AI agent holds the API key)

Scenarios tailored to a freshly-registered user agent: 5 USDC/tx, 10 USDC/day,
payments only to the agent's own address. Run with `--api-key` so the harness
authenticates as the agent, not the operator.

```scenario
{
  "title": "Happy path - approved spend to self",
  "request": {"recipient": "__self__", "amount": 0.5, "purpose": "ai agent approved spend"},
  "expected": {"status": "APPROVED", "executionStatus": "CONFIRMED", "hasTx": true}
}
```

```scenario
{
  "title": "Over per-tx limit",
  "request": {"recipient": "__self__", "amount": 6, "purpose": "ai agent over per-tx"},
  "expected": {"status": "BLOCKED", "reason": "EXCEEDS_PER_TX_LIMIT"}
}
```

```scenario
{
  "title": "Un-allowlisted recipient",
  "request": {"recipient": "0x1111111111111111111111111111111111111111", "amount": 0.5, "purpose": "ai agent to unknown address"},
  "expected": {"status": "BLOCKED", "reason": "RECIPIENT_NOT_ALLOWLISTED"}
}
```
