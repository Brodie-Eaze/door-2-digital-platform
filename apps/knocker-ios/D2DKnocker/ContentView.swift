// ContentView.swift — main 4-tab shell after authentication.
// Tabs: Map · Schedule · Inbox · Me
// Persistent sync banner appears above tabs when queue is non-empty.

import SwiftUI
import SwiftData
import LocalAuthentication

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedTab: Tab = .map
    // App-owned sync engine — durable across sheets. Drains the queue on launch
    // and every time the app returns to the foreground (when signal returns),
    // so a sale recorded in a dead zone is never stranded.
    @State private var syncEngine = SyncEngine(keychain: KeychainService())
    @State private var reachability = ReachabilityMonitor()

    // Biometric resume-lock: if the app was backgrounded for >60s while a rep is
    // signed in, gate the field data (customer PII) behind Face ID on resume so a
    // lost/handed-off phone doesn't expose the book of business. (Threat model:
    // mobile — biometric re-auth on resume.)
    @State private var backgroundedAt: Date?
    @State private var isLocked = false
    @State private var unlocking = false
    private let lockThreshold: TimeInterval = 60

    enum Tab { case map, schedule, pipeline, me }

    var body: some View {
        ZStack(alignment: .top) {
            TabView(selection: $selectedTab) {
                MapTabView()
                    .tabItem { Label("Map", systemImage: "map.fill") }
                    .tag(Tab.map)

                ScheduleView()
                    .tabItem { Label("Schedule", systemImage: "calendar") }
                    .tag(Tab.schedule)

                PipelineView()
                    .tabItem { Label("Pipeline", systemImage: "person.2.fill") }
                    .tag(Tab.pipeline)

                ProfileView()
                    .tabItem { Label("Me", systemImage: "person.crop.circle.fill") }
                    .tag(Tab.me)
            }
            .tint(D2DColor.accent)
            // Share the ONE app-owned sync engine with every tab + presented sheet
            // (the knock sheet used to spin up a second engine that raced this one
            // on the same queue, double-POSTing and burning the retry budget).
            .environment(syncEngine)
            .task {
                syncEngine.authTokenOverride = appState.accessToken
                syncEngine.triggerSync(context: modelContext)
                appState.pendingSyncCount = syncEngine.pendingCount
                reachability.start { online in
                    appState.isOnline = online
                    if online { syncEngine.triggerSync(context: modelContext) }
                }
            }
            // Keep the drain's token in lockstep with the live session so a knock
            // logged right after sign-in (or after a silent refresh) always syncs.
            .onChange(of: appState.accessToken) { _, token in
                syncEngine.authTokenOverride = token
            }
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .background:
                    backgroundedAt = Date()
                case .active:
                    syncEngine.triggerSync(context: modelContext)
                    // Lock if we were away long enough and a rep is signed in.
                    if appState.isAuthenticated,
                       let since = backgroundedAt,
                       Date().timeIntervalSince(since) >= lockThreshold {
                        isLocked = true
                        Task { await attemptUnlock() }
                    }
                    backgroundedAt = nil
                default:
                    break
                }
            }
            // Keep the offline banner's queue count live from the real engine.
            .onChange(of: syncEngine.pendingCount) { _, c in appState.pendingSyncCount = c }

            // Floating sync/offline banner — above all tabs, dismisses when synced.
            // Purely visual: allowsHitTesting(false) guarantees the chip can NEVER
            // intercept a swipe or tap, so it can't block scrolling on any tab even
            // when a sync is stuck and the chip is pinned over the content.
            if appState.pendingSyncCount > 0 || !appState.isOnline {
                SyncStatusBanner(count: appState.pendingSyncCount, isOnline: appState.isOnline)
                    .padding(.top, 8)
                    .allowsHitTesting(false)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .animation(.spring(response: 0.4, dampingFraction: 0.8), value: appState.pendingSyncCount)
                    .animation(.spring(response: 0.4, dampingFraction: 0.8), value: appState.isOnline)
                    .zIndex(100)
            }

            // Biometric lock — covers everything (incl. PII) until re-auth.
            if isLocked {
                BiometricLockView(unlocking: unlocking) { Task { await attemptUnlock() } }
                    .transition(.opacity)
                    .zIndex(200)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: isLocked)
    }

    @MainActor
    private func attemptUnlock() async {
        guard !unlocking else { return }
        unlocking = true
        defer { unlocking = false }
        let context = LAContext()
        var error: NSError?
        // If biometrics aren't available/enrolled, fall back to device passcode
        // rather than locking the rep out permanently.
        let policy: LAPolicy = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
            ? .deviceOwnerAuthenticationWithBiometrics
            : .deviceOwnerAuthentication
        do {
            let ok = try await context.evaluatePolicy(policy, localizedReason: "Unlock to return to your field data.")
            if ok { isLocked = false }
        } catch {
            // Stay locked; the rep can retry via the button.
        }
    }
}

// MARK: - Biometric lock overlay

private struct BiometricLockView: View {
    let unlocking: Bool
    let onUnlock: () -> Void

    var body: some View {
        ZStack {
            D2DColor.ink.ignoresSafeArea()
            VStack(spacing: 20) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 52, weight: .semibold))
                    .foregroundStyle(.white)
                Text("Locked")
                    .font(.system(size: 22, weight: .bold)).foregroundStyle(.white)
                Text("Re-authenticate to protect your field data.")
                    .font(.system(size: 14)).foregroundStyle(.white.opacity(0.7))
                    .multilineTextAlignment(.center).padding(.horizontal, 40)
                Button(action: onUnlock) {
                    HStack(spacing: 8) {
                        if unlocking { ProgressView().tint(D2DColor.ink) }
                        Image(systemName: "faceid")
                        Text(unlocking ? "Unlocking…" : "Unlock")
                    }
                    .font(.system(size: 16, weight: .semibold)).foregroundStyle(D2DColor.ink)
                    .frame(height: 50).frame(maxWidth: 220)
                    .background(.white, in: RoundedRectangle(cornerRadius: D2DRadius.md))
                }
                .disabled(unlocking)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("App locked. Re-authenticate to continue.")
    }
}

// MARK: - Sync status banner

struct SyncStatusBanner: View {
    let count: Int
    let isOnline: Bool

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: isOnline ? "arrow.clockwise.icloud" : "wifi.slash")
                .font(.system(size: 12, weight: .semibold))
            Text(isOnline
                 ? "Syncing \(count) knock\(count == 1 ? "" : "s")…"
                 : "Offline — \(count) knock\(count == 1 ? "" : "s") queued")
                .font(.system(size: 12, weight: .medium))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .background(isOnline ? D2DColor.accent : D2DColor.warn, in: Capsule())
        .shadow(color: .black.opacity(0.15), radius: 6, y: 2)
    }
}

#Preview {
    ContentView()
        .environment(AppState())
}
