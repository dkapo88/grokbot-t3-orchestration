# Hygiene and cleanup

Agents leave a lot behind: worktrees, `node_modules`, build output, simulators, screenshots, stale threads. These rules keep hosts healthy. The implementer owns cleanup for its task; the PM bot checks it was done.

## Threads

- **Let threads settle.** A thread is settled when its last run has finished and nothing is queued. `t3-task.sh status <id>` prints `settled: true|false`.
- Before calling a task done, confirm the implementer and its children have all settled, the PR is open or merged, and the final webhook arrived. Never wrap up a thread mid-run or with queued messages.
- **Archive children** as soon as they finish. **Archive the implementer** after merge, or after the owner parks the task. `t3-task.sh archive <id>...` refuses anything not settled.
- **Delete** long-dead threads only with the owner's OK (`t3-task.sh delete <id> --yes`, archived threads only).
- Unarchived threads pile up and bloat T3's state database. Don't let them.
- One thread per task. Hand over to a fresh thread at about 80 runs.
- Flag any thread older than 3 days, or with runaway runs.

## Worktrees and disk

- **T3 cleans worktrees for you** with the settings in [setup.md](setup.md#6-t3-worktree-cleanup-settings). Branches and thread history survive.
- Settled worktrees go after 3 days. **Commit and push before a thread settles.** Uncommitted edits are kept, but ignored files such as `.env` are deleted.
- One reusable review/QA worktree per repo. Don't make a new worktree per PR, review or QA run.
- When a PR merges or a review/QA finishes: `git worktree remove <path>` (only if `git status` is clean and nothing is unpushed), then `git worktree prune`.
- Never leave review/QA worktrees on unpushed detached commits. Push a branch, or note the worktree is disposable so cleanup can prove it's safe.
- Never touch unpushed work during cleanup.
- Leftovers: delete them on Linux hosts; move them to the Trash on a Mac (configurable under `hygiene.leftovers`).
- Prefer pnpm (shared store) over npm. Never leave `node_modules`, `.next`, `dist`, `ios/build` or `Pods` in a finished worktree.
- No duplicate repo copies (`<repo>-copy`, `<repo>-feature`). Use a branch or a worktree.
- Never download SDKs, installers or zips into a repo. Use a temp folder (`$TMPDIR/<task>`) and delete it afterwards.
- Keep evidence (screenshots, videos, logs) only until the PR merges.
- At the end of each task, report the disk space freed. Flag the host if it has under 30 GB free (`monitoring.lowDiskGb`).

## Apple hosts

- Reuse the existing simulator. After QA, `xcrun simctl erase <udid>` or delete any extra device you created. Keep only the current iOS runtime.
- Never point Xcode DerivedData inside the repo. Use the default location, or delete it when the task ends. A single QA run can leave well over 10 GB.
- One heavy job (simulator, native build, QA) at a time per machine (`maxHeavyJobs`). On a small-memory Mac, never stack an implementer, QA and a simulator in parallel.

## Processes

Kill the dev servers, simulators and watchers a task started when it finishes.

## Weekly

`npm cache clean --force`, `pnpm store prune`, delete Xcode DerivedData and Previews (Mac), and trim T3 and harness logs and sessions older than 14 days.

## Migrating from another agent tool

If you move to T3 from another orchestrator: anything that can move cleanly (not mid-run, branch pushed) moves to a new T3 implementer with a handover brief (task, branch, PR, open findings, next step). Anything mid-build, mid-review or mid-QA finishes where it is, then continues in T3. Archive the old threads and clean their worktrees as they finish.
