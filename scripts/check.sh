#!/usr/bin/env bash
# Pre-push checks: syntax, JSON, no em or en dashes, no token-like strings, no private words.
# Private words: one per line in ~/.config/grokbot-t3-orchestration/private-words.txt (never commit that file).
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
for f in scripts/*.sh; do bash -n "$f" || fail=1; done
for f in scripts/*.mjs scripts/lib/*.mjs; do node --check "$f" || fail=1; done
for f in config.example.json templates/*.json; do node -e 'JSON.parse(require("fs").readFileSync(process.argv[1]))' "$f" || { echo "bad JSON: $f"; fail=1; }; done
FILES=$(git ls-files --cached --others --exclude-standard | grep -v -e '^scripts/package-lock.json$')
if grep -nP '[\x{2013}\x{2014}]' $FILES; then echo "found en or em dashes"; fail=1; fi
TOKENS='(ghp_|gho_|ghs_|github_pat_)[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[abpr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.|Bearer [A-Za-z0-9._-]{20,}'
if grep -nE "$TOKENS" $FILES; then echo "found token-like strings"; fail=1; fi
WORDS="${PRIVATE_WORDS_FILE:-$HOME/.config/grokbot-t3-orchestration/private-words.txt}"
if [ -f "$WORDS" ]; then
  if grep -niF -f <(grep -v '^\s*$' "$WORDS") $FILES; then echo "found private words"; fail=1; fi
else echo "note: no private-words list at $WORDS; skipped that scan"; fi
[ $fail = 0 ] && echo "checks passed" || { echo "checks FAILED"; exit 1; }
