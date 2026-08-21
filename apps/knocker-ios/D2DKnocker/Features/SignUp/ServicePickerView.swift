// ServicePickerView.swift — choose a service/plan to sign the customer up to.
// The catalog is the ORG's real offerings, fetched from the platform and cached
// for offline use. Shows loading / empty / error states honestly — never fake
// demo tiers.

import SwiftUI

struct ServicePickerView: View {
    let onSelect: (ServiceOffering) -> Void
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var store = CatalogStore.shared

    var body: some View {
        NavigationStack {
            content
                .background(D2DColor.paper)
                .navigationTitle("Choose a plan")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Cancel") { dismiss() }.foregroundStyle(D2DColor.muted)
                    }
                }
                .task { await store.load(appState: appState) }
        }
    }

    @ViewBuilder
    private var content: some View {
        if !store.offerings.isEmpty {
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(store.offerings) { service in
                        Button {
                            onSelect(service)
                            dismiss()
                        } label: {
                            row(service)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
        } else if case .loading = store.state {
            loadingState
        } else if case .failed(let message) = store.state {
            errorState(message)
        } else {
            emptyState
        }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView().tint(D2DColor.accent)
            Text("Loading services…")
                .font(.system(size: 14))
                .foregroundStyle(D2DColor.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "tray")
                .font(.system(size: 34))
                .foregroundStyle(D2DColor.soft)
            Text("No services configured yet")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(D2DColor.ink)
            Text("Your manager sets these in the platform.")
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.muted)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 30))
                .foregroundStyle(D2DColor.danger)
            Text("Couldn't load services")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(D2DColor.ink)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.muted)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await store.load(appState: appState, force: true) }
            }
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(D2DColor.accent)
            .padding(.top, 4)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func row(_ service: ServiceOffering) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(service.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(D2DColor.ink)
                    if service.highlighted {
                        Text("POPULAR")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(D2DColor.accent)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(D2DColor.accentSoft, in: Capsule())
                    }
                }
                if !service.blurb.isEmpty {
                    Text(service.blurb)
                        .font(.system(size: 13))
                        .foregroundStyle(D2DColor.muted)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(service.priceLabel)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(D2DColor.ink)
                Text(service.frequency.label)
                    .font(.system(size: 11))
                    .foregroundStyle(D2DColor.soft)
            }
        }
        .padding(14)
        .background(D2DColor.surface, in: RoundedRectangle(cornerRadius: D2DRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: D2DRadius.lg)
                .strokeBorder(service.highlighted ? D2DColor.accent.opacity(0.5) : D2DColor.line2,
                              lineWidth: service.highlighted ? 1.5 : 1)
        )
    }
}
