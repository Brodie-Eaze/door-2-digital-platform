// KnockFlowViewModel.swift — drives the ≤4-tap knock capture flow.
// State machine: disposition → (lead form?) → (signature?) → .saving → .done
// .saving is ALWAYS the save trigger; KnockSheetView's task(id: step) fires
// saveKnock(context:appState:syncEngine:) with the real SwiftData context.

import Foundation
import CoreLocation
import Observation
import SwiftData
import UIKit

enum KnockFlowStep: Equatable {
    case disposition
    case leadForm
    case signature
    case saving
    case done
    case error
}

@Observable
final class KnockFlowViewModel {
    // MARK: - Inputs
    var coordinate: CLLocationCoordinate2D
    var addressLine: String = ""
    // Structured address components from reverse-geocoding. The server's knock
    // schema (`knockBatchRequestSchema`, .strict) wants a structured `rawAddress`
    // — a flat line alone 400s. Captured in KnockSheetView.reverseGeocode from
    // the CLPlacemark; fall back to sensible values in a dead zone so a GPS-only
    // knock still syncs rather than being rejected.
    var addrStreet: String = ""
    var addrLocality: String = ""
    var addrRegion: String = ""
    var addrPostcode: String = ""
    var addrCountry: String = ""

    // MARK: - Step state
    var step: KnockFlowStep = .disposition
    var selectedDisposition: KnockDisposition?
    var selectedService: ServiceOffering?
    var notes: String = ""

    /// True when this knock is a sign-up/sale (needs a service + records a Sale).
    var isSale: Bool { selectedDisposition == .convertedSale || selectedDisposition == .convertedDonation }
    var savedKnock: Knock?
    var savedSale: Sale?
    var errorMessage: String?
    var isSaving: Bool = false

    // Lead form
    var givenName: String = ""
    var familyName: String = ""
    var phone: String = ""
    var email: String = ""
    var consentGiven: Bool = false

    // Signature
    var signatureLines: [[CGPoint]] = []
    var hasSignature: Bool { !signatureLines.isEmpty }

    // Photo
    var photoData: Data?
    var hasPhoto: Bool { photoData != nil }

    init(coordinate: CLLocationCoordinate2D) {
        self.coordinate = coordinate
    }

    // MARK: - Step transitions (never call save directly; always go through .saving)

    /// Single-screen sheet: selecting a disposition records it. A TERMINAL
    /// disposition (not-home / refused / DNC / bad address — nothing to capture)
    /// auto-commits on tap so the 80%-of-the-day case is a single tap → "record a
    /// door in seconds". Lead/sale dispositions wait for the rep to fill the form.
    func selectDisposition(_ disposition: KnockDisposition) {
        selectedDisposition = disposition
        if isTerminalDisposition { commit() }
    }

    /// Whether the chosen disposition is one where name/phone capture matters.
    var capturesLead: Bool { selectedDisposition?.requiresLeadForm ?? false }

    /// A disposition with nothing to capture — saves immediately on tap.
    var isTerminalDisposition: Bool {
        guard let d = selectedDisposition else { return false }
        return !d.requiresLeadForm && d != .convertedSale && d != .convertedDonation
    }

    /// Commit the knock — triggers `.saving`, which fires `saveKnock`.
    func commit() {
        guard selectedDisposition != nil else { return }
        step = .saving
    }

    /// Retry after a save failure. The previous attempt rolled back atomically
    /// (context.save throws all-or-nothing), so this re-runs cleanly — no dupes.
    func retry() {
        errorMessage = nil
        step = .saving
    }

    func proceedFromLeadForm() {
        guard let disposition = selectedDisposition else { return }
        step = disposition.requiresSignature ? .signature : .saving
    }

    func proceedFromSignature() {
        step = .saving
    }

    func clearSignature() { signatureLines = [] }

    // MARK: - Save — called by KnockSheetView.task(id: step) with live ModelContext

    @MainActor
    func saveKnock(context: ModelContext, appState: AppState, syncEngine: SyncEngine) async {
        guard let disposition = selectedDisposition, !isSaving else { return }
        isSaving = true
        defer { isSaving = false }

        // Ensure a REAL server session before recording the knock. A knock whose
        // sessionId is a client-only UUID is rejected server-side ("KnockSession
        // not found"), so it 201s into `errors[]` and never persists. Server
        // session ids are prefixed `sess_`; if we don't have one yet and we're
        // online with an assigned territory, start one now and reuse it for the
        // rest of the shift. Offline: fall back to a local UUID (the knock still
        // queues; it needs the session-reconcile path — tracked separately).
        if appState.sessionId?.hasPrefix("sess_") != true,
           let territoryId = appState.assignedTerritoryId,
           appState.isOnline {
            let client = APIClient(accessToken: appState.accessToken)
            let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
            if let resp = try? await client.startSession(StartSessionRequest(
                territoryId: territoryId,
                deviceId: deviceId,
                startGeo: GeoPoint(lat: coordinate.latitude, lng: coordinate.longitude)
            )) {
                appState.sessionId = resp.session.id
            }
        }

        let sessionId = appState.sessionId ?? UUID().uuidString
        let userId    = appState.currentUser?.id ?? "unknown"
        let orgId     = appState.orgId.isEmpty ? (appState.currentUser?.orgId ?? "unknown") : appState.orgId

        let knock = Knock(
            sessionId:   sessionId,
            orgId:       orgId,
            userId:      userId,
            addressLine: addressLine.isEmpty ? "Unknown address" : addressLine,
            latitude:    coordinate.latitude,
            longitude:   coordinate.longitude,
            disposition: disposition,
            capturedAt:  Date()
        )
        if !notes.isEmpty { knock.notes = notes }
        // Persist captured photo + signature to the documents dir; the sync engine
        // uploads them later from the *LocalPath fields. The signature is the
        // proof-of-consent artifact for a paid sign-up — it must not be dropped.
        var photoPath: String?
        if let photoData {
            if let path = writeFile(photoData, name: "knock-\(knock.id.uuidString).jpg") {
                knock.photoLocalPath = path
                photoPath = path
            }
        }
        var signaturePath: String?
        if hasSignature, let sigData = renderSignaturePNG() {
            signaturePath = writeFile(sigData, name: "sig-\(knock.id.uuidString).png")
            knock.signatureLocalPath = signaturePath
        }
        context.insert(knock)

        // Save lead and link via leadId + QUEUE it for sync
        var createdLeadId: UUID?
        if disposition.requiresLeadForm, !givenName.isEmpty || !phone.isEmpty {
            // A signed sale IS written consent; a non-sale contactable lead carries
            // the explicit consent toggle. Never store a contactable lead as
            // consentGiven=false silently (TCPA/contactability record).
            let effectiveConsent = isSale ? (consentGiven || hasSignature) : consentGiven
            let lead = Lead(
                knockId:      knock.id,
                orgId:        orgId,
                givenName:    givenName,
                familyName:   familyName,
                phone:        phone,
                email:        email,
                consentGiven: effectiveConsent
            )
            lead.signatureLocalPath = signaturePath
            context.insert(lead)
            knock.leadId = lead.id
            createdLeadId = lead.id
            context.insert(PendingSync(operationType: .createLead, entityId: lead.id,
                                       payloadJSON: leadPayload(lead, idempotencyKey: knock.idempotencyKey),
                                       idempotencyKey: "lead-" + knock.idempotencyKey))
        }

        // Record the SALE + QUEUE it for sync — this is the revenue event.
        if isSale, let service = selectedService {
            let fullName = [givenName, familyName].filter { !$0.isEmpty }.joined(separator: " ")
            let sale = Sale(
                knockId:       knock.id,
                leadId:        createdLeadId,
                orgId:         orgId,
                customerName:  fullName.isEmpty ? "Customer" : fullName,
                customerPhone: phone,
                customerEmail: email,
                addressLine:   knock.addressLine,
                serviceId:     service.id,
                serviceName:   service.name,
                amountCents:   service.priceCents,
                frequencyRaw:  service.frequency.rawValue,
                signatureLocalPath: signaturePath
            )
            context.insert(sale)
            context.insert(PendingSync(operationType: .createSale, entityId: sale.id,
                                       payloadJSON: salePayload(sale, idempotencyKey: knock.idempotencyKey),
                                       idempotencyKey: "sale-" + knock.idempotencyKey))
            savedSale = sale
        }

        // Queue the knock create
        context.insert(PendingSync(operationType: .createKnock, entityId: knock.id,
                                   payloadJSON: buildPayload(knock: knock),
                                   idempotencyKey: knock.idempotencyKey))

        // Queue the property PHOTO upload (held on the platform). The op carries
        // the LOCAL file path + knock geo/address; SyncEngine reads + base64s the
        // bytes at drain time, so a dead-zone photo catches up later WITHOUT ever
        // blocking this knock save. Idempotency key dedups a re-drained photo.
        if let photoPath {
            context.insert(PendingSync(operationType: .createPhoto, entityId: knock.id,
                                       payloadJSON: photoPayload(localPath: photoPath, knock: knock),
                                       idempotencyKey: "photo-" + knock.idempotencyKey))
        }

        do {
            try context.save()
        } catch {
            // SwiftData keeps failed inserts PENDING in the context — a retry would
            // re-insert and duplicate the Knock+Lead+Sale. Roll back so retry is clean.
            context.rollback()
            savedSale = nil
            savedKnock = nil
            self.errorMessage = "Couldn't save — nothing was charged. Tap retry."
            self.step = .error
            return
        }

        // Trigger sync now (the app-owned engine retries on foreground/reconnect)
        syncEngine.triggerSync(context: context)

        // Update stats — knocks, conversions, and the rep's accrued commission.
        appState.knocksToday += 1
        if disposition == .convertedSale || disposition == .convertedDonation {
            appState.conversionsToday += 1
            // NOTE: do NOT bump commissionCentsToday by the sale price here — the
            // rep's commission is a fraction of the price computed by the
            // server-side commission plan, not the gross amount. The real figure
            // is pulled from daily-stats (see ProfileViewModel.load).
        }

        NotificationCenter.default.post(name: .knockRecorded, object: nil)
        savedKnock = knock
        step = .done
    }

    // MARK: - File + payload helpers

    private func writeFile(_ data: Data, name: String) -> String? {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let url = dir.appendingPathComponent(name)
        guard (try? data.write(to: url, options: [.atomic, .completeFileProtection])) != nil else { return nil }
        return url.path
    }

    /// Render the captured signature strokes to a PNG so it can be persisted + uploaded.
    private func renderSignaturePNG() -> Data? {
        guard !signatureLines.isEmpty else { return nil }
        let all = signatureLines.flatMap { $0 }
        guard !all.isEmpty else { return nil }
        let minX = all.map(\.x).min() ?? 0, maxX = all.map(\.x).max() ?? 1
        let minY = all.map(\.y).min() ?? 0, maxY = all.map(\.y).max() ?? 1
        let pad: CGFloat = 12
        let size = CGSize(width: max(maxX - minX, 1) + pad * 2, height: max(maxY - minY, 1) + pad * 2)
        let renderer = UIGraphicsImageRenderer(size: size)
        let img = renderer.image { ctx in
            UIColor.white.setFill(); ctx.fill(CGRect(origin: .zero, size: size))
            UIColor.black.setStroke()
            let path = UIBezierPath(); path.lineWidth = 2; path.lineJoinStyle = .round; path.lineCapStyle = .round
            for line in signatureLines {
                guard let first = line.first else { continue }
                let p = UIBezierPath()
                p.move(to: CGPoint(x: first.x - minX + pad, y: first.y - minY + pad))
                for pt in line.dropFirst() { p.addLine(to: CGPoint(x: pt.x - minX + pad, y: pt.y - minY + pad)) }
                p.lineWidth = 2; p.lineJoinStyle = .round; p.lineCapStyle = .round
                UIColor.black.setStroke(); p.stroke()
            }
        }
        return img.pngData()
    }

    private func buildPayload(knock: Knock) -> String {
        // Match the server contract exactly: `geo:{lat,lng}` + structured
        // `rawAddress`, and NO extra keys — the batch schema is `.strict()`, so
        // orgId/userId/latitude/longitude/addressLine/clientOffsetMs (which the
        // server takes from the JWT or doesn't accept) are dropped. org + user
        // come from the bearer token server-side.
        let formatted = knock.addressLine.isEmpty ? "Unknown address" : knock.addressLine
        // Dead-zone fallbacks so each required min-1 field is non-empty and a
        // GPS-only knock still syncs; the true formatted line is preserved above.
        var dict: [String: Any] = [
            "idempotencyKey": knock.idempotencyKey,
            "sessionId":      knock.sessionId,
            "disposition":    knock.dispositionRaw,
            "geo":            ["lat": knock.latitude, "lng": knock.longitude],
            "rawAddress": [
                "formatted":   formatted,
                "street":      addrStreet.isEmpty ? formatted : addrStreet,
                "locality":    addrLocality.isEmpty ? "Unknown" : addrLocality,
                "region":      addrRegion.isEmpty ? "Unknown" : addrRegion,
                "postcode":    addrPostcode.isEmpty ? "00000" : addrPostcode,
                "countryCode": addrCountry.count == 2 ? addrCountry : "US",
            ],
            "capturedAt":     ISO8601DateFormatter().string(from: knock.capturedAt),
        ]
        if let t = knock.territoryId { dict["territoryId"] = t }
        if let n = knock.notes, !n.isEmpty { dict["notes"] = n }
        if let s = knock.signatureLocalPath { dict["signatureKey"] = (s as NSString).lastPathComponent }
        if let p = knock.photoLocalPath { dict["photoKey"] = (p as NSString).lastPathComponent }
        return jsonString(dict)
    }

    private func leadPayload(_ lead: Lead, idempotencyKey: String) -> String {
        jsonString([
            "knockId": lead.knockId.uuidString, "orgId": lead.orgId,
            "givenName": lead.givenName, "familyName": lead.familyName,
            "phone": lead.phone, "email": lead.email, "bestCallTime": lead.bestCallTime,
            "vertical": lead.vertical, "notes": lead.notes, "consentGiven": lead.consentGiven,
            "idempotencyKey": "lead-" + idempotencyKey,
        ])
    }

    private func salePayload(_ sale: Sale, idempotencyKey: String) -> String {
        var d: [String: Any] = [
            "knockId": sale.knockId.uuidString, "orgId": sale.orgId,
            "customerName": sale.customerName, "customerPhone": sale.customerPhone,
            "customerEmail": sale.customerEmail, "addressLine": sale.addressLine,
            "serviceId": sale.serviceId, "serviceName": sale.serviceName,
            "amountCents": sale.amountCents, "frequency": sale.frequencyRaw,
            "signedAt": ISO8601DateFormatter().string(from: sale.signedAt),
            "idempotencyKey": "sale-" + idempotencyKey,
        ]
        if let lid = sale.leadId { d["leadId"] = lid.uuidString }
        if let s = sale.signatureLocalPath { d["signatureKey"] = (s as NSString).lastPathComponent }
        return jsonString(d)
    }

    /// Small queue payload for a `.createPhoto` op: the local JPEG path + the
    /// knock's geo/address. SyncEngine reads + base64-encodes the file at drain
    /// time so the SwiftData row stays tiny. `clientKnockId` ties the held photo
    /// back to this local knock (knocks sync via the batch path, so there's no
    /// server knock id at capture time).
    private func photoPayload(localPath: String, knock: Knock) -> String {
        var d: [String: Any] = [
            "clientKnockId": knock.id.uuidString,
            "localPath":     localPath,
            "capturedAt":    ISO8601DateFormatter().string(from: knock.capturedAt),
            "latitude":      knock.latitude,
            "longitude":     knock.longitude,
            "contentType":   "image/jpeg",
        ]
        if !knock.addressLine.isEmpty { d["addressLine"] = knock.addressLine }
        return jsonString(d)
    }

    private func jsonString(_ dict: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let str = String(data: data, encoding: .utf8) else { return "{}" }
        return str
    }
}
