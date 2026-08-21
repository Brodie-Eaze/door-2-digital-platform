// AppState.swift — global observable state injected via SwiftUI environment.
// Uses @Observable (iOS 17 Observation framework) — no ObservableObject/Published.

import Foundation
import Observation

@Observable
final class AppState {
    // MARK: - Auth

    var isAuthenticated: Bool = false
    var currentUser: UserProfile?
    var accessToken: String?

    // MARK: - Session / shift

    var sessionId: String?
    var isOnShift: Bool = false
    var shiftStartedAt: Date?
    var orgId: String = ""
    /// The knocker's assigned territory (set by MapViewModel when it loads).
    /// Needed to start a server-side KnockSession before knocks can sync.
    var assignedTerritoryId: String?

    // MARK: - Daily stats (refreshed from API on login + foreground)

    var knocksToday: Int = 0
    var conversionsToday: Int = 0
    var commissionCentsToday: Int64 = 0

    // MARK: - Sync

    var pendingSyncCount: Int = 0
    var isOnline: Bool = true

    // MARK: - Inbox

    var unreadInboxCount: Int = 0

    // MARK: - Auth helpers

    func signIn(token: String, user: UserProfile) {
        accessToken = token
        currentUser = user
        orgId = user.orgId
        isAuthenticated = true
    }

    func signOut() {
        accessToken = nil
        currentUser = nil
        isAuthenticated = false
        isOnShift = false
        shiftStartedAt = nil
        sessionId = nil
        knocksToday = 0
        conversionsToday = 0
        commissionCentsToday = 0
        unreadInboxCount = 0
    }

    func startShift(sessionId: String) {
        self.sessionId = sessionId
        self.isOnShift = true
        self.shiftStartedAt = Date()
    }

    func endShift() {
        self.sessionId = nil
        self.isOnShift = false
        self.shiftStartedAt = nil
    }
}

// MARK: - UserProfile

struct UserProfile: Codable, Identifiable, Equatable {
    let id: String
    let email: String
    let givenName: String
    let familyName: String
    let role: String
    let orgId: String

    var displayName: String { "\(givenName) \(familyName)" }
    var initials: String {
        "\(givenName.prefix(1))\(familyName.prefix(1))".uppercased()
    }
}
