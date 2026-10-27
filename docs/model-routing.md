# Model routing

Every thread is launched with an explicit harness (T3 instance), model and options. Nothing is left to a default, and nothing silently falls back.

## Example routing

This is a sensible starting point. **Pick your own** based on your subscriptions; the structure matters more than the exact models.

| Job | instanceId | model | options |
|---|---|---|---|
| Implement (default) | `claudeAgent` | `claude-opus-5-5` | `effort: medium` |
| Implement, complex or sensitive | `claudeAgent` | `claude-opus-5-5` | `effort: xhigh` |
| Pre-PR review | `pi` | `opencode-go/deepseek-v4.1-flash` | `thinking: max` |
| QA, testing, validation | `cursor` | `grok-4.7` | `reasoning_effort: medium`, `contextWindow: 256k`, `fastMode: false` |
| GitHub PR review | a GitHub review app (for example Codex) | | comment `@codex review` if it doesn't start |
| Optional paid reviewer | a paid review bot of your choice | | once per PR, final diff, only where enabled |

Why this shape:

- **A different model reviews than implements.** An independent second opinion catches more.
- **A cheap, strong model reviews.** Reviews are read-heavy; a fast reasoning model at max thinking is good value.
- **QA runs on its own model and budget**, so long test sessions don't eat the implementer's allowance.
- **The GitHub review runs outside T3**, on the final PR, as a separate gate.

## In config

`modelRouting.roles` in `config.json` holds one entry per job. Launch with `--role <name>`:

```json
"qa": {
  "instanceId": "cursor", "model": "grok-4.7",
  "options": [
    { "id": "reasoning_effort", "value": "medium" },
    { "id": "contextWindow", "value": "256k" },
    { "id": "fastMode", "value": false }
  ]
}
```

T3's launch payload uses `modelSelection: { instanceId, model, options: [{ id, value }] }`. Option ids differ per harness and model (one model may use `effort`, another `reasoning_effort`). Read the right ids from T3's model picker or the `server.getConfig` RPC.

When an implementer delegates a child, the brief must contain the **exact** `modelSelection` JSON for that row. "Use Grok for QA" is not enough: the implementer might pick the wrong instance or effort.

## Rules

- **No silent fallbacks.** If the chosen harness or model errors or is unavailable, stop and report. Never switch provider on your own.
- **No upgrades without the owner.** Nothing above the routing table (a bigger model, a higher effort, a paid tier) without the owner's OK.
- **Pin the instance.** When a model is reachable through more than one T3 instance, choose one and ban the others in `modelRouting.banned`. The launch script refuses banned selections.
- **Subscriptions over API keys.** Harnesses sign in with subscriptions; API keys stay unset on the host.
- **Fast or priority tiers off** unless the owner asks.
- **Harness-specific gotchas.** For example, Pi needs the model passed explicitly (it may default to another provider), reviewers get read-only tools, and anything run from a shell should have stdin closed.

## Banned list example

```json
"banned": [
  { "instanceId": "grok", "reason": "Grok models run through the cursor instance here" },
  { "modelPattern": "^grok", "unlessInstanceId": "cursor", "reason": "Grok models only via the cursor instance" }
]
```

Each rule matches on `instanceId`, a `modelPattern` regex, or both. `unlessInstanceId` makes an exception.
