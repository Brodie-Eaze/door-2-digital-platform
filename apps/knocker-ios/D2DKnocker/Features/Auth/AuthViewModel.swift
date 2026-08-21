// AuthViewModel.swift

import Foundation
import Observation
import LocalAuthentication
import SwiftData

@Observable
final class AuthViewModel {
    var email: String = ""
    var password: String = ""
    var isLoading: Bool = false
    var errorMessage: String?

    private let apiClient: APIClient
    private let keychain: KeychainService

    init() {
        apiClient = APIClient()
        keychain = KeychainService()
    }

    // MARK: - Login

    @MainActor
    func login(appState: AppState) async {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Enter your email and password."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response = try await apiClient.login(
                email: email.trimmingCharacters(in: .whitespaces).lowercased(),
                password: password,
                deviceId: UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
            )
            let user = response.user.toUserProfile()
            // Persist to Keychain
            keychain.accessToken = response.accessToken
            // Capture the refresh token so the 5-min access token can be silently
            // renewed mid-shift instead of bouncing the rep back to the login screen.
            keychain.refreshToken = response.refreshToken
            keychain.currentUser = user
            // Update global state
            appState.signIn(token: response.accessToken, user: user)
        } catch let err as APIError {
            switch err {
            case .httpError(let code, _):
                errorMessage = code == 401 ? "Invalid email or password." : "Login failed (\(code))."
            case .networkError:
                errorMessage = "No connection. Check your network and try again."
            default:
                errorMessage = err.localizedDescription
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Biometric re-auth

    func biometricChallenge() async -> Bool {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return false
        }
        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Re-authenticate to continue your shift."
            )
        } catch {
            return false
        }
    }

    // MARK: - Sign out

    @MainActor
    func signOut(appState: AppState, context: ModelContext? = nil) {
        keychain.clearAll()
        // PII-first: wipe all on-device customer data so the next rep on a shared
        // device can never see the prior rep's leads/sales/knocks.
        if let context {
            try? context.delete(model: Knock.self)
            try? context.delete(model: Lead.self)
            try? context.delete(model: Sale.self)
            try? context.delete(model: KnockSession.self)
            try? context.delete(model: PendingSync.self)
            try? context.save()
        }
        // Also delete the orphaned signature/photo PII files in Documents — the
        // DB wipe alone leaves these on disk on a shared device.
        let fm = FileManager.default
        if let dir = fm.urls(for: .documentDirectory, in: .userDomainMask).first,
           let files = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) {
            for url in files where url.lastPathComponent.hasPrefix("knock-")
                || url.lastPathComponent.hasPrefix("sig-") {
                try? fm.removeItem(at: url)
            }
        }
        appState.signOut()
    }
}

// UIDevice is UIKit — import it here
import UIKit
