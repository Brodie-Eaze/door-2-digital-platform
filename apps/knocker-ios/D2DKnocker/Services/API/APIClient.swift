// APIClient.swift — URLSession-based API client for the D2D /v1 API.
// Injects Bearer token from the passed access token string.
// All methods are async throws; callers handle errors.

import Foundation

enum APIError: Error, LocalizedError {
    case noToken
    case sessionExpired
    case invalidURL
    case httpError(statusCode: Int, body: String)
    case decodingError(underlying: Error)
    case networkError(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .noToken:            return "Not authenticated"
        case .sessionExpired:     return "Session expired. Please sign in again."
        case .invalidURL:         return "Invalid URL"
        case .httpError(let s, _): return "HTTP \(s)"
        case .decodingError:      return "Response parsing failed"
        case .networkError(let e): return e.localizedDescription
        }
    }
}

final class APIClient {
    private let baseURL: URL
    private let session: URLSession
    private let iso8601: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    var accessToken: String?

    // Keychain is the source of truth for the rotated token pair. The client
    // reads the refresh token from here and writes back the new pair after a
    // silent refresh, so every APIClient instance + the keychain stay coherent.
    private let keychain: KeychainService

    // Coalesces concurrent refreshes: if two requests 401 at once, only one
    // network refresh runs (refresh tokens rotate — a second refresh with an
    // already-spent token would needlessly fail and bounce the rep).
    private let refreshLock = NSLock()
    private var refreshTask: Task<Void, Error>?

    init(baseURL: URL = Config.apiBaseURL, accessToken: String? = nil, keychain: KeychainService = KeychainService()) {
        self.baseURL = baseURL
        self.accessToken = accessToken
        self.keychain = keychain
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        self.session = URLSession(configuration: config)
    }

    // MARK: - Auth

    func login(email: String, password: String, deviceId: String) async throws -> LoginResponse {
        let body = LoginRequest(email: email, password: password, deviceId: deviceId)
        return try await post(path: "/auth/login", body: body, requiresAuth: false)
    }

    // MARK: - Session

    func startSession(_ req: StartSessionRequest) async throws -> StartSessionResponse {
        return try await post(path: "/sessions", body: req)
    }

    // MARK: - Knocks

    // App Attest: each knock-batch sync carries a device attestation token so the
    // server can verify the request comes from a genuine, unmodified D2D build
    // (anti-fabrication for the field data). The token is keyed to a per-batch
    // challenge (the first knock's idempotency key, which is unique + replay-safe).
    // On the simulator / DEBUG this yields a stub; full verification requires a
    // physical device + the server-side App Attest verifier (see service note).
    private let attestation = AttestationService()

    func batchCreateKnocks(_ req: KnockBatchRequest) async throws -> KnockBatchResponse {
        var headers: [String: String] = [:]
        if let challenge = req.knocks.first?.idempotencyKey,
           let token = await attestation.attestationToken(for: challenge) {
            headers["X-App-Attest"] = token
            headers["X-App-Attest-Challenge"] = challenge
        }
        return try await post(path: "/knocks/batch", body: req, headers: headers.isEmpty ? nil : headers)
    }

    // MARK: - Leads

    func createLead(_ req: CreateLeadRequest) async throws -> CreateLeadResponse {
        return try await post(path: "/leads", body: req, idempotencyKey: req.idempotencyKey)
    }

    // MARK: - Sales (sign-ups)
    // Posts to the dedicated field sign-up endpoint `POST /v1/field/signups`,
    // which accepts the field shape (name + service + amount + frequency),
    // creates the Lead + ConsentRecord + Conversion + Donation server-side, and
    // takes org/userId from the JWT (body orgId is ignored). Idempotency-Key
    // header dedups retries.

    func createSale(_ req: CreateSaleRequest) async throws -> CreateSaleResponse {
        return try await post(path: "/field/signups", body: req, idempotencyKey: req.idempotencyKey)
    }

    // MARK: - Photos (property photo per knock — uploaded + HELD on the platform)
    // POST /v1/photos with the base64 JPEG; any in-org role's bearer token is
    // accepted. Idempotency-Key (the photo op id) dedups retries so a re-drained
    // dead-zone photo isn't held twice. Reuses the shared post(...) helper, so it
    // inherits the auth + 401-silent-refresh + back-off behaviour for free.

    func uploadKnockPhoto(_ req: CreatePhotoRequest, idempotencyKey: String) async throws -> CreatePhotoResponse {
        return try await post(path: "/photos", body: req, idempotencyKey: idempotencyKey)
    }

    // MARK: - Territory

    func fetchTerritory(id: String) async throws -> TerritoryDTO {
        return try await get(path: "/territories/\(id)")
    }

    /// The rep's assigned, active territories (drives the Map tab). Empty array
    /// = no assignment yet (Map shows an honest "no territory" overlay).
    func fetchAssignedTerritories() async throws -> [AssignedTerritoryDTO] {
        return try await get(path: "/territories/assigned")
    }

    // MARK: - Catalog (org's ServiceOfferings)

    /// The org's live service catalog (giving tiers / product plans). Returned
    /// sortOrder-asc by the server; the app caches the last good fetch so the
    /// picker still works offline.
    func fetchCatalog() async throws -> [ServiceOffering] {
        let dtos: [CatalogOfferingDTO] = try await get(path: "/catalog")
        return dtos.map { $0.toOffering() }
    }

    // MARK: - Roster (shifts + clock in/out)

    func fetchMyShifts() async throws -> [ShiftDTO] {
        return try await get(path: "/roster/shifts/mine")
    }

    /// Opens the working session for a rostered shift. The server returns 422 if
    /// the shift has no territory — surfaced to the rep as a friendly message.
    func clockIn(shiftId: String, body: ClockInRequest) async throws -> ClockInResponse {
        return try await post(
            path: "/roster/shifts/\(shiftId)/clock-in",
            body: body,
            idempotencyKey: "clockin-\(shiftId)-\(Int(Date().timeIntervalSince1970))"
        )
    }

    /// Closes the working session. No body; the server takes the open session
    /// from the shift. Idempotency-Key required by the roster middleware.
    func clockOut(shiftId: String) async throws -> ClockOutResponse {
        let empty: [String: String] = [:]
        return try await post(
            path: "/roster/shifts/\(shiftId)/clock-out",
            body: empty,
            idempotencyKey: "clockout-\(shiftId)-\(Int(Date().timeIntervalSince1970))"
        )
    }

    // MARK: - Stats

    func fetchDailyStats(orgId: String, userId: String) async throws -> DailyStatsResponse {
        return try await get(path: "/users/\(userId)/daily-stats")
    }

    // MARK: - Inbox

    func fetchInbox(orgId: String) async throws -> [InboxMessageDTO] {
        return try await get(path: "/notifications/inbox")
    }

    // MARK: - Callbacks

    func fetchCallbacks() async throws -> [CallbackDTO] {
        return try await get(path: "/leads/callbacks")
    }

    // MARK: - Generic helpers

    private func get<R: Decodable>(path: String) async throws -> R {
        let req = try buildRequest(method: "GET", path: path, body: Optional<Data>.none)
        return try await execute(req)
    }

    private func post<B: Encodable, R: Decodable>(
        path: String,
        body: B,
        requiresAuth: Bool = true,
        idempotencyKey: String? = nil,
        headers: [String: String]? = nil
    ) async throws -> R {
        let data = try JSONEncoder().encode(body)
        var req = try buildRequest(method: "POST", path: path, body: data, requiresAuth: requiresAuth)
        if let idempotencyKey { req.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key") }
        if let headers { for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) } }
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(req)
    }

    private func buildRequest(
        method: String,
        path: String,
        body: Data?,
        requiresAuth: Bool = true
    ) throws -> URLRequest {
        // Join base + path by string. `URL(string: "/auth/login", relativeTo:)`
        // treats a leading-slash path as host-absolute and DROPS the baseURL's
        // own path (the `/v1` prefix), so every call would 404. Concatenate so
        // `http://localhost:3010/v1` + `/auth/login` → `…/v1/auth/login`.
        var base = baseURL.absoluteString
        if base.hasSuffix("/") { base.removeLast() }
        let suffix = path.hasPrefix("/") ? path : "/" + path
        guard let url = URL(string: base + suffix) else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.httpBody = body
        if requiresAuth {
            guard let token = accessToken else { throw APIError.noToken }
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.setValue("D2D-Knocker/\(Config.appVersion)", forHTTPHeaderField: "User-Agent")
        req.setValue(ISO8601DateFormatter().string(from: Date()), forHTTPHeaderField: "X-Request-Time")
        return req
    }

    private func execute<R: Decodable>(_ request: URLRequest, allowRefresh: Bool = true) async throws -> R {
        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.networkError(underlying: error)
        }
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            // Access tokens are 5-min TTL. On a 401 for an authed request, attempt
            // ONE silent refresh + retry before surfacing the error to the rep.
            if http.statusCode == 401,
               allowRefresh,
               request.value(forHTTPHeaderField: "Authorization") != nil {
                try await refresh()
                var retried = request
                retried.setValue("Bearer \(accessToken ?? "")", forHTTPHeaderField: "Authorization")
                return try await execute(retried, allowRefresh: false)
            }
            let body = String(data: data, encoding: .utf8) ?? ""
            throw APIError.httpError(statusCode: http.statusCode, body: body)
        }
        do {
            return try JSONDecoder().decode(R.self, from: data)
        } catch {
            throw APIError.decodingError(underlying: error)
        }
    }

    // MARK: - Token refresh

    /// Exchanges the stored refresh token for a fresh access+refresh pair and
    /// persists both to the keychain. Coalesced so concurrent 401s trigger a
    /// single network refresh. Throws `.sessionExpired` if the refresh token is
    /// missing or itself rejected — the caller should force a re-login.
    func refresh() async throws {
        refreshLock.lock()
        if let existing = refreshTask {
            refreshLock.unlock()
            return try await existing.value
        }
        let task = Task<Void, Error> { try await self.performRefresh() }
        refreshTask = task
        refreshLock.unlock()
        defer {
            refreshLock.lock(); refreshTask = nil; refreshLock.unlock()
        }
        try await task.value
    }

    private func performRefresh() async throws {
        guard let rt = keychain.refreshToken else { throw APIError.sessionExpired }
        let data = try JSONEncoder().encode(RefreshRequest(refreshToken: rt))
        var req = try buildRequest(method: "POST", path: "/auth/refresh", body: data, requiresAuth: false)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {
            let resp: LoginResponse = try await execute(req, allowRefresh: false)
            accessToken = resp.accessToken
            keychain.accessToken = resp.accessToken
            if let newRt = resp.refreshToken { keychain.refreshToken = newRt }
        } catch APIError.httpError(let code, _) where code == 401 || code == 403 {
            // Refresh token spent/revoked — the session is genuinely over.
            throw APIError.sessionExpired
        }
    }
}
