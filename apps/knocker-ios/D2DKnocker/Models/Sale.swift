// Sale.swift — a completed sign-up / sale captured at the door.
// Created when a knocker signs a customer up to a service. Queued for sync
// alongside the Knock + Lead.

import Foundation
import SwiftData

@Model
final class Sale {
    @Attribute(.unique) var id: UUID
    var knockId: UUID
    var leadId: UUID?
    var orgId: String

    // Customer
    var customerName: String
    var customerPhone: String
    var customerEmail: String
    var addressLine: String

    // Service signed up to
    var serviceId: String
    var serviceName: String
    var amountCents: Int
    var frequencyRaw: String        // "monthly" | "weekly" | "once"

    // Evidence
    var signatureLocalPath: String?
    var signedAt: Date

    var statusRaw: String           // "signed" | "pending_payment"
    var syncStatusRaw: String       // "pending" | "synced" | "failed"
    var createdAt: Date

    init(
        knockId: UUID,
        leadId: UUID? = nil,
        orgId: String,
        customerName: String,
        customerPhone: String,
        customerEmail: String = "",
        addressLine: String,
        serviceId: String,
        serviceName: String,
        amountCents: Int,
        frequencyRaw: String,
        signatureLocalPath: String? = nil
    ) {
        self.id = UUID()
        self.knockId = knockId
        self.leadId = leadId
        self.orgId = orgId
        self.customerName = customerName
        self.customerPhone = customerPhone
        self.customerEmail = customerEmail
        self.addressLine = addressLine
        self.serviceId = serviceId
        self.serviceName = serviceName
        self.amountCents = amountCents
        self.frequencyRaw = frequencyRaw
        self.signatureLocalPath = signatureLocalPath
        self.signedAt = Date()
        self.statusRaw = "signed"
        self.syncStatusRaw = "pending"
        self.createdAt = Date()
    }

    var frequency: ServiceFrequency { ServiceFrequency(rawValue: frequencyRaw) ?? .monthly }

    /// "$25/mo" style label.
    var amountLabel: String {
        let dollars = Double(amountCents) / 100.0
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "en_US")
        f.maximumFractionDigits = (amountCents % 100 == 0) ? 0 : 2
        let amt = f.string(from: NSNumber(value: dollars)) ?? "$0"
        return amt + frequency.suffix
    }
}
