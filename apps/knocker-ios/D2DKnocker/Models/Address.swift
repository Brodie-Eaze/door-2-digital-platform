// Address.swift — locally cached address for map annotation + DNC pre-check.
// hashKey is SHA-256 of the normalised address string for deduplication.

import Foundation
import SwiftData
import CoreLocation

@Model
final class Address {
    @Attribute(.unique) var id: UUID
    var formatted: String
    var unit: String
    var street: String
    var locality: String
    var region: String
    var postcode: String
    var countryCode: String
    var latitude: Double
    var longitude: Double
    var hashKey: String             // SHA-256 of normalised address
    var isOnDncList: Bool           // pre-fetched DNC status
    var lastKnockedAt: Date?
    var lastDispositionRaw: String?

    init(
        formatted: String,
        unit: String = "",
        street: String,
        locality: String,
        region: String,
        postcode: String,
        countryCode: String = "US",
        latitude: Double,
        longitude: Double,
        hashKey: String = ""
    ) {
        self.id = UUID()
        self.formatted = formatted
        self.unit = unit
        self.street = street
        self.locality = locality
        self.region = region
        self.postcode = postcode
        self.countryCode = countryCode
        self.latitude = latitude
        self.longitude = longitude
        self.hashKey = hashKey.isEmpty ? formatted.lowercased() : hashKey
        self.isOnDncList = false
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var lastDisposition: KnockDisposition? {
        guard let raw = lastDispositionRaw else { return nil }
        return KnockDisposition(rawValue: raw)
    }
}
