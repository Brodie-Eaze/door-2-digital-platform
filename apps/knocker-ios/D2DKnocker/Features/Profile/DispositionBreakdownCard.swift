// DispositionBreakdownCard.swift — today's disposition mix for the "Me" screen.
// Proportional stacked bar (segmented by disposition color) + legend list.

import SwiftUI

struct DispositionBreakdownCard: View {

    private let counts: [KnockDisposition: Int]

    /// Build from a precomputed count map.
    init(counts: [KnockDisposition: Int]) {
        self.counts = counts
    }

    /// Build directly from today's knocks.
    init(knocks: [Knock]) {
        var tally: [KnockDisposition: Int] = [:]
        for knock in knocks {
            tally[knock.disposition, default: 0] += 1
        }
        self.counts = tally
    }

    // MARK: - Derived

    private var total: Int {
        counts.values.reduce(0, +)
    }

    /// Non-zero rows, sorted by count desc then by enum order for stable ties.
    private var rows: [(disposition: KnockDisposition, count: Int)] {
        KnockDisposition.allCases
            .compactMap { d in
                let c = counts[d] ?? 0
                return c > 0 ? (d, c) : nil
            }
            .sorted { lhs, rhs in
                if lhs.count != rhs.count { return lhs.count > rhs.count }
                return lhs.disposition.rawValue < rhs.disposition.rawValue
            }
    }

    // MARK: - Body

    var body: some View {
        D2DCard {
            VStack(alignment: .leading, spacing: D2DSpacing.md) {
                header
                if total == 0 {
                    emptyState
                } else {
                    stackedBar
                    legend
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("DISPOSITION MIX · TODAY")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)
            Spacer()
            if total > 0 {
                Text("\(total) knock\(total == 1 ? "" : "s")")
                    .font(.system(size: 12, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(D2DColor.muted)
            }
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 6) {
            Image(systemName: "chart.bar")
                .font(.system(size: 22))
                .foregroundStyle(D2DColor.soft)
            Text("No knocks logged today yet")
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
    }

    // MARK: - Stacked bar

    private var stackedBar: some View {
        GeometryReader { geo in
            let width = geo.size.width
            HStack(spacing: 0) {
                ForEach(rows, id: \.disposition) { row in
                    Rectangle()
                        .fill(row.disposition.color)
                        .frame(width: segmentWidth(for: row.count, total: total, in: width))
                }
            }
        }
        .frame(height: 14)
        .clipShape(RoundedRectangle(cornerRadius: D2DRadius.sm))
        .overlay(
            RoundedRectangle(cornerRadius: D2DRadius.sm)
                .strokeBorder(D2DColor.line2, lineWidth: 1)
        )
        .accessibilityElement()
        .accessibilityLabel("Disposition breakdown for today")
    }

    /// Proportional width with a small floor so a 1-knock segment stays visible.
    private func segmentWidth(for count: Int, total: Int, in width: CGFloat) -> CGFloat {
        guard total > 0, width > 0 else { return 0 }
        let raw = width * CGFloat(count) / CGFloat(total)
        return max(raw, 3)
    }

    // MARK: - Legend

    private var legend: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.disposition) { idx, row in
                legendRow(disposition: row.disposition, count: row.count)
                if idx < rows.count - 1 {
                    Divider().padding(.vertical, 2)
                }
            }
        }
    }

    private func legendRow(disposition: KnockDisposition, count: Int) -> some View {
        let pct = total > 0 ? Double(count) / Double(total) * 100 : 0
        return HStack(spacing: 10) {
            Circle()
                .fill(disposition.color)
                .frame(width: 10, height: 10)
            Text(disposition.label)
                .font(.system(size: 14))
                .foregroundStyle(D2DColor.ink)
            Spacer()
            Text("\(count)")
                .font(.system(size: 14, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(D2DColor.ink)
            Text(String(format: "%.0f%%", pct))
                .font(.system(size: 12, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(D2DColor.muted)
                .frame(width: 38, alignment: .trailing)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(disposition.label): \(count), \(Int(pct.rounded())) percent")
    }
}

// MARK: - Preview

#Preview("With data") {
    ScrollView {
        DispositionBreakdownCard(counts: [
            .noAnswer: 18,
            .notInterested: 7,
            .callback: 3,
            .convertedSale: 2,
            .appointment: 4,
            .doNotKnock: 1,
        ])
        .padding()
    }
    .background(D2DColor.paper)
}

#Preview("Empty") {
    DispositionBreakdownCard(counts: [:])
        .padding()
        .background(D2DColor.paper)
}
