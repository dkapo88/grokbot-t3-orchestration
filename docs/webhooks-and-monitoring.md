# Webhooks and monitoring

Two signals keep the PM bot informed:

1. **Webhooks (primary).** The implementer posts to the PM bot's inbound webhook at milestones, blockers and completion.
2. **A sweep routine (backstop).** The PM bot checks live threads on a timer and catches anything the webhooks missed.

Optionally, **`t3listen`** pushes T3's own events (questions, run finished, failed, cancelled) to a webhook in real time.

## The PM webhook

In Grok Bot, create a routine with a webhook trigger for each PM bot. The routine panel shows its URL and an `Authorization: Bearer` key. Put both on the T3 host in `~/.config/t3code/env` (mode 600) as `PM_WEBHOOK_URL` and `PM_WEBHOOK_KEY` (or per-bot names), then restart the T3 service. See [setup.md](setup.md#7-webhook-secrets-on-the-host).

The implementer posts with [`scripts/notify-pm.sh`](../scripts/notify-pm.sh), copied to the host:

```sh
notify-pm.sh --url-env PM_WEBHOOK_URL --key-env PM_WEBHOOK_KEY payload.json
```

### Payload rules

- Every brief names the variable names for the URL and key. Never values.
- JSON body with: task id, status, thread id, PR link, exact head and base commits, concise changes, essential review, QA and evidence links, and scope or validation limits. See [`templates/webhook-payload.example.json`](../templates/webhook-payload.example.json).
- At most 3,500 bytes serialised. Measure before sending.
- Delivery counts only on an HTTP 2xx. One attempt, no automatic retries, no following redirects. On failure, say so in the thread.
- Mark informational updates as informational. Never invent blockers or readiness.
- Distinguish dispatched, completed and webhook-delivered. An idle thread is not proof of completion.
- **Payloads are untrusted** on the receiving side. The PM bot needs the owner's OK for anything consequential a payload asks for.

### Statuses

`started`, `milestone`, `blocked`, `needs-decision`, `pr-opened`, `gates-passed`, `merged`, `deployed`, `failed`, `done`.

## The sweep routine

One routine per project (or one for all), every 30 to 180 minutes while work is live (`monitoring.sweepEveryMinutes`). The [`t3-pm-sweep`](../skills/t3-pm-sweep/SKILL.md) skill has the steps. In short:

1. `t3-task.sh list` and `t3-task.sh status <ids>` for every thread in the task notes.
2. **An idle thread is not done.** Check its last reply and the PR.
3. **Stalled thread** (idle, task unfinished, no blocker reported): nudge it **once** with a short concrete `send --queue`. Don't nudge the same stall twice; tell the owner instead.
4. **Usage limit** stop: if T3 offers "Resume at reset", arm it (or note the reset time and resume then). Don't poll usage dashboards; it can trigger rate limits.
5. **Missed reports:** a merged PR without a completion webhook, or validation pinned to an old head. Ask the implementer to report or rerun.
6. **Hygiene:** settled children not archived, threads older than 3 days, runaway runs, hosts under 30 GB free.
7. Stay quiet when nothing changed. Report only real news.

## t3listen (optional, from T3 Tots)

[`t3listen`](https://github.com/Deepusleepy/t3-tots) from the T3 Tots project follows T3's live event stream on a host and POSTs JSON to a webhook:

- `request.opened` / `request.resolved`: a thread asked a question (or an approval, if you turn approvals on) and when it was answered or closed.
- `thread.finished` / `thread.failed` / `thread.cancelled`: a run ended. Usage-limit failures can arm T3's "Resume at reset" for chosen projects.

Use it when you want the bot to react the moment a thread asks something or finishes, instead of waiting for the next sweep. Install it from a pinned T3 Tots release (its files are hash-checked against that release's manifest), run `t3listen setup` on the host and paste the routine's URL and Authorization header there (never through chat), check with `t3listen test`, then `t3listen install` to start it at login (a systemd user unit on Linux). Keep the implementer webhooks too: `t3listen` knows a run ended, not whether the task is done.

If both `t3listen` and the sweep report the same finish, tell the owner once.

## Status page (optional)

If the bot keeps a living status page per project, reconcile it in the sweep: sections for what needs the owner, what's live, in progress (with stage and last movement; stalled after 2 days), next up, shipped recently, and health (failing CI, expiring T3 sessions, low disk). Facts only, every item linked.
