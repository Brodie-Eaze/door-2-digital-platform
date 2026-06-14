// OfflineSyncBanner.swift — offline-queue visibility + manual sync trigger.
// Thin banner shown when knocks are queued, plus a reusable sync-status dot.

import SwiftUI

// MARK: - OfflineSyncBanner

/// A thin banner surfaced when there are unsynced knocks waiting in the queue.
/// Pure UI: the integrator supplies the live `pendingCount` (from a
/// `FetchDescriptor<PendingSync>` count) and wires `onSyncNow` to
/// `SyncEngine.triggerSync`. Renders nothing when `pendingCount == 0`.
struct OfflineSyncBanner: View {
    let pendingCount: Int
    let isOnline: Bool
    let onSyncNow: () -> Void

    init(pendingCount: Int, isOnline: Bool, onSyncNow: @escaping () -> Void) {
        self.pendingCount = pendingCount
        self.isOnline = isOnline
        self.onSyncNow = onSyncNow
    }

    var body: some View {
        if pendingCount > 0 {
            HStack(spacing: D2DSpacing.sm) {
                Image(systemName: isOnline ? "arrow.triangle.2.circlepath" : "wifi.slash")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(accentColor)

                VStack(alignment: .leading, spacing: 1) {
                    Text(countText)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(D2DColor.ink)
                    Text(isOnline ? "Ready to upload" : "Offline · will sync when connected")
                        .font(.system(size: 11))
                        .foregroundStyle(D2DColor.muted)
                        .lineLimit(1)
                }

                Spacer(minLength: D2DSpacing.sm)

                if isOnline {
                    Button(action: onSyncNow) {
                        Text("Sync now")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 7)
                            .background(D2DColor.accent, in: Capsule())
                    }
                    .buttonStyle(.plain)
                } else {
                    D2DStatusPill(label: "QUEUED", tone: .warn)
                }
            }
            .padding(.horizontal, D2DSpacing.md)
            .padding(.vertical, D2DSpacing.sm + 2)
            .background(backgroundColor)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(D2DColor.line)
                    .frame(height: 1)
            }
        }
    }

    private var countText: String {
        let noun = pendingCount == 1 ? "knock" : "knocks"
        return "\(pendingCount) \(noun) queued"
    }

    // Amber-slate (warn) treatment when offline, neutral surface when online.
    private var backgroundColor: Color {
        isOnline ? D2DColor.surface : D2DColor.warnSoft
    }

    private var accentColor: Color {
        isOnline ? D2DColor.accent : D2DColor.warn
    }
}

// MARK: - SyncStatusDot

/// A tiny colored dot representing a single knock's sync state, reusable in
/// list rows. All tones stay within the navy + blue invariant (no traffic lights).
struct SyncStatusDot: View {
    let status: Knock.SyncStatus

    init(status: Knock.SyncStatus) {
        self.status = status
    }

    var body: some View {
        Circle()
            .fill(fillColor)
            .frame(width: 8, height: 8)
            .overlay(
                Circle()
                    .strokeBorder(strokeColor, lineWidth: status == .pending ? 1 : 0)
            )
            .accessibilityLabel(accessibilityText)
    }

    private var fillColor: Color {
        switch status {
        case .pending: return D2DColor.surface   // hollow, awaiting upload
        case .syncing: return D2DColor.accent     // active light-blue
        case .synced:  return D2DColor.success    // dark blue (confirmed)
        case .failed:  return D2DColor.danger     // near-black navy
        }
    }

    private var strokeColor: Color {
        status == .pending ? D2DColor.soft : .clear
    }

    private var accessibilityText: String {
        switch status {
        case .pending: return "Pending sync"
        case .syncing: return "Syncing"
        case .synced:  return "Synced"
        case .failed:  return "Sync failed"
        }
    }
}

// MARK: - Previews

#Preview("Banner · offline") {
    VStack(spacing: 0) {
        OfflineSyncBanner(pendingCount: 7, isOnline: false, onSyncNow: {})
        OfflineSyncBanner(pendingCount: 1, isOnline: true, onSyncNow: {})
        Spacer()
    }
    .background(D2DColor.paper)
}

#Preview("Status dots") {
    HStack(spacing: 16) {
        SyncStatusDot(status: .pending)
        SyncStatusDot(status: .syncing)
        SyncStatusDot(status: .synced)
        SyncStatusDot(status: .failed)
    }
    .padding()
    .background(D2DColor.paper)
}
