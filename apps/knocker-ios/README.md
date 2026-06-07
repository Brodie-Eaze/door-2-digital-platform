# apps/knocker-ios

**Door 2 Digital Knocker** — native iOS app for field reps. Swift 5.10 / SwiftUI / Swift Concurrency / SwiftData.

Built natively in Xcode (per Brodie's directive 2026-05-24) instead of Expo/React Native — the at-the-door experience demands native-grade performance, offline reliability, biometric integration, and App Attest device attestation.

## Bootstrap from this directory

Xcode projects can't be reliably created from CLI. The mobile engineer initialises the project once:

```
1. Open Xcode 15.4+ → Create New Project
2. iOS → App
3. Product Name: D2D Knocker
4. Team: Door 2 Digital LLC (or pilot's Apple Developer Team if white-label)
5. Organization Identifier: io.d2d
6. Bundle Identifier: io.d2d.knocker
   (For white-label builds, vary per BrandKit.appBundleId)
7. Interface: SwiftUI
8. Language: Swift
9. Storage: SwiftData
10. Include Tests: ✓
11. Save at: /Users/Brodie/D2D/d2d-platform/apps/knocker-ios/
```

Then drop the seed files from this directory into the new project:

- `D2DKnocker/D2DKnockerApp.swift` — App entry
- `D2DKnocker/Info.plist` — capabilities + Mapbox + ATS
- `D2DKnocker/Package.swift` (Swift Package Manager dependencies)
- `Packages/D2DKit/Package.swift` — shared local package

## Architecture

```
apps/knocker-ios/
├── D2DKnocker/                          App target
│   ├── D2DKnockerApp.swift             @main + WindowGroup + dependency wiring
│   ├── Info.plist                      Capabilities + Mapbox token + ATS
│   ├── ContentView.swift               TabView root
│   ├── Features/
│   │   ├── Map/                        Mapbox map + territory polygons + knock pins
│   │   ├── Schedule/                   Callbacks + pitch scripts
│   │   ├── Inbox/                      Manager messages + push history
│   │   ├── Profile/                    Stats + leaderboard + commission preview
│   │   ├── KnockFlow/                  Bottom sheet: disposition → lead form → signature
│   │   └── Auth/                       Login + biometric re-auth + SSO
│   ├── Services/
│   │   ├── API/                        URLSession + OpenAPI generated client
│   │   ├── OfflineSync/                SwiftData + sync queue
│   │   ├── Attestation/                App Attest token producer
│   │   ├── Location/                   CLLocationManager + background updates
│   │   ├── Camera/                     PhotosUI signature + photo capture
│   │   └── Keychain/                   Token storage
│   ├── Models/                         SwiftData @Model entities (mirror Prisma)
│   └── Resources/                      Assets, fonts, localized strings
├── Packages/
│   └── D2DKit/                         Local Swift Package — shared design tokens, components
│       └── Sources/D2DKit/
│           ├── Tokens.swift            Mirror @d2d/ui-tokens palette
│           ├── Typography.swift        Inter font registration
│           ├── Components/             Button, Card, StatusPill, Money native equivalents
│           └── ...
└── D2DKnockerTests/                    XCTest unit + UI tests
```

## Key SDK dependencies

Add via Swift Package Manager in Xcode:

- **MapboxMaps** — `https://github.com/mapbox/mapbox-maps-ios` (territory polygons, heat layers)
- **MapboxSearch** — geocoding
- **GRDB.swift** — `https://github.com/groue/GRDB.swift` (encrypted SQLite, alternative to SwiftData if iOS 16 support needed)
- **DeviceCheck** (system) — App Attest
- **CryptoKit** (system) — local DEK
- **LocalAuthentication** (system) — Face ID / Touch ID
- **AuthenticationServices** (system) — ASWebAuthenticationSession for SSO

## Capabilities to enable

In Signing & Capabilities:

- Push Notifications
- Background Modes → Location updates, Background fetch, Remote notifications
- App Attest
- Sign In with Apple (Phase 2 if charity orgs want it)
- Associated Domains: `applinks:knocker.d2d.io`, `webcredentials:knocker.d2d.io`

In Info.plist:

- `NSLocationAlwaysAndWhenInUseUsageDescription` — "D2D tracks your knock locations during shifts to verify field activity."
- `NSCameraUsageDescription` — "Capture door photos for signed conversions."
- `NSFaceIDUsageDescription` — "Re-authenticate after backgrounding."
- `NSPhotoLibraryAddUsageDescription` — only if exporting photos.

## Offline-first sync

Every knock written locally first (SwiftData / GRDB), then queued for upload via `OfflineSync`. The queue:

1. Persists outgoing knocks in a FIFO with attempt counts.
2. On reconnect, sends in batches of ≤500 via `POST /v1/knocks/batch` with `Idempotency-Key`.
3. Last-write-wins reconciliation (per ADR-0022).

## White-label

Builds vary by `BrandKit`. CI matrix (Phase 4+) produces:

- `io.d2d.knocker` (default D2D-branded)
- `<pilot-bundleId>` per signed pilot's BrandKit.appBundleId

Phase 0–1.4: single bundle ID, distribute via TestFlight Internal Testing + Play Internal Track. Public stores from Phase 4.

## Distribution

Phase 0–1.4: **TestFlight + Internal Testing only** — fastest, no store review delay.
Phase 4: App Store + per-tenant white-label submissions for enterprise pilots that bring their own Apple Developer accounts.

## Mobile engineer onboarding checklist

- [ ] Install Xcode 15.4+
- [ ] Install pnpm + Node 20 + run `pnpm install` at repo root
- [ ] Bootstrap project per "Bootstrap from this directory" above
- [ ] Add SPM dependencies
- [ ] Configure Mapbox public token in Info.plist
- [ ] Wire to local API: `NEXT_PUBLIC_API_URL=http://localhost:3010` analogue → `Config.swift` `apiBaseURL`
- [ ] Get on TestFlight test list
- [ ] Read `docs/adr/0022-offline-first-knocker-mobile.md` before any sync work
