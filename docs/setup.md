# Setup and installation

The recommended layout has three parts:

| Part | What it does | Role in `config.json` |
|---|---|---|
| **Primary coding host** | An always-on Linux machine (a small VPS is fine) running T3 Code. All implement, review and non-Apple QA work runs here. | `primary` |
| **Apple host (optional)** | A Mac running the T3 Code app, used only for Apple simulator QA and iOS builds. | `apple-only` |
| **The bot's box** | Where your Grok Bot runs the helper scripts. It never does real dev work itself. | (client only) |

You can run everything on one machine if you like. The roles just tell the bot where each kind of work belongs.

## 1. Primary coding host (Linux)

Sizing: 2 vCPU and 8 GB RAM is enough for a few parallel threads; give it at least 80 GB of disk, since worktrees and `node_modules` add up.

1. **Base tools.** Node.js 22+, git, the GitHub CLI (`gh`), and pnpm (shared store, saves disk).
   ```sh
   gh auth login        # a GitHub account or bot account that can push branches and open PRs
   corepack enable pnpm
   ```
2. **Install T3 Code.** Follow the install steps in the [T3 Code repo](https://github.com/pingdotgg/t3code). Check with `t3 --version`.
3. **Run it as a service.** Use the user unit in [`scripts/systemd/t3code.service`](../scripts/systemd/t3code.service):
   ```sh
   mkdir -p ~/.config/systemd/user ~/.config/t3code
   cp scripts/systemd/t3code.service ~/.config/systemd/user/
   sudo loginctl enable-linger "$USER"       # keeps it running when you log out
   systemctl --user daemon-reload && systemctl --user enable --now t3code
   systemctl --user status t3code
   ```
   Restart only with `systemctl --user restart t3code`, so exactly one `t3 serve` runs. The unit binds T3 to `127.0.0.1`; remote access goes through Tailscale (below).
4. **Clone your repos** under one root, for example `~/repos/<repo>`, and list them in `config.json` under `projects`.

### Coding harnesses: subscriptions, not API keys

Sign each harness in on the host with your subscription. Don't set provider API keys; the service unit unsets the common ones so nothing bills by the token by accident.

| Harness | Typical job | Sign in |
|---|---|---|
| Claude Code | Implementer | `claude auth login` (or `claude`, then `/login`) |
| Cursor CLI (`cursor-agent`) | QA | `cursor-agent login` |
| Pi with a provider such as OpenCode Go | Pre-PR review | per Pi's docs; always pass the model explicitly |
| Codex CLI | Optional; often only as the GitHub PR review app | `codex login` with your ChatGPT account |

Then open T3 once (app or web) and confirm each harness shows its models. The option ids for effort and reasoning (for example `effort`, `thinking`, `reasoning_effort`) come from T3's model picker; copy them into `modelRouting` in `config.json`.

## 2. Apple host (optional)

Only needed for iOS or macOS apps.

- Install Xcode with the current iOS simulator runtime, the T3 Code desktop app, and Tailscale.
- Keep the T3 app open; the bot reaches its server over the tailnet.
- Clone only the repos that need Apple QA, under one folder such as `~/code`.
- Mark it `"role": "apple-only"` in `config.json`. The launch script refuses general coding there unless you override it for one call.
- Paid cloud mobile builds are on the `policy.askBefore` list by default: the bot asks before starting one.

## 3. Remote access with Tailscale

1. Put the primary host and the Apple host on your tailnet. Expose T3 over HTTPS inside the tailnet; T3's own `t3 pair --tailscale` sets this up and prints a pairing link. See T3's [remote access docs](https://github.com/pingdotgg/t3code/blob/main/docs/user/remote-access.md).
2. On the bot's box (no root network access), run `tailscaled` in userspace mode with a local HTTP proxy, then join the tailnet:
   ```sh
   sudo tailscaled --tun=userspace-networking --outbound-http-proxy-listen=localhost:8118 \
     --state=/var/lib/tailscale/tailscaled.state &
   sudo tailscale up
   ```
   Set `"proxy": "http://127.0.0.1:8118"` on each remote environment. The port is yours to choose.
3. Optional: run [`scripts/tailscale-watchdog.sh`](../scripts/tailscale-watchdog.sh) so the box reconnects on its own after an outage.

T3 Connect (T3's relay) is an alternative when you can't use Tailscale.

## 4. Credentials for the bot

The bot needs a T3 session per environment. Two options:

- **Bearer token (recommended).** On the host, run as the T3 user:
  ```sh
  (umask 077; t3 auth session issue --scope orchestration:read --scope orchestration:operate \
     --ttl 30d --label grokbot --token-only > grokbot.token)
  ```
  Move the file to the bot's box as `secrets/<env>.token` (mode 600) through a private channel, such as `scp` or your bot's secure form or vault. Never through chat. Point `auth.tokenFile` at it.
- **Browser session cookie.** If the host only offers pairing, pair a session (`t3 pair --tailscale`), exchange it at `/api/auth/browser-session`, save the cookie jar as `secrets/<env>.cookies` (mode 600) and point `auth.cookieFile` at it.

**Renewal.** Sessions expire (30 days in the example). Note the expiry date in the bot's memory and on its project status page, and renew a few days early by repeating the step above. Revoke old sessions with `t3 auth session list` and `t3 auth session revoke <id>`.

## 5. Bot box

```sh
git clone https://github.com/dkapo88/grokbot-t3-orchestration.git
cd grokbot-t3-orchestration
(cd scripts && npm ci --ignore-scripts)
cp config.example.json config.json && mkdir -p secrets && chmod 700 secrets
# edit config.json, add secrets/<env>.token
./scripts/t3-task.sh --env primary list
```

Install the skills from `skills/` into the bot, and set up the webhook and sweep routines ([webhooks-and-monitoring.md](webhooks-and-monitoring.md)).

## 6. T3 worktree cleanup settings

Set these once in T3 (Settings, Worktrees, for all projects and environments). See [hygiene.md](hygiene.md) for why.

| Setting | Value |
|---|---|
| Delete worktrees with deleted threads | On |
| Delete settled worktrees | On, after 3 days |
| Delete inactive worktrees | On, after 14 days |
| Delete merged worktrees | On |
| Delete unchanged worktrees | On |
| Keep worktrees with local changes | Uncommitted changes |
| Delete old browser artifacts | On, after 14 days |
| Delete old rotated logs | On, after 14 days |

## 7. Webhook secrets on the host

Implementer threads post to the PM bot's webhook with [`scripts/notify-pm.sh`](../scripts/notify-pm.sh). Put the URL and key in `~/.config/t3code/env` (mode 600), which the service unit loads:

```sh
PM_WEBHOOK_URL=https://...
PM_WEBHOOK_KEY=...
```

Use one pair per PM bot if several bots share a host (for example `WEBAPP_PM_WEBHOOK_URL`), and name the variables in each brief. Restart the service after editing.

## Troubleshooting

| Symptom | Check |
|---|---|
| Primary host unreachable | Is `tailscaled` running on the box? Then on the host: `systemctl --user status t3code` and `curl -sI http://127.0.0.1:3773`. |
| Apple host unreachable | Tailscale on the box, and the T3 app open on the Mac. |
| `HTTP 401` from the scripts | The session expired. Renew it (section 4). |
| Runs interrupted after a restart | Re-send the last message to the thread with `send --queue`. |
| A harness errors | Report it. Don't switch to another model; see [model-routing.md](model-routing.md). |
