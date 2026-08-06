# SpendArc Demo-Agent QA Scenarios (Test Agent)

Scenarios for the demo agent `agent_c720ee6d` (Test Agent, `0x3F5b96A494061F7338Da529e3047809Ac6a7FB84`):
policy 5 USDC/tx + 20 USDC/day, recipient allowlist = own address, token = USDC.
This is the harness default (`--qa` omitted). Run against the operator path or with an API key.

```scenario
{
  "title": "Happy path - approved spend",
  "request": {"recipient": "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84", "amount": 1.5, "purpose": "qa test"},
  "expected": {"status": "APPROVED", "executionStatus": "CONFIRMED", "hasTx": true}
}
```

```scenario
{
  "title": "Amount 6 exceeds 5/tx",
  "request": {"recipient": "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84", "amount": 6, "purpose": "qa test"},
  "expected": {"status": "BLOCKED", "reason": "EXCEEDS_PER_TX_LIMIT"}
}
```

```scenario
{
  "title": "Recipient not allowlisted",
  "request": {"recipient": "0x1111111111111111111111111111111111111111", "amount": 2, "purpose": "qa test"},
  "expected": {"status": "BLOCKED", "reason": "RECIPIENT_NOT_ALLOWLISTED"}
}
```

```scenario
{
  "title": "Daily limit zeroed",
  "setup": {"setDailyCapUsd": 0},
  "request": {"recipient": "0x3F5b96A494061F7338Da529e3047809Ac6a7FB84", "amount": 0.5, "purpose": "qa test"},
  "expected": {"status": "BLOCKED", "reason": "EXCEEDS_DAILY_LIMIT"},
  "teardown": {"setDailyCapUsd": 20}
}
```

```scenario
{
  "title": "Transaction history has confirmed + blocked rows",
  "verifyHistory": {"agentId": "agent_c720ee6d", "expectConfirmed": true, "expectBlocked": true}
}
```
