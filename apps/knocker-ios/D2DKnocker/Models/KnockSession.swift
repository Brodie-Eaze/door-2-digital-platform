// KnockSession.swift — a shift session started when the knocker clocks in
// and ended when they clock out. All Knock records belong to a session.

import Foundation
import SwiftData

@Model
final class KnockSession {
    @Attribute(.unique) var id: UUID
    var serverSessionId: String?    // nil until synced
    var orgId: String
    var userId: String
    var territoryId: String?
    var startedAt: Date
    var endedAt: Date?
    var startLatitude: Double
    var startLongitude: Double
    var deviceId: String
    var syncStatusRaw: String

    init(
        orgId: String,
        userId: String,
        territoryId: String? = nil,
        startLatitude: Double,
        startLongitude: Double,
        deviceId: String
    ) {
        self.id = UUID()
        self.orgId = orgId
        self.userId = userId
        self.territoryId = territoryId
        self.startedAt = Date()
        self.startLatitude = startLatitude
        self.startLongitude = startLongitude
        self.deviceId = deviceId
        self.syncStatusRaw = "pending"
    }

    var isActive: Bool { endedAt == nil }

    var duration: TimeInterval? {
        guard let end = endedAt else { return nil }
        return end.timeIntervalSince(startedAt)
    }
}
