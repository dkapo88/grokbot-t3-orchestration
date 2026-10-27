<!-- Implementer brief. Fill every {{placeholder}}. Keep secrets out: name env vars only. -->
# Task: {{short plain-English task}}

You own this task end to end in this one thread. Don't start other tasks here.

## Scope
- Repo: {{owner/repo}} at {{path on host}}
- Branch: {{branch-name}} (from {{base branch}})
- Goal: {{one or two sentences}}
- Acceptance criteria:
  - {{criterion}}
  - {{criterion}}
- Out of scope: {{anything not to touch}}
- Unclear product rules: stop and ask (post `needs-decision` to the webhook). Don't invent them.

## Workspace
- Use one worktree for this task. Commit and push before you go idle; settled worktrees are cleaned up after 3 days and ignored files are deleted.
- No build output, downloads, SDKs or zips in the repo. Use `$TMPDIR/{{task-id}}` and delete it after.
- Prefer pnpm. Kill any dev servers, simulators or watchers you start.

## Pre-PR review
When the change is ready, delegate a review child with T3 `delegate-task`:
- Title: `{{title}} (review)`
- modelSelection (exact): `{{review modelSelection JSON}}`
- Read-only tools only (read, grep, find, ls, git via bash). No edits, commits, pushes or comments.
- Re-reviews cover only the changes since the last reviewed head. One reviewer, no twins.
Fix the valid findings.

## QA
Then delegate a QA child:
- Title: `{{title}} (QA)`
- modelSelection (exact): `{{qa modelSelection JSON}}`
- If that instance errors or is unavailable, stop and report. Don't fall back to another provider.
- Test plan: the changed flows plus the critical paths they touch ({{auth, payments, data loss, ...}}).
- Guardrails: about 25 screenshots max (only to prove an assertion), stop at the first blocker and report it with evidence, re-runs retest only failures and touched flows, stop and report at about 150 requests.
{{If Apple QA is needed: run it on the apple-only environment at {{apple path}}; ask before any paid cloud build.}}

## PR and merge
- Open the PR with a clear summary and test evidence.
- Make sure the GitHub PR review runs; if it doesn't start, comment `{{review trigger}}`.
- {{Only if enabled for this project: request the paid review once, on the final diff.}}
- Merge policy: {{auto-when-gates-pass | ask-human}}.
  - auto: merge (and deploy if that is this project's flow) once CI, pre-PR review, QA and GitHub review all pass with findings resolved. Hold only if a gate failed, a finding is unresolved or the spec is unclear.
  - ask-human: post `gates-passed` and wait.
- Pin review and QA to the exact head. If the head changes, rerun them in the same children.

## Reporting
Post to the PM webhook with `notify-pm.sh --url-env {{URL_ENV}} --key-env {{KEY_ENV}}` at: start, milestones, blockers or decisions needed, PR opened, gates passed, merged or deployed, done. JSON, at most 3,500 bytes, one attempt; delivery counts only on HTTP 2xx. Include task id `{{task-id}}`, this thread id, PR link, exact head and base, short changes, review and QA links, and limits. Never put secrets in thread text or payloads.

## Wrap-up
On merge: remove the worktree if clean and pushed, prune, delete temp files and evidence, archive the review and QA children, then report the disk space freed (flag the host if under 30 GB free) and post `done`.
