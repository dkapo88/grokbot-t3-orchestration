---
name: t3-pm-sweep
description: >-
  Use for the recurring PM sweep of T3 Code work (a routine every 30 to 180
  minutes while tasks are live): find stalled, finished or unreported threads,
  nudge once, resume after usage limits, archive settled children, flag stale
  threads and low disk, and update the status page.
---
# T3 PM sweep

Backstop to the implementer webhooks. Follow the `t3-orchestration` skill for all rules.

## Each run
1. Collect the live thread ids from your task notes. For each environment: `scripts/t3-task.sh --env <env> list` and `scripts/t3-task.sh --env <env> status <ids...>`.
2. For each task:
   - **Running:** nothing to do unless it has run unusually long or many runs (runaway). Flag runaways to the owner.
   - **Settled with the task finished** (PR merged, done reported): archive any children still open; archive the implementer if merged. Confirm cleanup and disk report.
   - **Settled with the task unfinished and no blocker reported (stalled):** read the last reply and the PR. If it's waiting on something you can answer from the brief, or a background job that has finished, send **one** short nudge with `send --queue` ("The CI run finished green; continue with QA."). Record that you nudged. Never nudge the same stall twice; tell the owner instead.
   - **Stopped on a usage limit:** if T3 offers Resume at reset, arm it; otherwise note the reset time and queue a resume after it. Don't poll usage dashboards.
   - **Waiting on a question or approval:** handle it per the `t3-orchestration` rules (low and normal risk only when delegated; everything else to the owner).
   - **Missed report:** PR merged or opened with no matching webhook, or review and QA pinned to an old head. Queue a message asking the implementer to report or rerun.
3. **Hygiene:** flag threads older than `monitoring.staleThreadDays` (default 3) and threads over about `monitoring.handoverAtRuns` runs (suggest a fresh thread with a handover summary). Flag hosts under `monitoring.lowDiskGb` free if a task reported it.
4. **Status page:** if you keep one, reconcile it with what you found (stages, last movement, stalled after 2 days, needs-you items, health such as expiring T3 sessions).
5. **Report** only real news: finished work, a nudge that didn't help, a decision for the owner, a failure. If nothing changed, send nothing and write nothing to memory.

## Never
- Message review or QA children directly.
- Archive or delete anything mid-run or with queued messages; delete anything without the owner's OK.
- Switch a thread's model or raise its effort.
- Report the same finish twice (if `t3listen` already announced it, stay quiet).
