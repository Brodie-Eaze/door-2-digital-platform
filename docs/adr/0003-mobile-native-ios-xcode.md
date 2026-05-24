# ADR-0003 — Mobile: native iOS via Xcode (Swift / SwiftUI)

- **Status:** Accepted
- **Date:** 2026-05-24
- **Phase:** 0

## Context

The knocker mobile app is the at-the-door experience for 200+ field reps. Requirements:
- Reliable offline capture (no network at many doors)
- Background GPS during shift
- Native camera + signature pad performance
- App Attest device attestation
- Biometric re-auth on resume
- Push notifications
- Performance feel at scale of 100+ knocks per shift

Initial plan v0.2 had Expo/React Native; Brodie redirected to native iOS via Xcode 2026-05-24.

## Decision

- **iOS:** native Swift 5.10 / SwiftUI / Swift Concurrency. Xcode 15.4+.
- **Storage:** SwiftData (iOS 17+) or GRDB.swift for offline knock queue.
- **Maps:** Mapbox iOS SDK.
- **Push:** APNs direct.
- **Auth:** ASWebAuthenticationSession for SSO, LocalAuthentication for biometric re-auth.
- **Distribution Phase 0–1.4:** TestFlight + Internal Testing only.
- **Android (Phase 2):** native Kotlin + Jetpack Compose, separate `apps/knocker-android` directory. Same backend contracts.

## Consequences

- iOS-only Day 1 — 200 knockers must be on iPhones (likely company-issued).
- Native performance + reliability for the highest-stakes surface.
- Higher engineering investment vs cross-platform (separate iOS + Android codebases later).
- App Attest baked in from Day 1 — no migration debt.

## Alternatives considered

- **Expo / React Native** — fast cross-platform but unreliable background GPS on iOS and weaker native performance for high-frequency capture.
- **Flutter** — single codebase but less mature App Attest + offline-first story.
- **PWA** — fastest to ship but no native push, no App Attest, weaker offline.
