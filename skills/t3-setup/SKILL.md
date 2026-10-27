---
name: t3-setup
description: >-
  Use when the owner wants to set up, connect, renew or check T3 Code for bot
  orchestration: installing T3 on an always-on host, an optional Mac for Apple
  builds, Tailscale access from the bot's box, harness logins, session tokens,
  config.json and the webhook and sweep routines.
---
# T3 setup

Full guide: `docs/setup.md`. Do the steps you can on your own box; for the host, give the owner exact commands to run, or run them through a connected computer only with their approval.

## Checklist
1. **Primary host.** Node 22+, git, `gh` signed in, pnpm. T3 installed and running as the `t3code` systemd user unit with lingering (`scripts/systemd/t3code.service`). Restart only through systemctl.
2. **Harnesses** signed in with subscriptions (Claude Code, Cursor CLI, Pi, Codex as needed). No provider API keys in the service environment.
3. **Apple host** (only if there are Apple apps): Xcode, the T3 app open, Tailscale. Role `apple-only`.
4. **Tailscale.** Hosts on the tailnet with T3 reachable over HTTPS (`t3 pair --tailscale`). On your box: userspace `tailscaled` with an outbound HTTP proxy; optional `scripts/tailscale-watchdog.sh`.
5. **Credentials.** The owner issues a session token on each host (`t3 auth session issue ... --token-only` into a file with umask 077) and moves it to `secrets/<env>.token` on your box through a private channel (scp, a secure form, or your vault). Never through chat; never print it. Record the expiry date in memory and on the status page; remind the owner a few days before.
6. **Config.** `cp config.example.json config.json`; fill environments, projects, model routing (copy option ids from T3's model picker), merge policy and cost guardrails. Confirm the routing and merge policy with the owner; don't choose them yourself.
7. **Deps.** `cd scripts && npm ci --ignore-scripts`.
8. **Smoke test.** `scripts/t3-task.sh --env <env> list` for every environment; a `launch --dry-run` per role.
9. **T3 worktree cleanup settings** as in `docs/setup.md` section 6 (the owner sets them in the T3 app).
10. **Routines.** A webhook routine for the PM bot (URL and key go into `~/.config/t3code/env` on the host, pasted there by the owner) and a sweep routine using the `t3-pm-sweep` skill. Optional: `t3listen` from T3 Tots, per `docs/webhooks-and-monitoring.md`.

## Renewal
When a session nears expiry or the scripts get HTTP 401: ask the owner to issue a new token on that host and drop it into `secrets/<env>.token` the same private way, then revoke the old one (`t3 auth session list`, `t3 auth session revoke <id>`). Run `list` to confirm.

## Rules
- Fix stale config (wrong URL, renamed environment) yourself and say what you changed. Anything that grants access or costs money needs the owner's yes.
- Never paste or echo credentials. Check a token only by running `list`.
