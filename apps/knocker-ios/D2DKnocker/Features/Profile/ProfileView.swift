// ProfileView.swift — "Me": personal stats grid + leaderboard + settings.
// Matches the marketing-site mockup: avatar header, 2×2 stat-card grid
// (Knocks / Conversions / Revenue / Commission), LEADERBOARD · TODAY list.

import SwiftUI
import SwiftData

struct ProfileView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Knock.capturedAt, order: .reverse) private var allKnocks: [Knock]
    @State private var viewModel = ProfileViewModel()
    @State private var authViewModel = AuthViewModel()
    @State private var showSignOutConfirm = false
    @State private var showHistory = false

    private var todayKnocks: [Knock] {
        let start = Calendar.current.startOfDay(for: Date())
        return allKnocks.filter { $0.capturedAt >= start }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    liveEarnings
                    statGrid
                    DailyGoalRing(knocksToday: max(viewModel.knocksToday, todayKnocks.count), goal: 80,
                                  streakDays: appState.isOnShift ? 1 : 0)
                    DispositionBreakdownCard(knocks: todayKnocks)
                    leaderboard
                    appSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 24)
            }
            .background(D2DColor.paper)
            .navigationTitle("Me")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showHistory) { KnocksHistoryView() }
            .confirmationDialog("Sign out?", isPresented: $showSignOutConfirm, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { authViewModel.signOut(appState: appState, context: modelContext) }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You'll need to sign in again to record knocks.")
            }
        }
        .task { await viewModel.load(appState: appState) }
    }

    // MARK: - Header (square navy avatar + name + shift subtitle)

    private var header: some View {
        HStack(spacing: 14) {
            RoundedRectangle(cornerRadius: 14)
                .fill(D2DColor.hero)
                .frame(width: 56, height: 56)
                .overlay(
                    Text(initials)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(.white)
                )
            VStack(alignment: .leading, spacing: 3) {
                Text(appState.currentUser?.displayName ?? "Knocker")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(D2DColor.ink)
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(D2DColor.muted)
            }
            Spacer()
        }
    }

    // MARK: - Live earnings (hero count-up)

    private var liveEarnings: some View {
        LiveEarningsBanner(cents: appState.commissionCentsToday,
                           isOnShift: appState.isOnShift)
    }

    // MARK: - 2×2 stat grid

    private var statGrid: some View {
        let cols = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
        return LazyVGrid(columns: cols, spacing: 12) {
            MeStatCard(label: "KNOCKS TODAY",
                       value: "\(viewModel.knocksToday)",
                       sub: viewModel.knocksYesterday > 0 ? deltaText : nil,
                       subTone: .accent)
            MeStatCard(label: "CONVERSIONS",
                       value: "\(viewModel.conversionsToday)",
                       sub: viewModel.knocksToday > 0 ? String(format: "%.1f%% rate", viewModel.conversionRate) : nil,
                       subTone: .muted)
            MeStatCard(label: "REVENUE TODAY",
                       value: viewModel.revenueFormatted,
                       sub: "donor GMV", subTone: .muted)
            MeStatCard(label: "COMMISSION ACCRUED",
                       value: viewModel.commissionFormatted,
                       sub: "pre-payout", subTone: .muted)
        }
    }

    private var deltaText: String {
        let d = viewModel.knocksDelta
        return d >= 0 ? "+\(d) vs yest." : "\(d) vs yest."
    }

    // MARK: - Leaderboard

    private var leaderboard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("LEADERBOARD · TODAY")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)

            if viewModel.leaderboard.isEmpty {
                D2DCard {
                    VStack(spacing: 6) {
                        Image(systemName: "trophy")
                            .font(.system(size: 22))
                            .foregroundStyle(D2DColor.soft)
                        Text("Leaderboard updates as your team knocks today")
                            .font(.system(size: 13))
                            .foregroundStyle(D2DColor.muted)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                }
            } else {
                D2DCard(padded: false) {
                    VStack(spacing: 0) {
                        ForEach(Array(viewModel.leaderboard.enumerated()), id: \.element.id) { idx, row in
                            LeaderboardRowView(row: row)
                            if idx < viewModel.leaderboard.count - 1 {
                                Divider().padding(.leading, 56)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - App section

    private var appSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("APP")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)
            D2DCard(padded: false) {
                VStack(spacing: 0) {
                    Button { showHistory = true } label: {
                        rowLabel(icon: "list.bullet.rectangle", title: "Today's Knocks", tint: D2DColor.ink)
                    }
                    Divider().padding(.leading, 52)
                    NavigationLink {
                        SettingsView()
                    } label: {
                        rowLabel(icon: "gearshape", title: "Settings", tint: D2DColor.ink)
                    }
                    Divider().padding(.leading, 52)
                    Button { showSignOutConfirm = true } label: {
                        rowLabel(icon: "rectangle.portrait.and.arrow.right", title: "Sign out", tint: D2DColor.ink)
                    }
                }
            }
        }
    }

    private func rowLabel(icon: String, title: String, tint: Color) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(tint)
                .frame(width: 24)
            Text(title)
                .font(.system(size: 15))
                .foregroundStyle(D2DColor.ink)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }

    // MARK: - Derived

    private var initials: String {
        let name = appState.currentUser?.displayName ?? "K"
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }

    private var subtitle: String {
        if appState.isOnShift {
            return "On shift · recording knocks"
        }
        return appState.currentUser?.email ?? "Off shift"
    }
}

// MARK: - Stat card

private struct MeStatCard: View {
    enum Tone { case accent, muted }
    let label: String
    let value: String
    var sub: String?
    var subTone: Tone = .muted

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.4)
                .lineLimit(1)
            Text(value)
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(D2DColor.ink)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(sub ?? " ")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(sub == nil ? .clear : (subTone == .accent ? D2DColor.accent : D2DColor.muted))
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(D2DColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: D2DRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: D2DRadius.lg).strokeBorder(D2DColor.line2, lineWidth: 1))
    }
}

// MARK: - Leaderboard row

private struct LeaderboardRowView: View {
    let row: LeaderboardRow

    var body: some View {
        HStack(spacing: 12) {
            // Rank (trophy for #1)
            Group {
                if row.rank == 1 {
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(D2DColor.accent)
                } else {
                    Text("\(row.rank)")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(D2DColor.muted)
                }
            }
            .frame(width: 20)

            RoundedRectangle(cornerRadius: 8)
                .fill(row.isYou ? D2DColor.accent : D2DColor.hero)
                .frame(width: 30, height: 30)
                .overlay(
                    Text(initials)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                )

            Text(row.isYou ? "You" : row.name)
                .font(.system(size: 15, weight: row.isYou ? .semibold : .regular))
                .foregroundStyle(D2DColor.ink)

            Spacer()

            Text("\(row.knocks) · \(row.conversions)")
                .font(.system(size: 14, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(D2DColor.ink)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(row.isYou ? D2DColor.accentSoft.opacity(0.5) : Color.clear)
    }

    private var initials: String {
        let parts = row.name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

// MARK: - Live earnings banner

/// Prominent navy hero card showing today's accrued commission as a big,
/// count-up dollar figure. Reads `appState.commissionCentsToday`; the value
/// animates whenever the lead-dev's sale increment lands.
private struct LiveEarningsBanner: View {
    let cents: Int64
    let isOnShift: Bool

    /// Animated mirror of `cents` so the figure rolls up on change.
    @State private var displayCents: Double = 0
    @State private var pulse: Bool = false

    private var dollars: String {
        let value = displayCents / 100.0
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "en_US")
        let whole = displayCents.rounded()
        f.maximumFractionDigits = (Int64(whole) % 100 == 0) ? 0 : 2
        return f.string(from: NSNumber(value: value)) ?? "$0"
    }

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(D2DColor.accent)
                    Text("EARNED TODAY")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.65))
                        .tracking(0.6)
                }

                Text(dollars)
                    .font(.system(size: 38, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                    .contentTransition(.numericText(value: displayCents))
                    .scaleEffect(pulse ? 1.04 : 1.0)

                Text(isOnShift ? "Accruing live · pre-payout" : "Commission accrued · pre-payout")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
            }

            Spacer(minLength: 0)

            // Live pulse glyph on the trailing edge
            ZStack {
                Circle()
                    .fill(D2DColor.accent.opacity(0.18))
                    .frame(width: 54, height: 54)
                Image(systemName: "dollarsign.circle.fill")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(D2DColor.accent)
                    .scaleEffect(pulse ? 1.08 : 1.0)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: D2DRadius.xl)
                .fill(D2DColor.hero)
        )
        .overlay(
            RoundedRectangle(cornerRadius: D2DRadius.xl)
                .strokeBorder(D2DColor.heroLine, lineWidth: 1)
        )
        .shadow(color: D2DColor.ink.opacity(0.12), radius: 8, y: 3)
        .onAppear {
            // Roll up from zero on first appearance.
            displayCents = 0
            withAnimation(.easeOut(duration: 0.7)) {
                displayCents = Double(cents)
            }
        }
        .onChange(of: cents) { _, newValue in
            withAnimation(.snappy(duration: 0.5)) {
                displayCents = Double(newValue)
            }
            // Brief emphasis pulse when a new sale lands.
            withAnimation(.easeOut(duration: 0.18)) { pulse = true }
            withAnimation(.easeIn(duration: 0.32).delay(0.18)) { pulse = false }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Earned today \(dollars), pre-payout.")
    }
}
