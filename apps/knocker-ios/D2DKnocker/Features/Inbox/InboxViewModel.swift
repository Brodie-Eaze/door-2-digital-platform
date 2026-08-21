// InboxViewModel.swift

import Foundation
import Observation

@Observable
final class InboxViewModel {
    var messages: [InboxMessage] = []
    var isLoading: Bool = false

    var unreadCount: Int { messages.filter { !$0.isRead }.count }

    private var apiClient = APIClient()

    // MARK: - Refresh

    @MainActor
    func refresh(appState: AppState) async {
        isLoading = true
        defer { isLoading = false }
        apiClient.accessToken = appState.accessToken

        // Load from API; fall back to empty on error
        let iso = ISO8601DateFormatter()
        if let dtos = try? await apiClient.fetchInbox(orgId: appState.orgId) {
            messages = dtos.map { dto in
                InboxMessage(
                    id: dto.id,
                    senderName: dto.fromName,
                    subject: dto.subject,
                    preview: dto.body,
                    type: mapType(dto.priority),
                    receivedAt: iso.date(from: dto.sentAt) ?? Date(),
                    isRead: dto.readAt != nil
                )
            }
            appState.unreadInboxCount = messages.filter { !$0.isRead }.count
        }
    }

    func markRead(_ message: InboxMessage, appState: AppState) {
        if let idx = messages.firstIndex(where: { $0.id == message.id }) {
            messages[idx].isRead = true
            appState.unreadInboxCount = messages.filter { !$0.isRead }.count
        }
    }

    func markAllRead(appState: AppState) {
        for idx in messages.indices {
            messages[idx].isRead = true
        }
        appState.unreadInboxCount = 0
    }

    private func mapType(_ raw: String) -> InboxMessage.MessageType {
        switch raw {
        case "route_change":   return .routeChange
        case "training_nudge": return .trainingNudge
        case "push_history":   return .pushHistory
        case "team_alert":     return .teamAlert
        default:               return .managerMessage
        }
    }
}
