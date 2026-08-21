// DTOs.swift — request/response models for the /v1 API.
// Named to match the server's Zod schemas (camelCase, same field names).

import Foundation

// MARK: - Auth

struct LoginRequest: Encodable {
    let email: String
    let password: String
    let deviceId: String
}

struct LoginResponse: Decodable {
    let accessToken: String
    let refreshToken: String?       // server issues it; capture it for silent refresh
    let accessTokenExpiresIn: Int?
    let user: UserProfileDTO
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct UserProfileDTO: Decodable {
    let id: String
    let email: String
    let givenName: String
    let familyName: String
    let role: String
    let orgId: String

    func toUserProfile() -> UserProfile {
        UserProfile(
            id: id,
            email: email,
            givenName: givenName,
            familyName: familyName,
            role: role,
            orgId: orgId
        )
    }
}

// MARK: - Session

// Matches the server `startSessionRequestSchema` (.strict): territoryId +
// deviceId + startGeo{lat,lng}. org/user come from the JWT server-side. Nil
// appVersion/osVersion are omitted by the encoder, so the strict schema passes.
struct StartSessionRequest: Encodable {
    let territoryId: String
    let deviceId: String
    let startGeo: GeoPoint
    var appVersion: String?
    var osVersion: String?
}

// Server responds `{ session: { id, ... } }` (SessionPublic), not a bare id.
struct StartSessionResponse: Decodable {
    let session: SessionInfo
    struct SessionInfo: Decodable { let id: String }
}

// MARK: - Knock

/// Mirrors the server's `geoPointSchema` / `rawAddressSchema` — the knock batch
/// endpoint validates against these exact nested shapes (`.strict()`).
struct GeoPoint: Codable {
    let lat: Double
    let lng: Double
    var accuracyM: Double? = nil
}

struct RawAddress: Codable {
    let formatted: String
    let street: String
    let locality: String
    let region: String
    let postcode: String
    let countryCode: String
}

struct KnockPayload: Codable {
    let sessionId: String
    let territoryId: String?
    let disposition: String
    let geo: GeoPoint
    let rawAddress: RawAddress
    let capturedAt: String      // ISO8601
    let idempotencyKey: String
    let notes: String?
    let signatureKey: String?
    let photoKey: String?
    // NOTE: org + user are derived server-side from the bearer token; latitude/
    // longitude/addressLine/clientOffsetMs are NOT part of the wire contract
    // (the server schema is strict and rejects unknown keys).
}

// MARK: - Sale (sign-up)

struct CreateSaleRequest: Codable {
    let knockId: String
    let leadId: String?          // ignored server-side (lead created server-side); kept for the local queue record
    let orgId: String            // ignored server-side (org comes from the JWT); kept for the local queue record
    let customerName: String
    let customerPhone: String
    let customerEmail: String
    let addressLine: String
    let serviceId: String
    let serviceName: String
    let amountCents: Int
    let frequency: String        // must be exactly "monthly" | "weekly" | "once"
    let signedAt: String         // ISO8601
    let signatureKey: String?    // local signature file path / object key — stored on consent + conversion
    let idempotencyKey: String   // sent as the Idempotency-Key HEADER; stripped from the body by the server
}

struct CreateSaleResponse: Decodable {
    let id: String               // the conversion id (cnv_…)
    let leadId: String?          // the server-created lead id (lead_…)
}

struct KnockBatchRequest: Encodable {
    let knocks: [KnockPayload]
}

/// Mirrors the server batch result: `{ inserted, deduped, errors, knocks }`.
/// `knocks` carries every successfully-handled knock (inserted OR deduped) with
/// its `idempotencyKey`, so the drain marks those queue items complete; anything
/// in `errors` is left pending to retry.
struct KnockBatchResponse: Decodable {
    let inserted: Int
    let deduped: Int
    let errors: [BatchError]
    let knocks: [ProcessedKnock]
    struct ProcessedKnock: Decodable {
        let id: String
        let idempotencyKey: String
    }
    struct BatchError: Decodable {
        let index: Int
        let idempotencyKey: String?
        let message: String
    }
}

// MARK: - Lead

struct CreateLeadRequest: Codable {
    let knockId: String
    let orgId: String
    let givenName: String
    let familyName: String
    let phone: String
    let email: String
    let bestCallTime: String
    let vertical: String
    let notes: String
    let consentGiven: Bool
    let idempotencyKey: String
}

struct CreateLeadResponse: Decodable {
    let id: String
}

// MARK: - Territory

struct TerritoryDTO: Decodable, Identifiable {
    let id: String
    let name: String
    let polygon: PolygonDTO
    let centroidLat: Double
    let centroidLng: Double
    let campaignId: String?

    struct PolygonDTO: Decodable {
        let coordinates: [[Double]]  // [[lng, lat], ...]
    }
}

// MARK: - Assigned territory (GET /territories/assigned)
// The platform returns the rep's assigned, active territories. `polygon` and
// `centroid` arrive as raw strings (WKT polygon / "lng lat" centroid) and are
// parsed client-side in MapViewModel — keep them as strings here.

struct AssignedTerritoryDTO: Decodable, Identifiable {
    let id: String
    let name: String
    let vertical: String          // "charity" | "commercial"
    let polygon: String?          // WKT "POLYGON((lng lat, …))" (or GeoJSON-ish), nil if undrawn
    let centroid: String?         // "lng lat" (server) or "lat,lng" — parsed defensively
    let campaignId: String?
    let status: String            // "active" | …
    let areaType: String?         // "polygon" | "radius" — radius draws a MapCircle at the centroid
    let radiusMeters: Int?        // metres; present when areaType == "radius"
}

// MARK: - Photo upload (POST /photos)
// Each property photo taken at a knock is uploaded + held on the platform.
// `clientKnockId` ties the held photo back to the local knock (the server has
// no server-side knock id at capture time — knocks sync via the batch path).
// `imageBase64` is the JPEG bytes base64-encoded; the SyncEngine reads the
// local file + encodes at drain time so the queue row stays small. The
// Idempotency-Key header (the photo op id) dedups retries.

struct CreatePhotoRequest: Encodable {
    let clientKnockId: String
    let capturedAt: String        // ISO8601
    let latitude: Double?
    let longitude: Double?
    let addressLine: String?
    let contentType: String       // e.g. "image/jpeg"
    let imageBase64: String
}

struct CreatePhotoResponse: Decodable {
    let id: String
    let storageKey: String
}

// Small queue row for a `.createPhoto` PendingSync op. Stores the LOCAL file
// PATH (not the bytes) so the SwiftData row stays tiny; the SyncEngine reads +
// base64-encodes the JPEG at drain time. If the file is gone at drain time the
// op is dead-lettered gracefully (the bytes are unrecoverable).

struct PhotoSyncPayload: Codable {
    let clientKnockId: String
    let localPath: String
    let capturedAt: String        // ISO8601
    let latitude: Double?
    let longitude: Double?
    let addressLine: String?
    let contentType: String       // "image/jpeg"
}

// MARK: - Service catalog (GET /catalog)
// Per-tenant ServiceOffering list. `amountCents` maps to the app's priceCents;
// `frequency` is parsed into ServiceFrequency by ServiceCatalog.

struct CatalogOfferingDTO: Decodable, Identifiable {
    let id: String
    let name: String
    let blurb: String?            // tolerate a missing/empty blurb
    let amountCents: Int
    let frequency: String         // "monthly" | "weekly" | "once"
    let vertical: String          // "charity" | "commercial"
    let highlighted: Bool?
    let sortOrder: Int?

    func toOffering() -> ServiceOffering {
        ServiceOffering(
            id: id,
            name: name,
            blurb: blurb ?? "",
            priceCents: amountCents,
            frequency: ServiceFrequency(rawValue: frequency) ?? .monthly,
            vertical: vertical,
            highlighted: highlighted ?? false
        )
    }
}

// MARK: - Roster (GET /roster/shifts/mine)

struct ShiftDTO: Decodable, Identifiable {
    let id: String
    let weekStart: String          // "YYYY-MM-DD"
    let day: Int                   // 0 = Mon … 6 = Sun
    let date: String               // "YYYY-MM-DD"
    let start: String              // "HH:MM"
    let end: String                // "HH:MM"
    let lunch: String?             // "HH:MM-HH:MM" or null
    let territory: String          // territory name
    let territoryId: String?
    let account: String
    let status: String             // "scheduled" | "active" | "lunch" | "missed" | "completed"
}

struct ClockInRequest: Encodable {
    let deviceId: String
    let latitude: Double?
    let longitude: Double?
    let appVersion: String?
    let osVersion: String?
    let attestationToken: String?
}

struct ClockInResponse: Decodable {
    let shiftId: String
    let sessionId: String
}

struct ClockOutResponse: Decodable {
    let shiftId: String
    let sessionId: String?
}

// MARK: - Daily stats

struct DailyStatsResponse: Decodable {
    let knocksToday: Int
    let conversionsToday: Int
    let commissionCentsToday: Int
    // Optional richer fields (populate the Me screen once the backend stats
    // endpoint returns them; nil → rendered as 0 / hidden, never faked).
    let revenueCentsToday: Int?
    let knocksYesterday: Int?
    let leaderboardRank: Int?
    let leaderboard: [LeaderboardEntryDTO]?
}

struct LeaderboardEntryDTO: Decodable, Identifiable {
    let userId: String
    let name: String
    let knocks: Int
    let conversions: Int
    let isYou: Bool
    var id: String { userId }
}

// MARK: - Inbox messages

struct InboxMessageDTO: Decodable, Identifiable {
    let id: String
    let fromName: String
    let subject: String
    let body: String
    let sentAt: String  // ISO8601
    let readAt: String?
    let priority: String  // "normal" | "high" | "urgent"
}

// MARK: - Address intel (Snowflake enrichment)
// GET /v1/addresses/:id/intel — returned inside { "intel": {...} }

struct AddressIntelResponse: Decodable {
    let intel: AddressIntelDTO
}

struct AddressIntelDTO: Decodable {
    let score: Double
    let prizmName: String?
    let prizmCode: String?
    let medianHhIncomeUsd: Double?
    let charitablePropensity: Double?
    let estimatedHomeValueUsd: Double?
    let ownerOccupancyRate: Double?
    let modelName: String?
    let computedAt: String?
}

// MARK: - Territory satellite intel (Planet Labs)
// GET /v1/territories/:id/satellite — returned inside { "intel": {...} }

struct TerritoryIntelResponse: Decodable {
    let intel: TerritoryIntelDTO
}

struct TerritoryIntelDTO: Decodable {
    let territoryId: String
    let constructionCount: Int
    let demolitionCount: Int
    let totalChanges: Int
    let lastCapture: String?
    let score: Double
    let basemapTileUrl: String?
}

// MARK: - Territory claims (area claiming — rep signals they're working a block)

struct TerritoryClaimDTO: Codable, Identifiable {
    let id: String
    let territoryId: String
    let userId: String
    let userName: String
    let claimedAt: String
    let expiresAt: String
}

struct TerritoryClaimsResponse: Codable {
    let data: [TerritoryClaimDTO]
}

// MARK: - Callbacks / schedule

struct CallbackDTO: Decodable, Identifiable {
    let id: String
    let leadId: String
    let leadName: String
    let addressLine: String
    let scheduledFor: String  // ISO8601
    let phone: String
    let notes: String?
    let isOverdue: Bool
}
