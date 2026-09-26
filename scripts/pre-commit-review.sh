#!/usr/bin/env bash
set -e

STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|py)$' || true)

if [ -z "$STAGED" ]; then
  echo "No staged JS/TS/Python files to review."
  exit 0
fi

echo "Files staged for review:"
echo "$STAGED"
echo ""
echo "Running Bob Shell review..."
echo ""

FILE_REFS=$(echo "$STAGED" | sed 's/^/@/' | tr '\n' ' ')

bob -p "Review these staged changes for critical bugs, missing error handling, or security issues before commit: $FILE_REFS. Be brief — one line per real problem found. If there's nothing critical, say exactly: No blocking issues found." > .bob-review-output.md

cat .bob-review-output.md

echo ""
if grep -qi "no blocking issues" .bob-review-output.md; then
  echo "Bob found nothing blocking. Safe to commit."
else
  echo "Bob flagged something above — see .bob-review-output.md before pushing."
fi

exit 0
