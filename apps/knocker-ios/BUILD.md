# D2D Knocker — Build & Run Runbook

> Native iOS app (SwiftUI + SwiftData). 31 Swift source files, all in the target. Self-contained (no external SPM deps the app imports). Shared scheme `D2DKnocker` is committed so command-line builds work.

## Status of the toolchain (as of this writing)

- Xcode was **still downloading** (`/Applications/Xcode.appdownload`, ~248 KB of ~15–40 GB — barely started, not actively writing). Confirm the App Store download is actually progressing (not paused/queued).
- Until `Xcode.app` exists, **nothing below can run** — the app cannot be compiled with Command Line Tools alone.

## One-time setup (after Xcode finishes installing) — YOU must run the sudo steps

```bash
# 1. Point the toolchain at the full Xcode (NOT the Command Line Tools).
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# 2. Accept the license.
sudo xcodebuild -license accept

# 3. Make sure an iOS simulator runtime is installed (Xcode usually bundles one;
#    if `xcrun simctl list runtimes` shows no iOS runtime, run:)
xcodebuild -downloadPlatform iOS
```

_(Claude cannot run `sudo` — these three are yours. After step 1, `xcodebuild -version` and `xcrun simctl list devices` will work and Claude can drive the rest.)_

## Build for the Simulator (no Apple Developer account needed)

```bash
cd /Users/Brodie/D2D/door-2-digital-platform/apps/knocker-ios

# Pick an available simulator name from: xcrun simctl list devices available
xcodebuild \
  -project D2DKnocker.xcodeproj \
  -scheme D2DKnocker \
  -sdk iphonesimulator \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

- `CODE_SIGNING_ALLOWED=NO` lets it build for the Simulator with **no signing / no Apple Developer account**.
- First build downloads SwiftData + SwiftUI SDK bits; subsequent builds are fast.

## Run it in the Simulator

```bash
# Boot a simulator + open it
xcrun simctl boot "iPhone 16" 2>/dev/null; open -a Simulator

# Install + launch the built app (path is printed at the end of the build under DerivedData)
APP=$(find ~/Library/Developer/Xcode/DerivedData -name "D2DKnocker.app" -path "*Debug-iphonesimulator*" | head -1)
xcrun simctl install booted "$APP"
xcrun simctl launch booted io.d2d.knocker
```

## Point the app at a backend

The app reads `D2D_API_BASE_URL` from `Info.plist`. For local testing against the Fastify API:

- Run the Fastify API: `cd apps/api && pnpm dev` (defaults to `:3010`).
- In `D2DKnocker/Info.plist`, the `D2D_API_BASE_URL` is set to `https://api.d2d.io/v1` for release; the DEBUG fallback in `Config.swift` is `http://localhost:3010/v1`, so a Debug build already points at localhost.
- Simulator can reach `localhost` directly (same machine). For a physical device, use your Mac's LAN IP.

## On a physical iPhone (needs your Apple Developer account)

1. Open `D2DKnocker.xcodeproj` in Xcode.
2. Target → Signing & Capabilities → set your **Team** (free personal team works for 7-day installs; paid for TestFlight).
3. Plug in the iPhone, select it as the run destination, press ⌘R.
4. Trust the developer profile on the device: Settings → General → VPN & Device Management.

## Known stubs (intentional, device-only)

- `AttestationService.swift` — App Attest is stubbed for the Simulator (App Attest only runs on real hardware). Real attestation activates on a physical device with the `appattest-environment` entitlement (already set to `development`).

## BUILD STATUS — ✅ GREEN (2026-06-13)

`** BUILD SUCCEEDED **` on Xcode 26.5 / iOS SDK 26.5, iPhone 17 Pro simulator (iOS 26.5 runtime). All 31 Swift files compile. Installed + launched (`io.d2d.knocker`); login screen renders in house style. Verified command:

```bash
cd /Users/Brodie/D2D/door-2-digital-platform/apps/knocker-ios
xcodebuild -scheme D2DKnocker -sdk iphonesimulator -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO ONLY_ACTIVE_ARCH=YES build
```

### First-build errors fixed (8, in order)

1. `KnockPayload` / `CreateLeadRequest` were `Encodable` but `SyncEngine` decodes them back from stored JSON → changed to `Codable` (DTOs.swift).
2. `AttestationService` had a broken stub `private extension KeychainService` (couldn't see the file-private `readData`, its `write` was a `return true` stub) → added a real public `readString(forKey:)` / `writeString(_:forKey:)` API on KeychainService; deleted the stub.
3. `MapViewModel` used `MapCameraPosition` without `import SwiftUI` → added it.
4. `ProfileViewModel` referenced DTO fields that don't exist (`commissionCentsThisWeek`, `nextPayDate`, `leaderboardRank`) → use real `commissionCentsToday`; derive next-payday from real calendar math; `leaderboardRank = nil` (endpoint doesn't return it — screen omits it, no fake) + pass `orgId`/`userId` to `fetchDailyStats`.
5. `InboxViewModel` mapping was out of sync with `InboxMessageDTO` (real fields: `fromName`/`body`/`sentAt`/`readAt`/`priority`) and missing `orgId` → rewrote the map, ISO8601-parse `sentAt`, `isRead = readAt != nil`.
6. `ScheduleViewModel` `#Predicate` can't resolve an enum-case member → hoisted `KnockDisposition.callback.rawValue` to a local; `isActive` is computed so the session predicate uses stored `endedAt == nil` and we drop the get-only assignment.
7. `MapTabView` used non-existent `MapCompassButton()` → `MapCompass()`.
8. `Knock.init` read `id` before all stored props initialised → hoisted `let newId = UUID()`.

### AUTHENTICATED tabs — ✅ VERIFIED END-TO-END (2026-06-13)

Logged in as a seeded knocker against the live Fastify API + Postgres and walked all four tabs (Map = real MapKit satellite, Schedule = shift + pitch script, Inbox = empty-state, Me = real profile + live daily-stats). Real JWT, no fake bypass.

**3 additional fixes were needed to reach the backend** (beyond the 8 compile fixes): 9. `Info.plist` — added `NSAppTransportSecurity → NSAllowsLocalNetworking` (ATS was blocking the plaintext `http://localhost:3010` call → "No connection"). 10. `Config.swift` — in DEBUG, prefer `http://localhost:3010/v1` over the production `D2D_API_BASE_URL` plist value (it was calling `https://api.d2d.io`, which doesn't resolve). 11. `APIClient.buildRequest` — `URL(string: "/auth/login", relativeTo: baseURL)` dropped the `/v1` prefix (leading-slash = host-absolute) → every call 404'd. Now concatenates `base + path`.

**Backend bring-up steps (local dev):**

```bash
# Redis must be running (brew services start redis) — Postgres on 5432.
cd apps/api
createdb d2d_dev 2>/dev/null            # one-time
# .env: dev secrets via `openssl rand`, DATABASE_URL=postgresql://$USER@localhost:5432/d2d_dev, REDIS_URL=redis://localhost:6379
set -a; source .env; set +a
pnpm exec prisma migrate deploy
pnpm exec tsx prisma/seed-demo.ts        # orgs + admin users
KNOCKER_SEED_PASSWORD='<pw>' pnpm exec tsx prisma/seed-knocker.ts   # knocker@d2d.io (role=knocker)
pnpm exec tsx src/index.ts               # API on :3010
# then build/run the app (Debug → localhost) and log in as knocker@d2d.io.
```

The `.env` is gitignored; secrets are local-dev-only (`openssl rand`). `prisma/seed-knocker.ts` takes the password from `KNOCKER_SEED_PASSWORD` (never on disk).
