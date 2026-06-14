// D2DKnockerApp.swift — app entry point.
// Wire order: KeychainService → AppState → restore auth from keychain →
// present RootView which gates on isAuthenticated.

import SwiftUI
import SwiftData

@main
struct D2DKnockerApp: App {
    @State private var appState = AppState()

    // SwiftData model container — shared across the app via environment.
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Knock.self,
            Lead.self,
            Sale.self,
            Address.self,
            KnockSession.self,
            PendingSync.self,
        ])
        let config = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false,
            allowsSave: true
        )
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Could not create SwiftData ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .onAppear { restoreSession() }
        }
        .modelContainer(sharedModelContainer)
    }

    // Restore access token + user from Keychain on cold launch so the
    // user doesn't re-authenticate every time they open the app.
    private func restoreSession() {
        let keychain = KeychainService()
        guard let token = keychain.accessToken, let user = keychain.currentUser else { return }
        // Restore immediately from the keychain so an offline cold-launch still
        // lands the rep in the app (the access token may be stale, but every
        // authed call self-heals via the 401→refresh path).
        appState.signIn(token: token, user: user)

        // Proactively refresh so the rep starts the shift with a fresh token
        // instead of eating a 401 on the first call. Best-effort: a NETWORK
        // failure (offline launch) must NOT sign them out — only an explicitly
        // rejected refresh token (genuine session end) does.
        guard keychain.refreshToken != nil else { return }
        Task { @MainActor in
            let client = APIClient(accessToken: token, keychain: keychain)
            do {
                try await client.refresh()
                appState.accessToken = keychain.accessToken
            } catch APIError.sessionExpired {
                appState.signOut()
            } catch {
                // Transient (offline / timeout) — keep the restored session; the
                // 401→refresh retry will recover once connectivity returns.
            }
        }
    }
}

// MARK: - Root gate

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isAuthenticated {
                ContentView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: appState.isAuthenticated)
    }
}
