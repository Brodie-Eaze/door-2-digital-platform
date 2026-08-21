# D2D Knocker iOS — Feature Map (`/elevate` MAP phase)

> 47 Swift files · 6,826 LOC · SwiftUI + SwiftData, iOS 17 · door-to-door SALES field app.
> Dry-run: this MAP enumerates every feature, its entry points, the data it touches, and the **promise** it makes the user. BREAK / WALK / ELEVATE run against these.

| #   | Feature                       | Entry point                                                                    | Data touched                                           | The promise to the user                                                          |
| --- | ----------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1   | **Auth / Login**              | `LoginView` → `AuthViewModel.login` → `APIClient` → Keychain                   | JWT, UserProfile (Keychain), email/pw                  | "Sign in once; you stay signed in and your creds are safe."                      |
| 2   | **Field Map**                 | `MapTabView` + `MapViewModel` + `LocationService`                              | Territory polygon, 25 candidate homes, GPS, knock pins | "See your turf on satellite, know which doors are left, tap a house to work it." |
| 3   | **Knock + disposition**       | `KnockSheetView` + `DispositionPicker` + `KnockFlowViewModel`                  | `Knock` (SwiftData), GPS, address (reverse-geocode)    | "Record what happened at a door in seconds, even offline."                       |
| 4   | **Sign-up to service (SALE)** | `KnockSheetView` (sale path) + `ServicePickerView` + `ServiceCatalog`          | `Sale`, `Lead`, photo, signature                       | "Sign a customer up to a plan at the door and capture the sale."                 |
| 5   | **Photo + signature capture** | `CameraCaptureView`, `SignaturePadView`                                        | photoLocalPath, signature lines                        | "Snap the home and get the customer's signature as proof."                       |
| 6   | **Pipeline (Leads + Sales)**  | `PipelineView` (+ `AddLeadView`, `LeadDetailView`)                             | `Lead`, `Sale` queries, manual add                     | "See every lead and sale you've made; add leads; sign leads up later."           |
| 7   | **Schedule / shift**          | `ScheduleView` + `ScheduleViewModel`                                           | `KnockSession`, callbacks, pitch                       | "Clock in/out, see today's callbacks + appointments + your shift history."       |
| 8   | **Me / stats**                | `ProfileView` + `ProfileViewModel` (+ goal ring, breakdown, history, settings) | daily-stats API, local `Knock`                         | "See your numbers, your goal progress, and your day's work."                     |
| 9   | **Offline sync**              | `SyncEngine` + `PendingSync` + root sync banner                                | `PendingSync` queue → API batch                        | "Work with no signal; everything syncs when you're back online."                 |
| 10  | **Design system / PII**       | `DesignSystem`, model `toPublic` masking                                       | —                                                      | "Consistent, trustworthy UI; customer data handled carefully."                   |

**The money path (highest stakes):** #3 + #4 + #9 — knock → sign-up → Sale created → queued → synced. A lost or duplicated Sale is lost or double-counted revenue. This is where BREAK focuses hardest.

**Known scaffolding (already honest about):** the territory + 25 homes are a demo fixture (no `/v1/territories` fetch yet); daily-stats/inbox/callbacks endpoints 404 and degrade to empty; signature is captured but not yet persisted; PII is stored in plain SwiftData on-device.
