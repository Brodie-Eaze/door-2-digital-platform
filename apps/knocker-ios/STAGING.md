# Knocker iOS — staging & production release readiness

How the app resolves its API base URL and App Transport Security (ATS) per build
configuration, plus what you need for TestFlight / device builds.

## TL;DR: the one line the operator must edit for staging

Staging is a **Release**-config build pointed at the hosted (Railway) https API.
Set the staging host by editing the Release `D2D_API_BASE_URL` build setting in
`D2DKnocker.xcodeproj/project.pbxproj`:

```
D2D_API_BASE_URL = "https://api.d2d.io/v1";   // <- change to the Railway staging URL
```

Replace it with the placeholder filled in, e.g.:

```
D2D_API_BASE_URL = "https://STAGING-API-HOST/v1";
```

(Or override it without touching the file — pass it to xcodebuild:
`xcodebuild ... D2D_API_BASE_URL=https://STAGING-API-HOST/v1`, or set it in an
xcconfig / CI secret. The Info.plist substitutes `$(D2D_API_BASE_URL)` at build time.)

When you cut a real **production** build, set it back to `https://api.d2d.io/v1`.

> Because staging on Railway is served over **https**, it needs **no** ATS
> exception — a normal ATS-enforced Release build reaches it fine.

## How the base URL resolves (three tiers)

The base URL comes from the `D2D_API_BASE_URL` Info.plist key, substituted at
build time from the like-named **build setting** (see `project.pbxproj`).
`Config.swift` then guards it so a misconfigured value can't break local dev:

| Tier                                | Build config | `D2D_API_BASE_URL` build setting                           | Effective URL              |
| ----------------------------------- | ------------ | ---------------------------------------------------------- | -------------------------- |
| Local dev (simulator)               | Debug        | `http://localhost:3010/v1`                                 | `http://localhost:3010/v1` |
| Local dev (real device, same Wi-Fi) | Debug        | `http://192.168.20.41:3010/v1` (`[sdk=iphoneos*]` variant) | the Mac's LAN IP           |
| Staging                             | Release      | `https://STAGING-API-HOST/v1` (operator-set)               | the staging https URL      |
| Production                          | Release      | `https://api.d2d.io/v1`                                    | `https://api.d2d.io/v1`    |

Notes:

- In **Debug**, `Config.swift` only honours a plaintext/`localhost`/`127.0.0.1`
  override and otherwise falls back to `http://localhost:3010/v1`. This stops a
  stray https value from pulling the simulator off the local dev API.
- In **Release**, `Config.swift` trusts the injected https value and falls back to
  `https://api.d2d.io/v1` if it's empty.
- **Real-device Debug, IP changed?** Update the Debug
  `"D2D_API_BASE_URL[sdk=iphoneos*]"` build setting to the current LAN IP
  (`ipconfig getifaddr en0`) and rebuild.

## ATS (App Transport Security) — Debug vs Release

ATS is driven by the `ATS_ALLOWS_ARBITRARY_LOADS` build setting, substituted into
`Info.plist` as `NSAllowsArbitraryLoads`:

| Build config | `ATS_ALLOWS_ARBITRARY_LOADS` | Effect                                                                                                   |
| ------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Debug        | `YES`                        | Plaintext HTTP allowed → simulator/device can hit the local Fastify API over `http://`.                  |
| Release      | `NO`                         | ATS enforced → **https only**. Production and Railway https staging both satisfy this with no exception. |

`NSAllowsLocalNetworking` is always `YES`. It only permits plaintext to
local-network hosts (so a LAN dev API still works); it never loosens ATS for
public/internet hosts. The committed `Info.plist` therefore has **no broad
`NSAllowsArbitraryLoads: true`** baked in — Release is ATS-locked.

Verify on a built app:

```
/usr/libexec/PlistBuddy -c "Print :NSAppTransportSecurity" \
  <DerivedData>/Build/Products/Release-iphonesimulator/D2DKnocker.app/Info.plist
# Release -> NSAllowsArbitraryLoads = NO
```

## Code signing / TestFlight (real device)

The current `RUN-ON-IPHONE.md` covers cable-install with a **free** Apple ID
(7-day expiry, one device). For staging/prod distribution:

1. **Paid Apple Developer account** ($99/yr) on the team that owns
   bundle id `io.d2d.knocker`.
2. In Xcode → target `D2DKnocker` → **Signing & Capabilities**:
   - **Automatically manage signing** on, **Team** = the paid team.
   - Capabilities already declared in `D2DKnocker.entitlements`:
     **App Attest** (`com.apple.developer.devicecheck.appattest-environment`),
     **Push** (`aps-environment`), and **Data Protection**. These require matching
     provisioning from the paid team.
3. **Archive**: scheme `D2DKnocker`, **Release** config → Product → Archive →
   distribute to **App Store Connect** → TestFlight.
4. Bump `CFBundleVersion` (build number) for each upload; testers install OTA — no
   cable, no 7-day expiry.

## App Attest / attestation — current state (documented, not changed)

The codebase already has an App Attest path; **left as-is** by this hardening pass:

- `D2DKnocker/Services/Attestation/AttestationService.swift` wraps
  `DCAppAttestService` — generates a key (stored in Keychain) and produces an
  assertion per knock-batch challenge.
- `D2DKnocker/Services/API/APIClient.swift` attaches `X-App-Attest` +
  `X-App-Attest-Challenge` headers on `POST /knocks/batch`.
- On simulator/DEBUG it returns a `SIMULATOR_ATTESTATION_STUB` (DeviceCheck is
  unavailable there); on a real device it produces a genuine assertion.
- Entitlement `com.apple.developer.devicecheck.appattest-environment` is set to
  **`development`**. **For a production/TestFlight build, change this to
  `production`** (TestFlight + App Store use the production App Attest environment)
  and ensure the server-side verifier validates against the same environment.
- Full verification requires the server-side App Attest verifier to be live; if it
  isn't, the server should treat a missing/stub token as unverified (it already
  receives `nil` from non-batch call sites, e.g. `ScheduleViewModel`).

This pass did **not** implement new attestation — only documented the above.
