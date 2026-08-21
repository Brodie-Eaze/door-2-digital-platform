// SyncEngine.swift — drains the PendingSync queue to the server.
// Runs whenever network is available; respects back-off delays on failure.
// Idempotency keys ensure the server deduplicates duplicates on retry.

import Foundation
import SwiftData
import Observation

@Observable
final class SyncEngine {
    var isSyncing: Bool = false
    var pendingCount: Int = 0
    var deadLetterCount: Int = 0
    var lastSyncError: String?
    var lastSyncAt: Date?

    /// Live in-memory session token from AppState. The app authenticates the rest
    /// of its traffic off AppState (set at login), not the Keychain — and on some
    /// builds/simulators the Keychain write is silently rejected (no keychain
    /// access-group entitlement → SecItemAdd fails), so `keychain.accessToken`
    /// reads nil even though the rep is signed in. That stranded every queued
    /// knock at `.noToken` ("Not authenticated") and it never left the device.
    /// ContentView keeps this synced to `appState.accessToken`; the drain prefers
    /// it and falls back to the Keychain.
    var authTokenOverride: String?

    /// After this many failed attempts an item is dead-lettered (stops retrying)
    /// so a poison message can't loop forever or block the rest of the queue.
    private let maxAttempts = 8
    /// Exponential back-off (seconds) keyed by attempt count, capped.
    private func backoff(_ attempts: Int) -> TimeInterval {
        min(pow(2.0, Double(attempts)), 600)   // 1,2,4,…,600s cap
    }

    private let apiClient: APIClient
    private let keychain: KeychainService
    private var syncTask: Task<Void, Never>?

    init(keychain: KeychainService) {
        self.keychain = keychain
        self.apiClient = APIClient()
    }

    // MARK: - Trigger

    /// Call when the app foregrounds or network connectivity returns.
    func triggerSync(context: ModelContext) {
        guard !isSyncing else { return }
        syncTask?.cancel()
        syncTask = Task { [weak self] in
            await self?.drainQueue(context: context)
        }
    }

    // MARK: - Queue drain

    @MainActor
    private func drainQueue(context: ModelContext) async {
        isSyncing = true
        defer { isSyncing = false }

        // Live session token first (AppState), Keychain as fallback. See
        // `authTokenOverride` — the Keychain can read nil while the rep is signed
        // in, which used to strand every knock at "Not authenticated".
        apiClient.accessToken = authTokenOverride ?? keychain.accessToken

        // Fetch all pending items ordered by createdAt
        let descriptor = FetchDescriptor<PendingSync>(
            predicate: #Predicate { $0.completedAt == nil },
            sortBy: [SortDescriptor(\.createdAt)]
        )
        guard let all = try? context.fetch(descriptor), !all.isEmpty else {
            pendingCount = 0; deadLetterCount = 0
            return
        }

        // Dead-letter exhausted items (stop retrying so they can't loop forever
        // or block good items behind them in the batch).
        let now = Date()
        for item in all where item.attempts >= maxAttempts {
            item.completedAt = now
            item.lastError = (item.lastError ?? "") + " [dead-lettered after \(maxAttempts) attempts]"
        }
        // Eligible = not exhausted + back-off elapsed since last attempt.
        let items = all.filter { item in
            guard item.attempts < maxAttempts else { return false }
            if let last = item.lastAttemptAt { return now.timeIntervalSince(last) >= backoff(item.attempts) }
            return true
        }

        // Process knock batch: collect all eligible knock creates, send as one batch
        let knockItems = items.filter { $0.operationType == .createKnock }
        if !knockItems.isEmpty {
            await syncKnockBatch(knockItems, context: context)
        }
        for item in items where item.operationType != .createKnock {
            await syncItem(item, context: context)
        }

        try? context.save()
        // Re-count live queue vs dead-letters for the offline banner.
        pendingCount = all.filter { $0.completedAt == nil && $0.attempts < maxAttempts }.count
        deadLetterCount = all.filter { $0.completedAt != nil && ($0.lastError?.contains("dead-lettered") ?? false) }.count
        lastSyncAt = Date()
    }

    private func syncKnockBatch(_ items: [PendingSync], context: ModelContext) async {
        var payloads: [KnockPayload] = []
        for item in items {
            guard let data = item.payloadJSON.data(using: .utf8),
                  let payload = try? JSONDecoder().decode(KnockPayload.self, from: data) else { continue }
            payloads.append(payload)
        }
        guard !payloads.isEmpty else { return }

        do {
            let response = try await apiClient.batchCreateKnocks(KnockBatchRequest(knocks: payloads))
            // Mark each server-acknowledged knock (inserted OR deduped) complete;
            // the server returns them all in `knocks` keyed by idempotencyKey.
            let processedKeys = Set(response.knocks.map { $0.idempotencyKey })
            // A 201 can still carry per-knock rejections in `errors` (e.g. an
            // unknown sessionId). Those must count as attempts + surface the
            // message — otherwise the item sits at attempts=0 forever and the
            // drain re-POSTs it every cycle in a silent loop.
            var errorByKey: [String: String] = [:]
            for e in response.errors { if let k = e.idempotencyKey { errorByKey[k] = e.message } }
            for item in items {
                if processedKeys.contains(item.idempotencyKey) {
                    item.completedAt = Date()
                } else if let msg = errorByKey[item.idempotencyKey] {
                    item.attempts += 1
                    item.lastAttemptAt = Date()
                    item.lastError = msg
                    lastSyncError = msg
                }
            }
            try? context.save()
            if response.errors.isEmpty { lastSyncError = nil }
        } catch {
            for item in items {
                item.attempts += 1
                item.lastAttemptAt = Date()
                item.lastError = error.localizedDescription
            }
            try? context.save()
            lastSyncError = error.localizedDescription
        }
    }

    private func syncItem(_ item: PendingSync, context: ModelContext) async {
        guard let data = item.payloadJSON.data(using: .utf8) else { return }
        do {
            switch item.operationType {
            case .createLead:
                let req = try JSONDecoder().decode(CreateLeadRequest.self, from: data)
                _ = try await apiClient.createLead(req)
            case .createSale:
                let req = try JSONDecoder().decode(CreateSaleRequest.self, from: data)
                _ = try await apiClient.createSale(req)
            case .createPhoto:
                // Read the local JPEG NOW (kept out of the queue row), base64-encode,
                // and upload to be held on the platform. If the file is gone we can't
                // recover the bytes — dead-letter immediately rather than burning the
                // full retry budget on an unrecoverable op.
                let p = try JSONDecoder().decode(PhotoSyncPayload.self, from: data)
                guard let bytes = FileManager.default.contents(atPath: p.localPath) else {
                    item.completedAt = Date()
                    item.lastError = "photo file missing at \(p.localPath) [dead-lettered]"
                    try? context.save()
                    return
                }
                let req = CreatePhotoRequest(
                    clientKnockId: p.clientKnockId,
                    capturedAt: p.capturedAt,
                    latitude: p.latitude,
                    longitude: p.longitude,
                    addressLine: p.addressLine,
                    contentType: p.contentType,
                    imageBase64: bytes.base64EncodedString()
                )
                // Idempotency key = the op's own id, so a re-drain holds the photo once.
                _ = try await apiClient.uploadKnockPhoto(req, idempotencyKey: item.idempotencyKey)
            case .startSession, .endSession, .uploadPhoto, .uploadSignature:
                // Best-effort: not yet wired to a dedicated endpoint. Mark complete
                // so these don't clog the queue (knock/lead/sale carry the data).
                break
            case .createKnock:
                break   // handled by the batch path
            }
            item.completedAt = Date()
            try? context.save()
        } catch {
            item.attempts += 1
            item.lastAttemptAt = Date()
            item.lastError = error.localizedDescription
            try? context.save()
        }
    }
}
