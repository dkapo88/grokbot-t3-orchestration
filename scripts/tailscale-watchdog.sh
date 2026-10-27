#!/usr/bin/env bash
# Optional: keeps a userspace tailscaled alive on the bot's box, so it can reach T3 hosts over the tailnet.
# Restarts tailscaled after three failed checks in a row (about 90 seconds).
# Settings (env): TS_HTTP_PROXY_PORT (default 8118), TS_SOCKS_PORT (default 1055),
#                 TS_STATE (default /var/lib/tailscale/tailscaled.state), TS_WATCHDOG_LOG (default ~/.cache/ts-watchdog.log)
# Start after a reboot: setsid nohup ./tailscale-watchdog.sh >/dev/null 2>&1 &
set -u
HTTP_PORT="${TS_HTTP_PROXY_PORT:-8118}"; SOCKS_PORT="${TS_SOCKS_PORT:-1055}"
STATE="${TS_STATE:-/var/lib/tailscale/tailscaled.state}"
LOG="${TS_WATCHDOG_LOG:-$HOME/.cache/ts-watchdog.log}"; mkdir -p "$(dirname "$LOG")"
start_ts() {
  sudo pkill -f "tailscaled --tun" ; sleep 2
  sudo setsid nohup tailscaled --tun=userspace-networking \
    --socks5-server="localhost:$SOCKS_PORT" --outbound-http-proxy-listen="localhost:$HTTP_PORT" \
    --state="$STATE" >>/tmp/tailscaled.log 2>&1 &
}
bad=0
while true; do
  s=$(timeout 10 tailscale status --self 2>&1 | head -1)
  if [ -z "$s" ] || echo "$s" | grep -qiE "offline|failed to connect|not running|stopped"; then bad=$((bad+1)); else bad=0; fi
  if [ "$bad" -ge 3 ]; then
    echo "$(date '+%F %T') offline x3, restarting tailscaled: $s" >>"$LOG"
    start_ts; bad=0; sleep 60
  fi
  sleep 30
done
