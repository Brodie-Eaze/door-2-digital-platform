// SettingsView.swift — "Settings": read-only profile, field/notification prefs, sync, about.
// Pushed from ProfileView's APP section. Preferences persist via @AppStorage.

import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState

    // MARK: - Persisted preferences

    @AppStorage("pref.backgroundLocationOnShift") private var backgroundLocationOnShift = true
    @AppStorage("pref.hapticFeedback")            private var hapticFeedback = true
    @AppStorage("pref.distanceUnit")              private var distanceUnit = DistanceUnit.miles.rawValue
    @AppStorage("pref.pushNotifications")         private var pushNotifications = true
    @AppStorage("pref.callbackReminders")         private var callbackReminders = true
    @AppStorage("pref.lastSyncedAt")              private var lastSyncedEpoch: Double = 0

    @State private var isSyncing = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: D2DSpacing.lg) {
                profileSection
                fieldSection
                notificationsSection
                syncSection
                aboutSection
            }
            .padding(.horizontal, D2DSpacing.md)
            .padding(.top, D2DSpacing.xs)
            .padding(.bottom, D2DSpacing.lg)
        }
        .background(D2DColor.paper)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: - Profile (read-only)

    private var profileSection: some View {
        section(title: "PROFILE") {
            D2DCard(padded: false) {
                VStack(spacing: 0) {
                    infoRow(label: "Name", value: appState.currentUser?.displayName ?? "—")
                    divider
                    infoRow(label: "Email", value: appState.currentUser?.email ?? "—")
                    divider
                    infoRow(label: "Role", value: roleDisplay)
                }
            }
        }
    }

    private var roleDisplay: String {
        guard let role = appState.currentUser?.role, !role.isEmpty else { return "—" }
        return role
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
    }

    // MARK: - Field

    private var fieldSection: some View {
        section(title: "FIELD") {
            D2DCard(padded: false) {
                VStack(spacing: 0) {
                    toggleRow(
                        icon: "location.fill",
                        title: "Background location while on shift",
                        isOn: $backgroundLocationOnShift
                    )
                    divider
                    toggleRow(
                        icon: "hand.tap.fill",
                        title: "Haptic feedback",
                        isOn: $hapticFeedback
                    )
                    divider
                    HStack(spacing: 12) {
                        Image(systemName: "ruler")
                            .font(.system(size: 16))
                            .foregroundStyle(D2DColor.ink)
                            .frame(width: 24)
                        Text("Distance units")
                            .font(.system(size: 15))
                            .foregroundStyle(D2DColor.ink)
                        Spacer()
                        Picker("Distance units", selection: $distanceUnit) {
                            ForEach(DistanceUnit.allCases) { unit in
                                Text(unit.label).tag(unit.rawValue)
                            }
                        }
                        .pickerStyle(.segmented)
                        .fixedSize()
                        .tint(D2DColor.accent)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                }
            }
        }
    }

    // MARK: - Notifications

    private var notificationsSection: some View {
        section(title: "NOTIFICATIONS") {
            D2DCard(padded: false) {
                VStack(spacing: 0) {
                    toggleRow(
                        icon: "bell.fill",
                        title: "Push notifications",
                        isOn: $pushNotifications
                    )
                    divider
                    toggleRow(
                        icon: "clock.arrow.circlepath",
                        title: "Callback reminders",
                        isOn: $callbackReminders
                    )
                }
            }
        }
    }

    // MARK: - Sync

    private var syncSection: some View {
        section(title: "SYNC") {
            D2DCard {
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Last synced")
                                .font(.system(size: 13))
                                .foregroundStyle(D2DColor.muted)
                            Text(lastSyncedText)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(D2DColor.ink)
                        }
                        Spacer()
                        if appState.pendingSyncCount > 0 {
                            D2DStatusPill(label: "\(appState.pendingSyncCount) pending", tone: .warn)
                        } else {
                            D2DStatusPill(label: "Up to date", tone: .success)
                        }
                    }

                    Button(action: syncNow) {
                        HStack(spacing: 8) {
                            if isSyncing {
                                ProgressView()
                                    .controlSize(.small)
                                    .tint(.white)
                            } else {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .font(.system(size: 14, weight: .semibold))
                            }
                            Text(isSyncing ? "Syncing…" : "Sync now")
                                .font(.system(size: 15, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(D2DColor.accent, in: RoundedRectangle(cornerRadius: D2DRadius.md))
                    }
                    .disabled(isSyncing)
                }
            }
        }
    }

    private var lastSyncedText: String {
        guard lastSyncedEpoch > 0 else { return "Never" }
        let date = Date(timeIntervalSince1970: lastSyncedEpoch)
        let fmt = RelativeDateTimeFormatter()
        fmt.unitsStyle = .full
        return fmt.localizedString(for: date, relativeTo: Date())
    }

    /// Placeholder sync action. The integrating developer should replace the
    /// body with a call into SyncEngine; this only updates the timestamp + UI.
    private func syncNow() {
        guard !isSyncing else { return }
        isSyncing = true
        Task {
            try? await Task.sleep(nanoseconds: 800_000_000)
            await MainActor.run {
                lastSyncedEpoch = Date().timeIntervalSince1970
                isSyncing = false
            }
        }
    }

    // MARK: - About

    private var aboutSection: some View {
        section(title: "ABOUT") {
            D2DCard(padded: false) {
                VStack(spacing: 0) {
                    infoRow(label: "Version", value: Config.appVersion)
                    divider
                    infoRow(label: "Build", value: Config.buildNumber)
                }
            }
        }
    }

    // MARK: - Reusable rows

    private func section<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)
            content()
        }
    }

    private func infoRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 15))
                .foregroundStyle(D2DColor.muted)
            Spacer()
            Text(value)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(D2DColor.ink)
                .multilineTextAlignment(.trailing)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
    }

    private func toggleRow(icon: String, title: String, isOn: Binding<Bool>) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(D2DColor.ink)
                .frame(width: 24)
            Text(title)
                .font(.system(size: 15))
                .foregroundStyle(D2DColor.ink)
            Spacer()
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(D2DColor.accent)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var divider: some View {
        Divider().padding(.leading, 52)
    }
}

// MARK: - Distance unit

private enum DistanceUnit: String, CaseIterable, Identifiable {
    case miles = "mi"
    case kilometres = "km"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .miles:      return "mi"
        case .kilometres: return "km"
        }
    }
}

#Preview {
    NavigationStack {
        SettingsView()
            .environment(AppState())
    }
}
