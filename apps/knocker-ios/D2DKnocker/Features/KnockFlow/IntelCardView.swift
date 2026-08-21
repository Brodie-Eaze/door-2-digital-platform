// IntelCardView.swift — Pre-knock address intelligence card.
// Fetches Snowflake enrichment + Planet satellite data for the address
// being knocked and surfaces the key signals before the rep picks a disposition.
// Designed to be unobtrusive: loads async, degrades gracefully when data
// is unavailable (no API keys wired, address too new, satellite not yet run).

import SwiftUI

// MARK: - View

struct IntelCardView: View {
    let addressId: String?
    let territoryId: String?

    @State private var addressIntel: AddressIntelDTO?
    @State private var satelliteIntel: TerritoryIntelDTO?
    @State private var isLoading = true
    @State private var hasData = false

    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if isLoading {
                loadingCard
            } else if hasData {
                intelCard
            }
            // When hasData == false and not loading: render nothing.
            // No intel = no card. Never show a broken or empty state here —
            // the rep is about to knock, not debug a data pipeline.
        }
        .task {
            await fetchIntel()
        }
    }

    // MARK: - Loading skeleton

    private var loadingCard: some View {
        HStack(spacing: 10) {
            Image(systemName: "sparkles")
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.accent.opacity(0.5))
            Text("Loading area intel…")
                .font(.system(size: 12))
                .foregroundStyle(D2DColor.muted)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(D2DColor.surface, in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(D2DColor.line, lineWidth: 1)
        )
    }

    // MARK: - Intel card

    private var intelCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(D2DColor.accent)
                Text("AREA INTEL")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(D2DColor.accent)
                    .tracking(0.5)
            }

            HStack(spacing: 0) {
                if let intel = addressIntel {
                    IntelPill(
                        icon: "house.fill",
                        label: intel.prizmName ?? "Unknown segment",
                        sublabel: intel.incomeLabel
                    )
                    Divider().frame(height: 28).padding(.horizontal, 10)
                    IntelPill(
                        icon: "chart.bar.fill",
                        label: propensityLabel(intel.score),
                        sublabel: "Propensity"
                    )
                }
                if let sat = satelliteIntel, sat.constructionCount > 0 {
                    if addressIntel != nil {
                        Divider().frame(height: 28).padding(.horizontal, 10)
                    }
                    IntelPill(
                        icon: "building.2.fill",
                        label: "\(sat.constructionCount) builds",
                        sublabel: "Nearby activity"
                    )
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(D2DColor.surface, in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(D2DColor.accent.opacity(0.25), lineWidth: 1)
        )
    }

    // MARK: - Fetch

    private func fetchIntel() async {
        let client = APIClient(accessToken: appState.accessToken)
        async let addr: AddressIntelDTO? = {
            guard let id = addressId else { return nil }
            return try? await client.fetchAddressIntel(id: id)
        }()
        async let sat: TerritoryIntelDTO? = {
            guard let id = territoryId else { return nil }
            return try? await client.fetchTerritoryIntel(id: id)
        }()
        let (a, s) = await (addr, sat)
        addressIntel = a
        satelliteIntel = s
        isLoading = false
        hasData = a != nil || s != nil
    }

    // MARK: - Helpers

    private func propensityLabel(_ score: Double) -> String {
        switch score {
        case 0.7...: return "High fit"
        case 0.4...: return "Medium fit"
        default: return "Low fit"
        }
    }
}

// MARK: - Sub-components

private struct IntelPill: View {
    let icon: String
    let label: String
    let sublabel: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 10))
                    .foregroundStyle(D2DColor.accent)
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(D2DColor.ink)
                    .lineLimit(1)
            }
            if let sublabel {
                Text(sublabel)
                    .font(.system(size: 10))
                    .foregroundStyle(D2DColor.muted)
            }
        }
    }
}

// MARK: - DTO extensions

private extension AddressIntelDTO {
    var incomeLabel: String? {
        guard let income = medianHhIncomeUsd else { return nil }
        let k = Int(income / 1000)
        return "$\(k)k median"
    }
}
