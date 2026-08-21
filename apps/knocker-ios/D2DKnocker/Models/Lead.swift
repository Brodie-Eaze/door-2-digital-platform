// Lead.swift — locally cached lead record captured during knock flow.
// PII fields (name, phone, email) stored locally until synced to server.
// Once synced the server handles PII vault encryption.

import Foundation
import SwiftData

@Model
final class Lead {
    @Attribute(.unique) var id: UUID
    var knockId: UUID
    var orgId: String
    var givenName: String
    var familyName: String
    var phone: String
    var email: String
    var bestCallTime: String        // e.g. "morning", "afternoon", "evening"
    var vertical: String            // "charity" | "commercial"
    var notes: String
    var consentGiven: Bool
    var consentTimestamp: Date?
    var signatureLocalPath: String?
    var photoLocalPath: String?
    var syncStatusRaw: String       // "pending" | "synced" | "failed"
    var createdAt: Date

    init(
        knockId: UUID,
        orgId: String,
        givenName: String,
        familyName: String,
        phone: String,
        email: String = "",
        bestCallTime: String = "",
        vertical: String = "charity",
        notes: String = "",
        consentGiven: Bool = false
    ) {
        self.id = UUID()
        self.knockId = knockId
        self.orgId = orgId
        self.givenName = givenName
        self.familyName = familyName
        self.phone = phone
        self.email = email
        self.bestCallTime = bestCallTime
        self.vertical = vertical
        self.notes = notes
        self.consentGiven = consentGiven
        self.consentTimestamp = consentGiven ? Date() : nil
        self.syncStatusRaw = "pending"
        self.createdAt = Date()
    }

    var displayName: String { "\(givenName) \(familyName)".trimmingCharacters(in: .whitespaces) }
}
