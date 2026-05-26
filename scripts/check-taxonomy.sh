#!/usr/bin/env bash
#
# scripts/check-taxonomy.sh
#
# Lint guard for Polish sprint F — fails the build if any operator-facing
# UI re-introduces a forbidden status-tone or naming token.
#
# Wired as `pnpm taxonomy:check`. Run in CI before deploy.
#
# Forbidden in apps/web-operator/src/app/**/*.tsx:
#   - tone="warning"   → use tone="warn"
#   - tone="critical"  → use tone="danger"
#   - tone="neutral"   → use tone="muted"
#   - tone="error"     → use tone="danger"
#   - tone="ok"        → use tone="success"  (StatusDot in public/status is
#                        a local component with its own ServiceTone enum
#                        and is allowed to retain "ok" — we whitelist that
#                        path below)
#
set -euo pipefail

ROOT="apps/web-operator/src/app"
EXIT_CODE=0

check_token() {
  local pattern="$1"
  local hint="$2"
  local exclude_re="${3:-}"

  # ripgrep would be nicer but isn't guaranteed; stick with grep
  local matches
  if [[ -n "$exclude_re" ]]; then
    matches=$(grep -rn "$pattern" "$ROOT" --include='*.tsx' 2>/dev/null | grep -Ev "$exclude_re" || true)
  else
    matches=$(grep -rn "$pattern" "$ROOT" --include='*.tsx' 2>/dev/null || true)
  fi

  if [[ -n "$matches" ]]; then
    echo "FAIL: forbidden token '$pattern' — $hint"
    echo "$matches"
    echo ""
    EXIT_CODE=1
  fi
}

check_token 'tone="warning"' 'use tone="warn" instead'
check_token 'tone="critical"' 'use tone="danger" instead'
check_token 'tone="neutral"' 'use tone="muted" instead'
check_token 'tone="error"'   'use tone="danger" instead'
# tone="ok" is allowed only inside public/status/page.tsx (StatusDot local enum)
check_token 'tone="ok"'      'use tone="success" instead' '/public/status/page\.tsx'

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "OK taxonomy check passed — no forbidden tones detected in $ROOT"
else
  echo ""
  echo "Taxonomy check failed. See @d2d/ui-tokens/taxonomy for the canonical enums."
fi

exit $EXIT_CODE
