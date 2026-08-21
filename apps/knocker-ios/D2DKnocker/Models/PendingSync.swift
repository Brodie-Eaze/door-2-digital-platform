// PendingSync.swift — FIFO queue of operations waiting to be uploaded.
// The SyncEngine reads this queue, attempts uploads in order, and marks
// records as synced or increments the attempt count on failure.

import Foundation
import SwiftData

enum SyncOperationType: String, Codable {
    case createKnock    = "create_knock"
    case createLead     = "create_lead"
    case createSale     = "create_sale"
    case startSession   = "start_session"
    case endSession     = "end_session"
    case uploadPhoto    = "upload_photo"
    case uploadSignature = "upload_signature"
    case createPhoto    = "create_photo"   // POST /photos — uploads + holds the knock's property photo
}

@Model
final class PendingSync {
    @Attribute(.unique) var id: UUID
    var operationTypeRaw: String    // SyncOperationType.rawValue
    var entityId: String            // UUID string of Knock / Lead / Session
    var payloadJSON: String         // serialised request body
    var idempotencyKey: String
    var createdAt: Date
    var attempts: Int
    var lastAttemptAt: Date?
    var lastError: String?
    var completedAt: Date?

    init(
        operationType: SyncOperationType,
        entityId: UUID,
        payloadJSON: String,
        idempotencyKey: String
    ) {
        self.id = UUID()
        self.operationTypeRaw = operationType.rawValue
        self.entityId = entityId.uuidString
        self.payloadJSON = payloadJSON
        self.idempotencyKey = idempotencyKey
        self.createdAt = Date()
        self.attempts = 0
    }

    var operationType: SyncOperationType {
        SyncOperationType(rawValue: operationTypeRaw) ?? .createKnock
    }

    var isPending: Bool { completedAt == nil }
}
