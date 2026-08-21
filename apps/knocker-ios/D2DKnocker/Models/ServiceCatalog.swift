// ServiceCatalog.swift — the services/plans a knocker can sign a customer up to.
// In production this is the ORG's own catalog, fetched from the platform via
// GET /v1/catalog (per-tenant ServiceOfferings). The last successful fetch is
// cached to UserDefaults as JSON so the picker keeps working offline. There is
// NO hardcoded demo catalog on the live path — if nothing is cached and the
// fetch fails, the picker shows an honest empty state.

import Foundation
import Observation

enum ServiceFrequency: String, CaseIterable {
    case monthly, weekly, once

    var label: String {
        switch self {
        case .monthly: return "Monthly"
        case .weekly:  return "Weekly"
        case .once:    return "One-off"
        }
    }
    var suffix: String {
        switch self {
        case .monthly: return "/mo"
        case .weekly:  return "/wk"
        case .once:    return ""
        }
    }
}

struct ServiceOffering: Identifiable, Hashable, Codable {
    let id: String
    let name: String
    let blurb: String
    let priceCents: Int
    let frequencyRaw: String
    let vertical: String     // "charity" | "commercial"
    let highlighted: Bool    // suggested / most popular

    init(id: String, name: String, blurb: String, priceCents: Int,
         frequency: ServiceFrequency, vertical: String, highlighted: Bool) {
        self.id = id
        self.name = name
        self.blurb = blurb
        self.priceCents = priceCents
        self.frequencyRaw = frequency.rawValue
        self.vertical = vertical
        self.highlighted = highlighted
    }

    var frequency: ServiceFrequency { ServiceFrequency(rawValue: frequencyRaw) ?? .monthly }

    var priceLabel: String {
        let dollars = Double(priceCents) / 100.0
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.locale = Locale(identifier: "en_US")
        f.maximumFractionDigits = (priceCents % 100 == 0) ? 0 : 2
        return (f.string(from: NSNumber(value: dollars)) ?? "$0") + frequency.suffix
    }
}

// MARK: - Loader (platform-driven, cached)

/// Loads + caches the org's catalog from the platform. Shared instance so the
/// knock-flow picker and the pipeline picker resolve against the same fetched
/// set, and `ServiceCatalog.byId` can resolve sale records back to an offering.
@Observable
@MainActor
final class CatalogStore {
    static let shared = CatalogStore()

    enum LoadState: Equatable {
        case idle, loading, loaded, failed(String)
    }

    private(set) var offerings: [ServiceOffering] = []
    private(set) var state: LoadState = .idle

    private let cacheKey = "d2d.catalog.cache.v1"
    private let api = APIClient()

    private init() {
        offerings = Self.readCache(key: cacheKey)
        ServiceCatalog.register(offerings)
    }

    /// Fetch from the platform and refresh the cache. On failure, keep whatever
    /// was already cached (offline-tolerant) and record the error so the UI can
    /// distinguish "loading", "empty", and "error".
    func load(appState: AppState, force: Bool = false) async {
        if state == .loading { return }
        if !force, !offerings.isEmpty, state == .loaded { return }
        api.accessToken = appState.accessToken
        state = .loading
        do {
            let fetched = try await api.fetchCatalog()
            offerings = fetched
            ServiceCatalog.register(fetched)
            Self.writeCache(fetched, key: cacheKey)
            state = .loaded
        } catch {
            // Keep cached offerings (if any); surface the error otherwise.
            if offerings.isEmpty {
                state = .failed((error as? LocalizedError)?.errorDescription ?? "Couldn't load services")
            } else {
                state = .loaded  // showing cache; treat as usable
            }
        }
    }

    // MARK: - Cache (UserDefaults JSON — no new file)

    private static func readCache(key: String) -> [ServiceOffering] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([ServiceOffering].self, from: data)
        else { return [] }
        return decoded
    }

    private static func writeCache(_ offerings: [ServiceOffering], key: String) {
        if let data = try? JSONEncoder().encode(offerings) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

// MARK: - ServiceCatalog (id resolution against the fetched set)

enum ServiceCatalog {
    /// The currently-known offerings (fetched or cached). Mirrored from
    /// CatalogStore so synchronous lookups (e.g. resolving a queued sale's
    /// serviceId back to a name) work without an async hop.
    private(set) static var all: [ServiceOffering] = []

    /// Called by CatalogStore whenever the catalog changes.
    static func register(_ offerings: [ServiceOffering]) { all = offerings }

    static func byId(_ id: String) -> ServiceOffering? { all.first { $0.id == id } }

    #if DEBUG
    /// DEBUG-only offline seed. NOT used on the live path — only injected
    /// manually from a developer build if you want the picker populated without
    /// a running backend. Production reads exclusively from the fetched catalog.
    static let debugSeed: [ServiceOffering] = [
        ServiceOffering(id: "give_20", name: "Hope Monthly", blurb: "Feeds a child for a month",
                        priceCents: 2000, frequency: .monthly, vertical: "charity", highlighted: false),
        ServiceOffering(id: "give_40", name: "Hope Plus", blurb: "Clean water for a family",
                        priceCents: 4000, frequency: .monthly, vertical: "charity", highlighted: true),
    ]
    #endif
}
