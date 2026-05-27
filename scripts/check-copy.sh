#!/usr/bin/env bash
#
# scripts/check-copy.sh
#
# Lint guard for Polish sprint D — fails the build if any operator-facing
# UI re-introduces banned voice patterns. See docs/VOICE.md.
#
# Wired as `pnpm copy:check`. Advisory today (warning-only on first
# rollout); CI can promote to blocking by setting EXIT_ON_FAIL=1.
#
# Forbidden in apps/web-operator/src/**/*.tsx + packages/ui-web/src/**/*.tsx:
#   - emoji code points (incl. flags, ✓, ✕, 🍽 etc.)
#   - exclamation marks inside string literals or JSX text
#   - "Oops" / "Whoops" / "Uh oh"
#   - "please " (lowercase, mid-sentence — skips "Please note:" headers)
#   - empty marketing adjectives: powerful / amazing / robust / seamless / awesome
#
# Allowed paths (false-positive amnesty):
#   - apps/web-operator/src/app/login/page.tsx          — demo passwords
#                                                         contain "!"
#   - apps/web-operator/src/app/mobile-preview/page.tsx — iOS in-app
#                                                         message preview
#                                                         intentionally
#                                                         renders user
#                                                         chat literally,
#                                                         including
#                                                         emojis sent by
#                                                         knockers, ✓ read
#                                                         indicators, and
#                                                         "Mark as read"
#                                                         tap targets that
#                                                         mimic iMessage.
#   - apps/web-operator/src/app/screens/page.tsx        — Phase 1 visual
#                                                         index of demo
#                                                         screens (uses
#                                                         "field-rep" as
#                                                         a descriptor of
#                                                         a screen genre,
#                                                         not display
#                                                         copy).

set -euo pipefail

ROOTS=(
  "apps/web-operator/src"
  "packages/ui-web/src"
)
INCLUDE_GLOB='*.{ts,tsx}'

# Files exempted from one or more checks. ripgrep accepts repeatable -g flags.
EXEMPT_GLOBS=(
  '!apps/web-operator/src/app/login/page.tsx'
  '!apps/web-operator/src/app/api/session/demo/route.ts'
  '!apps/web-operator/src/app/mobile-preview/page.tsx'
)

TOTAL_FAILS=0
ADVISORY=${COPY_CHECK_ADVISORY:-0} # default = enforce
RG_BASE=(rg --no-heading --line-number --color=never)

check() {
  local label="$1"
  local pattern="$2"
  local hint="$3"

  # Build the per-check ripgrep call. Each call scans every ROOT under
  # the canonical include glob, minus the per-check EXEMPT_GLOBS.
  local matches=""
  local root
  for root in "${ROOTS[@]}"; do
    local hits
    hits=$("${RG_BASE[@]}" -g "$INCLUDE_GLOB" \
      "${EXEMPT_GLOBS[@]/#/-g}" \
      -e "$pattern" "$root" 2>/dev/null || true)
    if [[ -n "$hits" ]]; then
      matches+="$hits"$'\n'
    fi
  done

  local count
  count=$(printf '%s' "$matches" | grep -c '.' || true)
  if [[ $count -gt 0 ]]; then
    echo ""
    echo "FAIL [$label] · $count hit(s) · $hint"
    printf '%s' "$matches"
    TOTAL_FAILS=$((TOTAL_FAILS + count))
  else
    echo "OK   [$label]"
  fi
}

echo "==> Voice check (docs/VOICE.md)"

# 1. Emoji — broad Unicode pictograph + emoji-modifier ranges. Excludes
#    common box-drawing / arrow glyphs we already use (→ ↑ ↓ ⌘ etc).
check "no-emoji" \
  '[\x{1F000}-\x{1FFFF}\x{2600}-\x{27BF}\x{2700}-\x{27BF}\x{1F300}-\x{1F9FF}]|✓|✕|✗|🍽' \
  'use a Lucide icon (Check, X, Globe2, etc.) — never emoji'

# 2. Exclamation marks inside string literals (single, double, backtick).
#    We focus on display copy: anything inside "" or '' that ends with !
#    or has ! followed by closing quote / whitespace.
check "no-exclamation" \
  $'[\'"`][^\'"`]*![\'"`]' \
  'D2D voice never uses !. Cut it.'

# 3. Oops / Whoops / Uh oh.
check "no-oops" \
  '\b(Oops|Whoops|Uh oh)\b' \
  'broken/empty is not a personality moment — state the fact'

# 4. lowercase "please " (with trailing space) — skips "Please note:" headers.
check "no-please" \
  ' please ' \
  'be direct. drop "please".'

# 5. Empty marketing adjectives.
check "no-marketing-fluff" \
  '\b(powerful|amazing|robust|seamless|awesome)\b' \
  'replace with a specific claim + a number'

echo ""
echo "==> Voice check summary"
if [[ $TOTAL_FAILS -eq 0 ]]; then
  echo "OK · 0 voice regressions detected across ${#ROOTS[@]} root(s)"
  exit 0
fi

echo "FAIL · $TOTAL_FAILS voice regression(s). See docs/VOICE.md for the canonical voice rules."

if [[ "$ADVISORY" == "1" ]]; then
  echo "(advisory mode — exit 0 anyway; set COPY_CHECK_ADVISORY=0 to enforce)"
  exit 0
fi
exit 1
