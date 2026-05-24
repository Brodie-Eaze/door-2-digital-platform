#!/usr/bin/env bash
# D2D — local demo bootstrap
# Run from repo root:
#   bash scripts/demo.sh
#
# Brings up the Operator Console (port 3011) + Org Console (port 3012)
# locally with no external dependencies (no Docker, no DB, no API).
#
# Open:
#   http://localhost:3011  → Door 2 Digital Operator Console (Brodie's view)
#   http://localhost:3012  → Hope Forward Org Console (Pilot-Charlie tenant)
#   http://localhost:3011/mobile-preview → iOS knocker app preview

set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Installing dependencies (pnpm install)…"
pnpm install --silent

echo ""
echo "→ Starting both web apps in parallel…"
echo ""
echo "  Operator Console:  http://localhost:3011"
echo "  Org Console:       http://localhost:3012"
echo "  iOS preview:       http://localhost:3011/mobile-preview"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

# Run both apps in parallel via Turbo
pnpm exec turbo run dev --filter=web-operator --filter=web-org --parallel
