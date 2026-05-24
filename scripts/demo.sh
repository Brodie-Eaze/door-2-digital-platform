#!/usr/bin/env bash
# D2D — local demo bootstrap
# Run from anywhere:
#   bash ~/D2D/d2d-platform/scripts/demo.sh
# Or from repo root:
#   bash scripts/demo.sh

set -e

# Move to repo root regardless of where this is called from
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Door 2 Digital — local demo"
echo "  Repo: $REPO_ROOT"
echo "════════════════════════════════════════════════════════════"
echo ""

# Free up ports if anything is hanging on them
for PORT in 3011 3012; do
  if lsof -ti:$PORT >/dev/null 2>&1; then
    echo "→ Port $PORT in use — killing existing process"
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
  fi
done

# Install only if node_modules missing (saves 20-30s on re-runs)
if [ ! -d "node_modules" ] || [ ! -d "apps/web-operator/node_modules" ]; then
  echo "→ Installing dependencies (first run — takes ~30s)…"
  pnpm install
  echo ""
fi

echo "→ Starting both apps…"
echo ""
echo "  🟢 Operator Console:  http://localhost:3011/overview"
echo "  🟢 Org Console:       http://localhost:3012/today"
echo "  🟢 iPhone preview:    http://localhost:3011/mobile-preview"
echo ""
echo "  Wait ~5 seconds for 'Ready in …ms' messages, then open the URLs above."
echo "  Press Ctrl+C here to stop both apps."
echo ""

# Run both apps in parallel via Turbo. --no-daemon avoids stale-state issues.
pnpm exec turbo run dev --filter=web-operator --filter=web-org --parallel --no-daemon
