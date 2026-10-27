# Orchestration

## Roles

| Who | Does | Never does |
|---|---|---|
| **You (the owner)** | Own the spec and product decisions. | Babysit threads. |
| **Grok Bot (PM)** | Plans and slices work, launches one implementer per task, relays your changes, tracks status, reports. | Writes code, launches reviewers or QA itself, messages child threads. |
| **Implementer thread** | Owns one task end to end: code, review child, fixes, QA child, PR, merge (per policy), cleanup, webhook reports. | Spans more than one task. |
| **Review child** | Read-only review of the diff before the PR. | Edits, commits, pushes or comments. |
| **QA child** | Tests the changed flows and critical paths against a written plan. | Wanders the whole app or keeps going past a blocker. |

## One thread per task

- One implementer thread per task, slice, feature or epic. Never a long-running "project PM" thread, never one thread across tasks.
- Parallel work means parallel implementer threads, one per task.
- Reuse the same implementer for fixes on its task. Hand over to a fresh thread (with a summary: task, branch, PR, open findings, next step) only if it gets bloated, at about 80 runs.
- Save each thread id in the task's status note. Track by id, not title.

## Where work runs

Pick the environment by its `role` in `config.json`:

- `primary`: all implement, pre-PR review and non-Apple QA.
- `apple-only`: Apple simulator QA and iOS builds only. Ask the owner before a paid cloud build.
- `local` (the bot's own box): testing the scripts only, never real dev work.

## Launching

```sh
./scripts/t3-task.sh --env primary launch /home/dev/repos/web-app --role implement \
  --title "Add password reset email" --brief-file /tmp/brief-reset.md
```

- `--role` looks up the harness, model and options in `modelRouting.roles`. You can instead pass `<provider> <model>` and `--option id=value`.
- `--title` is required. Titles are never auto-generated (`generateTitle: false`).
- The script refuses banned selections and apple-only misuse, and never falls back to another model.
- If the project (repo path) isn't registered in T3 yet, it is created. The path is on the host, not on the box.
- `--dry-run` prints the resolved selection without launching.

### Thread titles

A short, plain-English description of the task, 3 to 7 words, that a non-engineer would understand. Examples: `Fix mobile score entry keyboard`, `Add coach booking to calendar`.

No bot names, project slugs, task ids, PR numbers or jargon. Never generic ("Task 12", "Fix bug"). No em dashes. Children use the same title plus ` (review)` or ` (QA)`.

## The brief

Every implementer brief follows [`templates/implementer-brief.md`](../templates/implementer-brief.md). It covers:

1. **Scope.** The one task, acceptance criteria, repo, branch name.
2. **Workspace.** One worktree; machine-health rules (see [hygiene.md](hygiene.md)).
3. **Pre-PR review.** Delegate a review child with T3 `delegate-task` on the `review` routing row, read-only tools only. Re-reviews cover only changes since the last reviewed head. One reviewer, no twins.
4. **QA.** After fixing valid findings, delegate a QA child on the `qa` row. Paste the exact `modelSelection` JSON into the brief, never just a model name. QA guardrails: explicit test plan, about 25 screenshots max, stop at the first blocker, re-runs retest only failures and touched flows, stop and report at about 150 requests.
5. **PR and merge.** Open the PR. Gates: CI, pre-PR review, QA, GitHub PR review with findings resolved, plus the paid reviewer where the project enables it. With `policy.merge = auto-when-gates-pass`, merge (and deploy if that is the project flow) without asking; hold only if a gate failed, a finding is unresolved or the spec is unclear. With `ask-human`, report and wait.
6. **Webhooks.** Post milestones, blockers and completion to the PM webhook (env var names only).
7. **Wrap-up.** Clean worktree and artifacts, archive children, report disk freed.

## Talking to a running thread: steer or queue

```sh
./scripts/t3-task.sh --env primary send <threadId> "<message>" [--queue|--steer] [--wait]
```

Choose on purpose:

- `--steer` when the message changes what the running turn is doing **now**: a correction, "stop doing X", new scope, a wrong assumption, or the answer to a blocker it is waiting on. The message joins the same run; the agent sees it at its next tool boundary.
- `--queue` (default) for a separate next step after the turn ends: review feedback on a finished PR, the next task, anything that needs this turn's results. If the thread is idle, it starts straight away.

Always read the `delivered: steered | queued | started` field. Exit codes:

| Exit | Meaning | What to do |
|---|---|---|
| 0 | Delivered as reported. | Nothing. |
| 1 | Thread not found or title ambiguous. | Use the id from `list`. |
| 2 | Usage error. | Fix the command. |
| 3 | Steer refused; **nothing was sent**. | Retry shortly, or choose `--queue` deliberately. |
| 4 | Asked to steer, but it landed as something else. | Check the thread. |
| 5 | Outcome uncertain; it **may** have been sent. | Don't retry blindly. Look for the printed `messageId` in the thread first. |

Relay the owner's mid-task changes into the implementer straight away. Never message review or QA children; the implementer manages them.

## Approvals and questions

Threads ask two kinds of things: questions (what to build) and approvals (permission to run a command or change files).

- **Questions about product direction, money, publishing or anything the owner keeps for themselves** go to the owner.
- **Approvals carry a risk level.** When the owner has delegated, the bot may accept `low` and `normal`. `high` (deletes, force pushes, pushes to main, secrets, publishing, deploys outside the agreed flow) always needs the owner's yes. If a command looks riskier than its label, treat it as high.
- Never invent the owner's preferences. The thread decides how; the owner decides what.

## Gates and merge policy

| Gate | Where |
|---|---|
| CI | GitHub Actions or your CI. |
| Pre-PR review | Review child in T3. |
| QA | QA child in T3 (Apple host for simulator QA). |
| GitHub PR review | A review app on GitHub. If it doesn't start, comment its trigger (for example `@codex review`). |
| Paid reviewer (optional) | Only for projects with `paidReviewer: true`, once per PR, on the final diff. |

Historical approval isn't current approval. Review and QA are pinned to an exact head; if the head changes, rerun them in the existing children.

## Reporting to the owner

Short and factual:

- **Started:** what, where (environment, project, thread title).
- **Finished:** result, PR link, preview or deploy URL, disk freed.
- **Blocked:** the one question, the options, what it blocks.

No em dashes. One status note per task (thread id, PR, state), updated on every transition. A daily summary is optional: shipped, in flight, blocked on the owner. If you keep a project status page, update it in the same turn.
