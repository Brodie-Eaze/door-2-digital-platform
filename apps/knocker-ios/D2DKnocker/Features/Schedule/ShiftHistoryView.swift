// ShiftHistoryView.swift — list of past shifts (date, time range, duration, knock count).

import SwiftUI
import SwiftData

struct ShiftHistoryView: View {
    @Environment(\.modelContext) private var modelContext

    @Query(sort: \KnockSession.startedAt, order: .reverse)
    private var sessions: [KnockSession]

    @Query private var knocks: [Knock]

    /// Knock counts keyed by the identifiers a Knock.sessionId may carry
    /// (a KnockSession's local UUID string or its server session id).
    private var knockCountsBySessionId: [String: Int] {
        Dictionary(knocks.map { ($0.sessionId, 1) }, uniquingKeysWith: +)
    }

    private func knockCount(for session: KnockSession) -> Int {
        let counts = knockCountsBySessionId
        var total = counts[session.id.uuidString.lowercased()] ?? 0
        total += counts[session.id.uuidString] ?? 0
        if let server = session.serverSessionId, server != session.id.uuidString {
            total += counts[server] ?? 0
        }
        return total
    }

    /// Past (ended) shifts only — an active shift lives on the Schedule screen.
    private var pastSessions: [KnockSession] {
        sessions.filter { $0.endedAt != nil }
    }

    var body: some View {
        ScrollView {
            if pastSessions.isEmpty {
                emptyState
            } else {
                LazyVStack(alignment: .leading, spacing: 8) {
                    Text("\(pastSessions.count) PAST SHIFTS")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(D2DColor.soft)
                        .tracking(0.5)
                        .padding(.horizontal, D2DSpacing.md)
                        .padding(.top, D2DSpacing.md)

                    D2DCard(padded: false) {
                        VStack(spacing: 0) {
                            ForEach(Array(pastSessions.enumerated()), id: \.element.id) { idx, session in
                                ShiftHistoryRow(
                                    session: session,
                                    knockCount: knockCount(for: session)
                                )
                                if idx < pastSessions.count - 1 {
                                    Divider().padding(.leading, D2DSpacing.md)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, D2DSpacing.md)
                }
                .padding(.bottom, D2DSpacing.lg)
            }
        }
        .background(D2DColor.paper)
        .navigationTitle("Shift History")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: D2DSpacing.md) {
            ZStack {
                Circle().fill(D2DColor.line2).frame(width: 56, height: 56)
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 24))
                    .foregroundStyle(D2DColor.soft)
            }
            Text("No past shifts yet")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(D2DColor.ink)
            Text("Once you clock out of a shift, it will appear here with your knock count and hours.")
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, D2DSpacing.lg)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }
}

// MARK: - Row

private struct ShiftHistoryRow: View {
    let session: KnockSession
    let knockCount: Int

    var body: some View {
        HStack(spacing: D2DSpacing.md) {
            VStack(alignment: .leading, spacing: 3) {
                Text(Self.dateFormatter.string(from: session.startedAt))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(D2DColor.ink)
                Text(timeRange)
                    .font(.system(size: 12))
                    .foregroundStyle(D2DColor.muted)
                    .monospacedDigit()
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 6) {
                Text(durationText)
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(D2DColor.ink2)
                    .monospacedDigit()
                D2DStatusPill(
                    label: "\(knockCount) knock\(knockCount == 1 ? "" : "s")",
                    tone: .info
                )
            }
        }
        .padding(.horizontal, D2DSpacing.md)
        .padding(.vertical, 12)
    }

    private var timeRange: String {
        let start = Self.timeFormatter.string(from: session.startedAt)
        guard let end = session.endedAt else { return "\(start) – active" }
        return "\(start) – \(Self.timeFormatter.string(from: end))"
    }

    private var durationText: String {
        let seconds: TimeInterval = session.duration
            ?? Date().timeIntervalSince(session.startedAt)
        let total = Int(max(0, seconds))
        let h = total / 3600
        let m = (total % 3600) / 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEE, MMM d"; return f
    }()
    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; return f
    }()
}
