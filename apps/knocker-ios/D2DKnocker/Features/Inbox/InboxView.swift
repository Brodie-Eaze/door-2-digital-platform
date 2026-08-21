// InboxView.swift — manager messages + push history + training nudges.

import SwiftUI

struct InboxView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = InboxViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.messages.isEmpty {
                    VStack(spacing: 16) {
                        ProgressView()
                        Text("Loading messages…")
                            .font(.system(size: 13))
                            .foregroundStyle(D2DColor.muted)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.messages.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "tray")
                            .font(.system(size: 40))
                            .foregroundStyle(D2DColor.soft)
                        Text("All caught up")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(D2DColor.ink)
                        Text("No messages from your manager yet")
                            .font(.system(size: 13))
                            .foregroundStyle(D2DColor.muted)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(viewModel.messages) { message in
                        InboxMessageRow(message: message, onMarkRead: {
                            viewModel.markRead(message, appState: appState)
                        })
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                    }
                    .listStyle(.plain)
                }
            }
            .background(D2DColor.paper)
            .navigationTitle("Inbox")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                if viewModel.unreadCount > 0 {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Mark all read") {
                            viewModel.markAllRead(appState: appState)
                        }
                        .font(.system(size: 13))
                        .foregroundStyle(D2DColor.accent)
                    }
                }
            }
            .refreshable {
                await viewModel.refresh(appState: appState)
            }
        }
        .task {
            await viewModel.refresh(appState: appState)
        }
    }
}

// MARK: - Message row

struct InboxMessageRow: View {
    let message: InboxMessage
    let onMarkRead: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Type icon
            ZStack {
                Circle()
                    .fill(message.type.tintColor.opacity(0.12))
                    .frame(width: 40, height: 40)
                Image(systemName: message.type.systemImage)
                    .font(.system(size: 16))
                    .foregroundStyle(message.type.tintColor)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(message.senderName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(D2DColor.ink)
                    Spacer()
                    Text(message.receivedAt.relativeFormatted)
                        .font(.system(size: 11))
                        .foregroundStyle(D2DColor.muted)
                }
                Text(message.subject)
                    .font(.system(size: 14, weight: message.isRead ? .regular : .semibold))
                    .foregroundStyle(D2DColor.ink)
                    .lineLimit(1)
                Text(message.preview)
                    .font(.system(size: 12))
                    .foregroundStyle(D2DColor.muted)
                    .lineLimit(2)
            }

            if !message.isRead {
                Circle()
                    .fill(D2DColor.accent)
                    .frame(width: 8, height: 8)
                    .padding(.top, 4)
            }
        }
        .padding(12)
        .background(message.isRead ? D2DColor.surface : D2DColor.accent.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: D2DRadius.md))
        .contentShape(Rectangle())
        .onTapGesture { if !message.isRead { onMarkRead() } }
    }
}

// MARK: - Supporting types

struct InboxMessage: Identifiable {
    let id: String
    let senderName: String
    let subject: String
    let preview: String
    let type: MessageType
    let receivedAt: Date
    var isRead: Bool

    enum MessageType {
        case managerMessage, routeChange, trainingNudge, pushHistory, teamAlert

        var systemImage: String {
            switch self {
            case .managerMessage: return "person.crop.circle"
            case .routeChange:   return "arrow.triangle.turn.up.right.circle"
            case .trainingNudge: return "graduationcap"
            case .pushHistory:   return "bell"
            case .teamAlert:     return "person.3"
            }
        }
        var tintColor: Color {
            switch self {
            case .managerMessage: return D2DColor.accent
            case .routeChange:   return D2DColor.warn
            case .trainingNudge: return D2DColor.success
            case .pushHistory:   return D2DColor.muted
            case .teamAlert:     return D2DColor.danger
            }
        }
    }
}

// MARK: - Date formatting

private extension Date {
    var relativeFormatted: String {
        let diff = Date().timeIntervalSince(self)
        if diff < 60 { return "Just now" }
        if diff < 3600 { return "\(Int(diff / 60))m ago" }
        if diff < 86400 { return "\(Int(diff / 3600))h ago" }
        let f = DateFormatter(); f.dateFormat = "d MMM"
        return f.string(from: self)
    }
}
