#!/usr/bin/env bash
# Post one milestone/blocker/completion event from an implementer thread to the PM bot's inbound webhook.
# Runs on the T3 host. The URL and key come from environment variables named in the brief; values are never printed.
#   notify-pm.sh --url-env PM_WEBHOOK_URL --key-env PM_WEBHOOK_KEY payload.json
#   echo '{"taskId":"..."}' | notify-pm.sh --url-env PM_WEBHOOK_URL --key-env PM_WEBHOOK_KEY -
# Rules: JSON only, at most 3500 bytes, one attempt, no redirects. Delivery counts only on an HTTP 2xx.
set -euo pipefail
URL_ENV=PM_WEBHOOK_URL; KEY_ENV=PM_WEBHOOK_KEY; MAX=3500
while [ $# -gt 1 ]; do
  case "$1" in
    --url-env) URL_ENV=$2; shift 2 ;;
    --key-env) KEY_ENV=$2; shift 2 ;;
    *) break ;;
  esac
done
SRC="${1:--}"
URL="${!URL_ENV:-}"; KEY="${!KEY_ENV:-}"
[ -n "$URL" ] || { echo "notify-pm: \$$URL_ENV is not set" >&2; exit 2; }
[ -n "$KEY" ] || { echo "notify-pm: \$$KEY_ENV is not set" >&2; exit 2; }
case "$URL" in https://*) ;; *) echo "notify-pm: webhook URL must be https://" >&2; exit 2 ;; esac
BODY="$(cat "$SRC")"
node -e 'JSON.parse(process.argv[1])' "$BODY" 2>/dev/null || { echo "notify-pm: payload is not valid JSON" >&2; exit 2; }
SIZE=$(printf '%s' "$BODY" | wc -c)
[ "$SIZE" -le "$MAX" ] || { echo "notify-pm: payload is $SIZE bytes; trim it to $MAX or less" >&2; exit 2; }
CODE=$(printf '%s' "$BODY" | curl -sS -o /dev/null -w '%{http_code}' --max-redirs 0 --max-time 30 \
  -X POST -H 'Content-Type: application/json' -H @<(printf 'Authorization: Bearer %s\n' "$KEY") \
  --data-binary @- "$URL" || true)
echo "notify-pm: HTTP $CODE ($SIZE bytes)"
case "$CODE" in 2??) exit 0 ;; *) echo "notify-pm: not delivered. Do not retry automatically; report it in the thread." >&2; exit 1 ;; esac
