// CoverageStatsBar.swift — thin floating coverage summary overlay for the map.
// Shows territory name, a slim knocked/total progress bar with %, counts,
// conversions, and a "X left" remaining figure on a .regularMaterial pill.

import SwiftUI

struct CoverageStatsBar: View {
    let territoryName: String
    let knocked: Int
    let total: Int
    let conversions: Int

    init(territoryName: String, knocked: Int, total: Int, conversions: Int) {
        self.territoryName = territoryName
        self.knocked = knocked
        self.total = total
        self.conversions = conversions
    }

    // MARK: - Derived

    private var clampedKnocked: Int { max(0, min(knocked, max(total, 0))) }
    private var remaining: Int { max(0, total - clampedKnocked) }

    private var fraction: Double {
        guard total > 0 else { return 0 }
        return Double(clampedKnocked) / Double(total)
    }

    private var percentLabel: String {
        guard total > 0 else { return "—" }
        return "\(Int((fraction * 100).rounded()))%"
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Top line: territory name + percent
            HStack(spacing: 8) {
                Image(systemName: "map.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(D2DColor.accent)

                Text(territoryName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(D2DColor.ink)
                    .lineLimit(1)

                Spacer(minLength: 8)

                Text(percentLabel)
                    .font(.system(size: 13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(D2DColor.ink)
            }

            // Slim progress bar
            progressBar

            // Bottom line: counts · conversions · remaining
            HStack(spacing: 10) {
                metric(value: "\(clampedKnocked)/\(max(total, 0))", caption: "knocked")
                divider
                metric(value: "\(conversions)", caption: "conv.")
                divider
                metric(value: "\(remaining)", caption: "left")
                Spacer(minLength: 0)
            }
        }
        .padding(.horizontal, D2DSpacing.md)
        .padding(.vertical, 10)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: D2DRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: D2DRadius.lg)
                .strokeBorder(D2DColor.line2, lineWidth: 1)
        )
        .shadow(color: D2DColor.ink.opacity(0.10), radius: 6, y: 2)
    }

    // MARK: - Progress bar

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(D2DColor.line)
                Capsule()
                    .fill(D2DColor.accent)
                    .frame(width: max(0, min(1, fraction)) * geo.size.width)
            }
        }
        .frame(height: 5)
    }

    // MARK: - Metric pieces

    private func metric(value: String, caption: String) -> some View {
        HStack(spacing: 4) {
            Text(value)
                .font(.system(size: 12, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(D2DColor.ink)
            Text(caption)
                .font(.system(size: 11))
                .foregroundStyle(D2DColor.muted)
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(D2DColor.line)
            .frame(width: 1, height: 12)
    }
}

// MARK: - Preview

#Preview {
    ZStack {
        D2DColor.hero.ignoresSafeArea()
        VStack {
            CoverageStatsBar(
                territoryName: "North Ridge — Sector 4",
                knocked: 86,
                total: 240,
                conversions: 7
            )
            .padding(.horizontal, 16)
            Spacer()
        }
        .padding(.top, 60)
    }
}
