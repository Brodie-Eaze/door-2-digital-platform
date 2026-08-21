// Knock.swift — SwiftData model for a knock event.
// Written offline-first to local SwiftData; queued in PendingSync for upload.
// idempotencyKey is the deduplication key the server uses on batch receipt.

import Foundation
import SwiftData

// MARK: - Disposition

enum KnockDisposition: String, Codable, CaseIterable, Identifiable {
    case noAnswer        = "no_answer"
    case notInterested   = "not_interested"
    case callback        = "callback"
    case doNotKnock      = "do_not_knock"
    case appointment     = "appointment"
    case convertedSale   = "converted_sale"
    case convertedDonation = "converted_donation"
    case hostile         = "hostile"
    case invalidAddress  = "invalid_address"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .noAnswer:          return "Not home"
        case .notInterested:     return "Not interested"
        case .callback:          return "Callback"
        case .doNotKnock:        return "Do not knock"
        case .appointment:       return "Appointment"
        case .convertedSale:     return "Sale"
        case .convertedDonation: return "Donation"
        case .hostile:           return "Hostile"
        case .invalidAddress:    return "Bad address"
        }
    }

    var systemImage: String {
        switch self {
        case .noAnswer:          return "house"
        case .notInterested:     return "hand.raised.fill"
        case .callback:          return "phone.arrow.up.right.fill"
        case .doNotKnock:        return "nosign"
        case .appointment:       return "calendar.badge.checkmark"
        case .convertedSale:     return "checkmark.circle.fill"
        case .convertedDonation: return "heart.fill"
        case .hostile:           return "exclamationmark.triangle.fill"
        case .invalidAddress:    return "questionmark.circle"
        }
    }

    var color: Color {
        switch self {
        case .convertedSale, .convertedDonation: return D2DColor.success
        case .callback, .appointment:            return D2DColor.accent
        case .doNotKnock, .hostile:              return D2DColor.danger
        case .notInterested:                     return D2DColor.warn
        case .noAnswer, .invalidAddress:         return D2DColor.soft
        }
    }

    /// Whether this disposition opens the lead capture form.
    var requiresLeadForm: Bool {
        switch self {
        case .convertedSale, .convertedDonation, .appointment, .callback: return true
        default: return false
        }
    }

    /// Whether this disposition requires a signature.
    var requiresSignature: Bool {
        switch self {
        case .convertedSale, .convertedDonation: return true
        default: return false
        }
    }
}

import SwiftUI  // needed for Color in disposition

// MARK: - Knock model

@Model
final class Knock {
    @Attribute(.unique) var id: UUID
    var sessionId: String
    var orgId: String
    var userId: String
    var territoryId: String?
    var addressLine: String
    var latitude: Double
    var longitude: Double
    var dispositionRaw: String      // KnockDisposition.rawValue
    var capturedAt: Date
    var serverReceivedAt: Date?
    var clientOffsetMs: Int64
    var photoLocalPath: String?
    var signatureLocalPath: String?
    var notes: String?
    var leadId: UUID?
    var idempotencyKey: String
    var syncStatusRaw: String       // "pending" | "syncing" | "synced" | "failed"
    var syncAttempts: Int
    var lastSyncError: String?

    init(
        sessionId: String,
        orgId: String,
        userId: String,
        territoryId: String? = nil,
        addressLine: String,
        latitude: Double,
        longitude: Double,
        disposition: KnockDisposition,
        capturedAt: Date = Date(),
        clientOffsetMs: Int64 = 0
    ) {
        let newId = UUID()
        self.id = newId
        self.sessionId = sessionId
        self.orgId = orgId
        self.userId = userId
        self.territoryId = territoryId
        self.addressLine = addressLine
        self.latitude = latitude
        self.longitude = longitude
        self.dispositionRaw = disposition.rawValue
        self.capturedAt = capturedAt
        self.clientOffsetMs = clientOffsetMs
        self.idempotencyKey = "knock-\(newId.uuidString.lowercased())"
        self.syncStatusRaw = "pending"
        self.syncAttempts = 0
    }

    var disposition: KnockDisposition {
        get { KnockDisposition(rawValue: dispositionRaw) ?? .noAnswer }
        set { dispositionRaw = newValue.rawValue }
    }

    var syncStatus: SyncStatus {
        get { SyncStatus(rawValue: syncStatusRaw) ?? .pending }
        set { syncStatusRaw = newValue.rawValue }
    }

    enum SyncStatus: String {
        case pending, syncing, synced, failed
    }
}
