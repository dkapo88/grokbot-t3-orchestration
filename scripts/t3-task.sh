#!/usr/bin/env bash
# Front door for the T3 helpers. See docs/orchestration.md.
#   t3-task.sh [--env NAME] launch <project-path> (--role R | <provider> <model>) --title "<task>" (--brief "<text>" | --brief-file F) [--option id=value] [--wait]
#   t3-task.sh [--env NAME] send <threadId|exact title> ("<msg>" | --file F) [--queue|--steer] [--project TITLE] [--wait]
#   t3-task.sh [--env NAME] list [--title SUBSTR] [--limit N] [--archived] [--json]
#   t3-task.sh [--env NAME] status <threadId>...
#   t3-task.sh [--env NAME] archive <threadId>... [--dry-run]
#   t3-task.sh [--env NAME] delete <threadId>... --yes
# --env picks an environment from config.json (default: defaultEnvironment). Config path: $T3_ORCH_CONFIG or ../config.json.
set -euo pipefail
if [ "${1:-}" = "--env" ]; then export T3_ENV="${2:?--env needs a name}"; shift 2; fi
D="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
cmd="${1:-}"; [ $# -gt 0 ] && shift
case "$cmd" in
  launch)  exec node --no-warnings "$D/t3-launch.mjs" "$@" ;;
  send)    exec node --no-warnings "$D/t3-send.mjs" "$@" ;;
  list)    exec node --no-warnings "$D/t3-list.mjs" "$@" ;;
  status)  exec node --no-warnings "$D/t3-status.mjs" "$@" ;;
  archive|delete) exec node --no-warnings "$D/t3-archive.mjs" "$cmd" "$@" ;;
  *) sed -n '2,9p' "$0" >&2; exit 2 ;;
esac
