# /elevate — Knocker iOS — Elevation Report (dry-run)

Agents: pen-tester · qa-engineer · performance-reviewer · customer-empathy-auditor.
Rails: build on branches · PII-first · agent-governance · merge/deploy only on Brodie's yes.

## Overall: 60/100 — strong bones, broken seams (bar = 90)

Good architecture (offline-first spine, honest empty/error states, PII-wipe intent, glove-sized targets).
Almost every problem is in the SEAMS — screens were redesigned and the logic behind them (consent,
appointment time, commission math) didn't come along. 3 polished screens are built but NOT wired in:
AppointmentPickerView, LeadFormView, OfflineSyncBanner.

## Per-feature scores

- Knock flow 58 — fake commission shown to rep; consent always false; CALLBACK has no time; NOT-HOME is 2 taps
- Auth+security 55 — PII-at-rest triad (data-protection class / cosmetic biometric lock / silent wipe); false "E2EE" claim
- Offline sync 62 — two SyncEngine instances race; batch poison dead-letters good knocks; partial-success hot-loop; silent dead-letter of sales
- Schedule 60 — double clock-in; offline clock-in never reaches payroll; callbacks have no real time
- Profile/Me 63 — most-prominent number is the fake commission; fake streak; hardcoded 80-goal
- Map 64 — GPS-less "Knock here" drops pin in Austin; .realistic elevation drains battery/data every shift
- Pipeline 70 — unbounded query; lossy name-split; today/all-time number mix

## Five "too close to see" findings

1. EARNED TODAY / SaleWon show the CUSTOMER's price as the rep's commission (KnockSheetView.swift:45). Payday betrayal.
2. Sign-out DELETES the unsynced queue (AuthViewModel.swift:88) — a dead-zone rep loses a day of sales.
3. Every field lead saves consentGiven=false — inline form dropped LeadFormView's consent toggle. TCPA hole.
4. Pilot is a charity; headline button says "SALE" (should be DONOR/SIGNED). Model supports .convertedDonation.
5. "Sync now" escape hatch (OfflineSyncBanner) is built but unplugged; inline chip is allowsHitTesting(false).

## TIER 0 — ship-blockers before Hope Forward pilot (trust/compliance/revenue/PII)

T0-1 kill fake commission (real rate or remove the line) [low]
T0-2 block/warn sign-out while pendingSyncCount>0; never delete unsynced queue [low]
T0-3 set consentGiven on real path; block sync of contactable leads w/o consent [med]
T0-4 PII-at-rest: NSFileProtectionComplete on store (F-01); biometric lock gates DATA + arms on cold launch (F-02); one verified non-silent wipe on every sign-out/expiry (F-03) [med-high]
T0-5 no Austin-fallback pin without GPS fix — block/warn "Knock here" until located [low]
T0-6 surface dead-lettered sales/photos instead of silent give-up [low]

## TIER 1 — high-impact / low-effort

T1-1 one-tap terminal dispositions (NOT HOME/REFUSED/DNC/bad addr) -> save+dismiss [low] _core "record a door in seconds"_
T1-2 map .flat imagery + onMapCameraChange(.onEnd) — biggest battery/data win [low]
T1-3 fix offline reverse-geocode hang (show lat/long or "Address pending") [low]
T1-4 remove false "End-to-end encrypted" footer [trivial]
T1-5 configurable headline disposition word per org (SIGNED/DONOR/SALE) [low]
T1-6 single app-owned SyncEngine; wire reachable "Sync now" banner [low-med]
T1-7 a11y labels on disposition grid + GPS badge; DNC visually distinct from REFUSED [low]

## TIER 2 — robustness/perf

T2-1 bound knock @Query/fetch to today + fetchLimit; add prune job (store never pruned) [med]
T2-2 sync: per-item batch failure isolation; treat unprocessed batch items as failed-with-backoff [med]
T2-3 double-tap Save guard on sale commit [low]
T2-4 double clock-in guard + queue offline clock-in/out so hours reach payroll [med]
T2-5 reconcileHomes O(homes\*knocks) -> spatial bucketing, off main actor [med]
T2-6 photo base64 + file I/O off main actor in sync drain [med]
T2-7 hoist per-call JSONDecoder/ISO8601DateFormatter/NumberFormatter to singletons [low]

## TIER 3 — delight

T3-1 wire AppointmentPickerView so CALLBACK/LEAD capture a real time [med]
T3-2 5s Undo on Knock-saved; confirm-before-discard on a signed sale [med]
T3-3 goal-reached moment (haptic + celebration) [low]
T3-4 real streak + quota-driven daily goal [med]
T3-5 new-hire empty states get an action (knock anywhere / message lead) [low]

## Re-break plan (when building)

Each item builds on a branch, then re-runs BREAK+WALK: must show (a) higher score, (b) no regression,
(c) /ship-ready still clears, (d) zero new security/PII/compliance findings. (c)+(d)+regression = hard block -> revert.
