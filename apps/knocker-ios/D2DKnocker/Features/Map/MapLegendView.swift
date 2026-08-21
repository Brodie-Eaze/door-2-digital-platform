// MapLegendView.swift — compact floating disposition legend + filter for the field map.
// A horizontally-scrolling row of material capsule chips (one per primary disposition):
// color dot + label + count. Tapping a chip toggles it in the filter set
// (empty set = show all). Designed to overlay a full-bleed map near the bottom.

import SwiftUI

struct MapLegendView: View {
    let counts: [KnockDisposition: Int]
    @Binding var filter: Set<KnockDisposition>

    init(counts: [KnockDisposition: Int], filter: Binding<Set<KnockDisposition>>) {
        self.counts = counts
        self._filter = filter
    }

    // Primary dispositions shown in the legend, in mockup order.
    private static let primary: [KnockDisposition] = [
        .convertedSale,   // Sale
        .appointment,     // Lead
        .noAnswer,        // Not home
        .callback,        // Callback
        .notInterested,   // Refused
        .doNotKnock,      // DNC
    ]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: D2DSpacing.sm) {
                ForEach(Self.primary) { disposition in
                    LegendChip(
                        disposition: disposition,
                        count: counts[disposition] ?? 0,
                        isSelected: filter.contains(disposition),
                        anyFilterActive: !filter.isEmpty,
                        onTap: { toggle(disposition) }
                    )
                }
            }
            .padding(.horizontal, D2DSpacing.md)
        }
    }

    private func toggle(_ disposition: KnockDisposition) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if filter.contains(disposition) {
            filter.remove(disposition)
        } else {
            filter.insert(disposition)
        }
    }
}

// MARK: - Legend chip

private struct LegendChip: View {
    let disposition: KnockDisposition
    let count: Int
    let isSelected: Bool
    /// True when at least one chip is selected — unselected chips dim to signal an active filter.
    let anyFilterActive: Bool
    let onTap: () -> Void

    private var label: String { disposition.displayName }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 6) {
                Circle()
                    .fill(disposition.color)
                    .frame(width: 9, height: 9)
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(isSelected ? .white : D2DColor.ink)
                Text("\(count)")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(isSelected ? Color.white.opacity(0.85) : D2DColor.muted)
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 7)
            .background(chipBackground)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .strokeBorder(isSelected ? Color.clear : D2DColor.line, lineWidth: 1)
            )
            .opacity(anyFilterActive && !isSelected ? 0.55 : 1)
            .shadow(color: .black.opacity(0.12), radius: 5, y: 2)
            .animation(.easeInOut(duration: 0.15), value: isSelected)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var chipBackground: some View {
        if isSelected {
            D2DColor.hero
        } else {
            Rectangle().fill(.regularMaterial)
        }
    }
}

// MARK: - Preview

#Preview {
    struct Harness: View {
        @State private var filter: Set<KnockDisposition> = [.convertedSale]
        var body: some View {
            ZStack {
                D2DColor.ink.ignoresSafeArea()
                VStack {
                    Spacer()
                    MapLegendView(
                        counts: [
                            .convertedSale: 3,
                            .appointment: 7,
                            .noAnswer: 42,
                            .callback: 5,
                            .notInterested: 18,
                            .doNotKnock: 2,
                        ],
                        filter: $filter
                    )
                    .padding(.bottom, 90)
                }
            }
        }
    }
    return Harness()
}
