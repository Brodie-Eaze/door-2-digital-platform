// KnocksHistoryView.swift — sheet listing TODAY's logged knocks with a
// disposition summary header, per-row sync status + photo thumbnail, and
// navigation into KnockDetailView (built by a separate agent).

import SwiftUI
import SwiftData

struct KnocksHistoryView: View {
    @Environment(\.dismiss) private var dismiss

    // Sorted newest-first at the store level; today-filtering happens in Swift
    // (a #Predicate over a computed start-of-day boundary isn't expressible).
    @Query(sort: \Knock.capturedAt, order: .reverse) private var allKnocks: [Knock]

    private var todayKnocks: [Knock] {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        guard let end = calendar.date(byAdding: .day, value: 1, to: start) else { return [] }
        return allKnocks.filter { $0.capturedAt >= start && $0.capturedAt < end }
    }

    var body: some View {
        NavigationStack {
            Group {
                if todayKnocks.isEmpty {
                    emptyState
                } else {
                    content
                }
            }
            .background(D2DColor.paper)
            .navigationTitle("Today's Knocks")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(D2DColor.accent)
                }
            }
        }
    }

    // MARK: - Content

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: D2DSpacing.md) {
                summaryHeader
                rows
            }
            .padding(.horizontal, D2DSpacing.md)
            .padding(.top, D2DSpacing.md)
            .padding(.bottom, D2DSpacing.lg)
        }
        .background(D2DColor.paper)
    }

    // MARK: - Summary header (chips of counts by disposition)

    private var summaryHeader: some View {
        let counts = dispositionCounts
        return VStack(alignment: .leading, spacing: D2DSpacing.sm) {
            HStack {
                Text("\(todayKnocks.count) KNOCKS")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(D2DColor.soft)
                    .tracking(0.5)
                Spacer()
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: D2DSpacing.sm) {
                    ForEach(counts, id: \.disposition) { entry in
                        SummaryChip(disposition: entry.disposition, count: entry.count)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    /// Ordered counts, preserving the canonical disposition case order.
    private var dispositionCounts: [(disposition: KnockDisposition, count: Int)] {
        var tally: [KnockDisposition: Int] = [:]
        for knock in todayKnocks {
            tally[knock.disposition, default: 0] += 1
        }
        return KnockDisposition.allCases.compactMap { disposition in
            guard let count = tally[disposition], count > 0 else { return nil }
            return (disposition, count)
        }
    }

    // MARK: - Rows

    private var rows: some View {
        D2DCard(padded: false) {
            VStack(spacing: 0) {
                ForEach(Array(todayKnocks.enumerated()), id: \.element.id) { idx, knock in
                    NavigationLink {
                        KnockDetailView(knock: knock)
                    } label: {
                        KnockHistoryRow(knock: knock)
                    }
                    .buttonStyle(.plain)
                    if idx < todayKnocks.count - 1 {
                        Divider().padding(.leading, 56)
                    }
                }
            }
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: D2DSpacing.md) {
            Image(systemName: "house")
                .font(.system(size: 34))
                .foregroundStyle(D2DColor.soft)
            Text("No knocks yet today")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(D2DColor.ink)
            Text("Logged knocks will appear here as you work your territory.")
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, D2DSpacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(D2DSpacing.lg)
        .background(D2DColor.paper)
    }
}

// MARK: - Summary chip

private struct SummaryChip: View {
    let disposition: KnockDisposition
    let count: Int

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(disposition.color)
                .frame(width: 8, height: 8)
            Text(disposition.displayName)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(D2DColor.ink)
            Text("\(count)")
                .font(.system(size: 12, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(D2DColor.muted)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(D2DColor.surface, in: Capsule())
        .overlay(Capsule().strokeBorder(D2DColor.line, lineWidth: 1))
    }
}

// MARK: - Row

private struct KnockHistoryRow: View {
    let knock: Knock

    var body: some View {
        HStack(spacing: D2DSpacing.md) {
            // Disposition dot + icon
            ZStack {
                Circle()
                    .fill(knock.disposition.color.opacity(0.15))
                    .frame(width: 36, height: 36)
                Image(systemName: knock.disposition.systemImage)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(knock.disposition.color)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(knock.addressLine.isEmpty ? "Unknown address" : knock.addressLine)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(D2DColor.ink)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(timeText)
                        .font(.system(size: 12))
                        .monospacedDigit()
                        .foregroundStyle(D2DColor.muted)
                    Text("·")
                        .font(.system(size: 12))
                        .foregroundStyle(D2DColor.soft)
                    Text(knock.disposition.displayName)
                        .font(.system(size: 12))
                        .foregroundStyle(D2DColor.muted)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: D2DSpacing.sm)

            syncIndicator

            if let thumbnail {
                Image(uiImage: thumbnail)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 36, height: 36)
                    .clipShape(RoundedRectangle(cornerRadius: D2DRadius.sm))
                    .overlay(
                        RoundedRectangle(cornerRadius: D2DRadius.sm)
                            .strokeBorder(D2DColor.line, lineWidth: 1)
                    )
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .background(D2DColor.surface)
    }

    // MARK: - Sync indicator

    @ViewBuilder
    private var syncIndicator: some View {
        switch knock.syncStatus {
        case .synced:
            D2DStatusPill(label: "Synced", tone: .success)
        case .syncing:
            D2DStatusPill(label: "Syncing", tone: .info)
        case .failed:
            D2DStatusPill(label: "Failed", tone: .danger)
        case .pending:
            D2DStatusPill(label: "Pending", tone: .muted)
        }
    }

    // MARK: - Derived

    private var timeText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: knock.capturedAt)
    }

    private var thumbnail: UIImage? {
        guard let path = knock.photoLocalPath, !path.isEmpty else { return nil }
        return UIImage(contentsOfFile: path)
    }
}
