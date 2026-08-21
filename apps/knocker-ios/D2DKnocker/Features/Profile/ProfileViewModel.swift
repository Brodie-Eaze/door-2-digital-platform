// ProfileViewModel.swift

import Foundation
import Observation

struct LeaderboardRow: Identifiable {
    let id: String
    let name: String
    let knocks: Int
    let conversions: Int
    let isYou: Bool
    let rank: Int
}

@Observable
final class ProfileViewModel {
    // Today's stats (real, from the daily-stats endpoint; 0 until the knocker works)
    var knocksToday = 0
    var conversionsToday = 0
    var knocksYesterday = 0
    var revenueCents = 0
    var commissionCents = 0
    var leaderboardRank: Int?
    var leaderboard: [LeaderboardRow] = []
    var isLoading = false

    private var apiClient = APIClient()

    var conversionRate: Double {
        knocksToday > 0 ? Double(conversionsToday) / Double(knocksToday) * 100 : 0
    }
    var knocksDelta: Int { knocksToday - knocksYesterday }

    var revenueFormatted: String { Self.dollars(revenueCents) }
    var commissionFormatted: String { Self.dollars(commissionCents) }

    @MainActor
    func load(appState: AppState) async {
        apiClient.accessToken = appState.accessToken
        isLoading = true
        defer { isLoading = false }

        let userId = appState.currentUser?.id ?? ""
        guard let stats = try? await apiClient.fetchDailyStats(orgId: appState.orgId, userId: userId) else {
            return
        }
        knocksToday = stats.knocksToday
        conversionsToday = stats.conversionsToday
        commissionCents = stats.commissionCentsToday
        // Drive the hero "Live earnings" banner from the REAL server-computed
        // commission (the commission plan lives server-side), not a client-side
        // guess. Previously the banner summed sale PRICES as if they were the
        // rep's commission — a big overstatement of their earnings.
        appState.commissionCentsToday = Int64(stats.commissionCentsToday)
        knocksYesterday = stats.knocksYesterday ?? 0
        revenueCents = stats.revenueCentsToday ?? 0
        leaderboardRank = stats.leaderboardRank
        leaderboard = (stats.leaderboard ?? []).enumerated().map { idx, e in
            LeaderboardRow(id: e.userId, name: e.name, knocks: e.knocks,
                           conversions: e.conversions, isYou: e.isYou, rank: idx + 1)
        }
        // Keep global state in sync for the Map HUD strip.
        appState.knocksToday = stats.knocksToday
        appState.conversionsToday = stats.conversionsToday
    }

    private static func dollars(_ cents: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "en_US")   // "$" symbol, not "USD"
        f.maximumFractionDigits = (cents % 100 == 0) ? 0 : 2
        return f.string(from: NSNumber(value: Double(cents) / 100.0)) ?? "$0"
    }
}
