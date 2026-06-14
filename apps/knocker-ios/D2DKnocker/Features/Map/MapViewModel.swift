// MapViewModel.swift — territory polygon, candidate homes to knock, knock pins.

import Foundation
import MapKit
import Observation
import SwiftData
import SwiftUI

@Observable
final class MapViewModel {
    var cameraPosition: MapCameraPosition = .automatic
    var knockAnnotations: [KnockAnnotation] = []
    var targetHomes: [TargetHome] = []
    var territory: TerritoryOverlay?
    /// Non-nil when the assigned area is a RADIUS (center + metres) instead of a
    /// polygon — drives a MapCircle render. Mutually exclusive with `territory`.
    var territoryCircle: TerritoryCircle?
    var territoryName: String = ""
    var assignedTerritoryId: String?
    var locationAccuracy: Double = 999
    var isLoadingTerritory: Bool = false
    var selectedAnnotation: KnockAnnotation?

    /// True once a fetch completed with zero assigned territories — drives the
    /// honest "No territory assigned yet" overlay instead of fake homes.
    var hasNoTerritory: Bool = false
    /// Non-nil when the territory fetch failed and there's no cached fallback.
    var territoryError: String?

    /// Homes knocked / homes total — drives the territory pill (e.g. "8 / 248").
    var knockedCount: Int { targetHomes.filter { $0.knockedDisposition != nil }.count }
    var totalCount: Int { max(targetHomes.count, knockedCount) }
    var conversionsCount: Int {
        knockAnnotations.filter { $0.disposition == .convertedSale || $0.disposition == .convertedDonation }.count
    }
    /// Counts by disposition for the map legend.
    var dispositionCounts: [KnockDisposition: Int] {
        Dictionary(knockAnnotations.map { ($0.disposition, 1) }, uniquingKeysWith: +)
    }

    private var apiClient: APIClient = APIClient()

    // MARK: - Load

    /// Fetch the rep's assigned territories from the platform and render the
    /// FIRST active one (polygon, else a region around the centroid). No fake
    /// homes — the live map shows the real territory + the rep's own knock pins.
    @MainActor
    func load(appState: AppState) async {
        apiClient.accessToken = appState.accessToken
        isLoadingTerritory = true
        territoryError = nil
        hasNoTerritory = false
        do {
            let assigned = try await apiClient.fetchAssignedTerritories()
            applyAssigned(assigned)
        } catch {
            // No live territory available. Fall back to a DEBUG-only demo
            // territory so the simulator map isn't blank during development;
            // in release we show the honest "no territory" overlay.
            #if DEBUG
            renderDemoFallback()
            #else
            territory = nil
            targetHomes = []
            hasNoTerritory = true
            territoryError = (error as? LocalizedError)?.errorDescription ?? "Couldn't load your territory"
            #endif
        }
        isLoadingTerritory = false
    }

    /// Pick the first active assigned territory and render it.
    @MainActor
    private func applyAssigned(_ assigned: [AssignedTerritoryDTO]) {
        // Prefer an explicitly active territory; otherwise the first returned.
        let chosen = assigned.first { $0.status == "active" } ?? assigned.first
        guard let t = chosen else {
            // Genuinely no assignment — honest empty state, no fake homes.
            territory = nil
            territoryCircle = nil
            targetHomes = []
            hasNoTerritory = true
            return
        }

        assignedTerritoryId = t.id
        territoryName = t.name
        hasNoTerritory = false

        let coords = t.polygon.flatMap { Self.parsePolygon($0) } ?? []
        let centroid = Self.parseCentroid(t.centroid)
            ?? Self.centroid(of: coords)
            ?? CLLocationCoordinate2D(latitude: Self.centerLat, longitude: Self.centerLon)

        // A manager can define the area as a RADIUS (center + metres) instead of a
        // polygon. When that's the case render a circle centred on the centroid and
        // frame the camera to the circle; otherwise keep the existing polygon path.
        if t.areaType == "radius", let metres = t.radiusMeters, metres > 0 {
            territory = nil
            territoryCircle = TerritoryCircle(
                id: t.id, name: t.name, center: centroid, radiusMeters: Double(metres)
            )
            targetHomes = []
            let region = MKCoordinateRegion(
                center: centroid,
                // Frame the full diameter with ~30% padding.
                latitudinalMeters: Double(metres) * 2.6,
                longitudinalMeters: Double(metres) * 2.6
            )
            cameraPosition = .region(region)
            return
        }

        territoryCircle = nil
        if coords.count >= 3 {
            territory = TerritoryOverlay(id: t.id, name: t.name, coordinates: coords, centroid: centroid)
        } else {
            // Unparseable / null polygon — keep the name + centroid, draw no
            // polygon (a pin/region at the centroid is shown instead).
            territory = nil
        }
        // No synthetic target homes on the live path.
        targetHomes = []

        let span = Self.span(for: coords)
        cameraPosition = .region(MKCoordinateRegion(center: centroid, span: span))
    }

    #if DEBUG
    /// DEBUG-only offline fallback so the simulator map renders during dev when
    /// the backend is unreachable. NOT shown in release builds.
    @MainActor
    private func renderDemoFallback() {
        let t = Self.demoTerritory
        territory = t
        territoryCircle = nil
        territoryName = t.name + " (demo)"
        targetHomes = []
        hasNoTerritory = false
        cameraPosition = .region(MKCoordinateRegion(
            center: t.centroid,
            span: MKCoordinateSpan(latitudeDelta: 0.0085, longitudeDelta: 0.0085)
        ))
    }
    #endif

    // MARK: - Polygon / centroid parsing

    /// Parse a territory polygon from either WKT (`POLYGON((lng lat, lng lat,…))`)
    /// or a GeoJSON-ish coordinate array (`[[lng,lat],[lng,lat],…]`). Returns map
    /// coordinates (lat/lng order) or nil if nothing usable is found.
    static func parsePolygon(_ raw: String) -> [CLLocationCoordinate2D]? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }
        if trimmed.uppercased().hasPrefix("POLYGON") {
            return parseWKTPolygon(trimmed)
        }
        // GeoJSON-ish fallback: a bracketed list of "lng lat" or "lng,lat" pairs.
        return parseGeoJSONish(trimmed)
    }

    /// WKT: POLYGON((lng lat, lng lat, …)) — optionally with inner rings; we take
    /// the first (outer) ring. Each vertex is "lng lat" (space-separated).
    private static func parseWKTPolygon(_ wkt: String) -> [CLLocationCoordinate2D]? {
        // Grab the content of the first "((  …  ))" group (outer ring).
        guard let open = wkt.range(of: "((") else { return nil }
        let afterOpen = wkt[open.upperBound...]
        // Ring ends at the first ")" — inner rings (if any) start after that.
        guard let close = afterOpen.firstIndex(of: ")") else { return nil }
        let ring = afterOpen[afterOpen.startIndex..<close]
        var coords: [CLLocationCoordinate2D] = []
        for pair in ring.split(separator: ",") {
            let nums = pair
                .trimmingCharacters(in: .whitespaces)
                .split(whereSeparator: { $0 == " " })
                .compactMap { Double($0) }
            if nums.count >= 2 {
                // WKT is lng-then-lat.
                coords.append(CLLocationCoordinate2D(latitude: nums[1], longitude: nums[0]))
            }
        }
        return coords.count >= 3 ? coords : nil
    }

    /// GeoJSON-ish: strip brackets, read comma/space separated "lng lat" pairs.
    /// Handles `[[lng,lat],[lng,lat]]` and `lng lat, lng lat` shapes loosely.
    private static func parseGeoJSONish(_ raw: String) -> [CLLocationCoordinate2D]? {
        let cleaned = raw.replacingOccurrences(of: "[", with: "")
                         .replacingOccurrences(of: "]", with: "")
        // Split into number tokens, regardless of comma/space delimiting.
        let tokens = cleaned
            .split(whereSeparator: { $0 == "," || $0 == " " || $0 == "\n" })
            .compactMap { Double($0) }
        guard tokens.count >= 6 else { return nil }   // ≥3 lng/lat pairs
        var coords: [CLLocationCoordinate2D] = []
        var i = 0
        while i + 1 < tokens.count {
            // GeoJSON order is lng, lat.
            coords.append(CLLocationCoordinate2D(latitude: tokens[i + 1], longitude: tokens[i]))
            i += 2
        }
        return coords.count >= 3 ? coords : nil
    }

    /// Parse a centroid string. The server emits "lng lat" (space-separated);
    /// also tolerate "lat,lng" (comma-separated) defensively.
    static func parseCentroid(_ raw: String?) -> CLLocationCoordinate2D? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        if raw.contains(",") {
            // "lat,lng"
            let parts = raw.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
            if parts.count == 2 { return CLLocationCoordinate2D(latitude: parts[0], longitude: parts[1]) }
        }
        // "lng lat" (server format)
        let parts = raw.split(whereSeparator: { $0 == " " }).compactMap { Double($0) }
        if parts.count == 2 { return CLLocationCoordinate2D(latitude: parts[1], longitude: parts[0]) }
        return nil
    }

    /// Geometric centroid (average) of a coordinate ring, for camera centring.
    private static func centroid(of coords: [CLLocationCoordinate2D]) -> CLLocationCoordinate2D? {
        guard !coords.isEmpty else { return nil }
        let lat = coords.map(\.latitude).reduce(0, +) / Double(coords.count)
        let lng = coords.map(\.longitude).reduce(0, +) / Double(coords.count)
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    /// A span that frames the polygon with a little padding; sensible default
    /// when there's only a centroid.
    private static func span(for coords: [CLLocationCoordinate2D]) -> MKCoordinateSpan {
        guard coords.count >= 2 else {
            return MKCoordinateSpan(latitudeDelta: 0.0085, longitudeDelta: 0.0085)
        }
        let lats = coords.map(\.latitude), lngs = coords.map(\.longitude)
        let latDelta = max((lats.max()! - lats.min()!) * 1.4, 0.003)
        let lngDelta = max((lngs.max()! - lngs.min()!) * 1.4, 0.003)
        return MKCoordinateSpan(latitudeDelta: latDelta, longitudeDelta: lngDelta)
    }

    func refreshKnocks(context: ModelContext) {
        let descriptor = FetchDescriptor<Knock>(
            sortBy: [SortDescriptor(\.capturedAt, order: .reverse)]
        )
        guard let knocks = try? context.fetch(descriptor) else { return }
        knockAnnotations = knocks.map { knock in
            KnockAnnotation(
                id: knock.id.uuidString,
                coordinate: CLLocationCoordinate2D(latitude: knock.latitude, longitude: knock.longitude),
                disposition: knock.disposition,
                address: knock.addressLine,
                capturedAt: knock.capturedAt
            )
        }
        reconcileHomes(with: knocks)
    }

    /// Mark a candidate home as knocked when a logged knock lands within ~30m.
    private func reconcileHomes(with knocks: [Knock]) {
        for i in targetHomes.indices {
            let home = CLLocation(latitude: targetHomes[i].coordinate.latitude,
                                  longitude: targetHomes[i].coordinate.longitude)
            if let nearest = knocks.min(by: { a, b in
                home.distance(from: CLLocation(latitude: a.latitude, longitude: a.longitude)) <
                home.distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
            }), home.distance(from: CLLocation(latitude: nearest.latitude, longitude: nearest.longitude)) < 30 {
                targetHomes[i].knockedDisposition = nearest.disposition
            }
        }
    }

    // MARK: - Map fallback centre (used only as a last-resort camera centre)

    static let centerLat = 30.28280
    static let centerLon = -97.71550

    #if DEBUG
    // MARK: - DEBUG-only demo neighbourhood (Cherrywood, East Austin)
    // NOT a live data source — only used by renderDemoFallback() when the
    // backend is unreachable during simulator development.

    static var demoTerritory: TerritoryOverlay {
        // Irregular neighbourhood outline (~600m across) around the center.
        let pts: [(Double, Double)] = [
            (30.28620, -97.71920), (30.28640, -97.71300), (30.28420, -97.71140),
            (30.28080, -97.71180), (30.27940, -97.71460), (30.27980, -97.71880),
            (30.28220, -97.72020),
        ]
        let coords = pts.map { CLLocationCoordinate2D(latitude: $0.0, longitude: $0.1) }
        return TerritoryOverlay(
            id: "terr_cherrywood",
            name: "Cherrywood East",
            coordinates: coords,
            centroid: CLLocationCoordinate2D(latitude: centerLat, longitude: centerLon)
        )
    }
    #endif
}

// MARK: - TargetHome

struct TargetHome: Identifiable {
    let id: String
    let coordinate: CLLocationCoordinate2D
    let address: String
    var knockedDisposition: KnockDisposition?

    var houseNumber: String { address.split(separator: " ").first.map(String.init) ?? "•" }
}

// MARK: - Disposition breakdown helper

extension Array where Element == KnockAnnotation {
    func count(_ disposition: KnockDisposition) -> Int {
        filter { $0.disposition == disposition }.count
    }
}

// MARK: - KnockAnnotation

struct KnockAnnotation: Identifiable {
    let id: String
    let coordinate: CLLocationCoordinate2D
    let disposition: KnockDisposition
    let address: String
    let capturedAt: Date
}

// MARK: - TerritoryOverlay

struct TerritoryOverlay {
    let id: String
    let name: String
    let coordinates: [CLLocationCoordinate2D]
    let centroid: CLLocationCoordinate2D
}

// MARK: - TerritoryCircle (radius-area territory)

/// A radius-defined canvass area: a centre + radius in metres, rendered as a
/// MapCircle. Used when the platform sets the territory's `areaType == "radius"`.
struct TerritoryCircle {
    let id: String
    let name: String
    let center: CLLocationCoordinate2D
    let radiusMeters: Double
}
