#!/usr/bin/env bash
# Usage: scripts/commit.sh "<summary>" "<prompt text>"
# Stages everything, scans for secrets, runs tests, commits in contest format, pushes.
set -euo pipefail
if [ $# -lt 2 ] || [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: scripts/commit.sh \"<summary>\" \"<prompt text>\"" >&2
  exit 2
fi
SUMMARY="$1"
PROMPT="$2"
cd "$(git rev-parse --show-toplevel)"

git add -A

# Secret scan: staged .env* files
BAD_FILES="$(git diff --cached --name-only --diff-filter=ACMR | grep -E '(^|/)\.env' || true)"
if [ -n "$BAD_FILES" ]; then
  echo "ABORT: staged env file(s):" >&2
  echo "$BAD_FILES" >&2
  exit 1
fi

# Secret scan: added lines (excluding this script itself, which contains the patterns)
HITS="$(git diff --cached -U0 -- . ':(exclude)scripts/commit.sh' \
  | grep -E '^\+' | grep -vE '^\+\+\+ ' \
  | grep -nE 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN .*PRIVATE KEY' || true)"
if [ -n "$HITS" ]; then
  echo "ABORT: possible secret in staged diff:" >&2
  echo "$HITS" | cut -c1-120 >&2
  exit 1
fi

if ! npm test; then
  echo "ABORT: npm test failed" >&2
  exit 1
fi

if [ "$PROMPT" = "Manual edit" ]; then
  BODY="Manual edit"
else
  BODY="Prompt: \"$PROMPT\""
fi

git commit -F - <<MSG
$SUMMARY

$BODY

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG

git push origin main
git log -1 --format='Committed %H'
