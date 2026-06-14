// Config.swift — app-wide configuration constants.
// API base URL is read from Info.plist key D2D_API_BASE_URL so CI can
// inject per-environment values without modifying source.

import Foundation

enum Config {
    // MARK: - API

    static let apiBaseURL: URL = {
        let plistValue = Bundle.main.object(forInfoDictionaryKey: "D2D_API_BASE_URL") as? String
        #if DEBUG
        // Local dev: the simulator must reach the Fastify API on the host. The
        // committed plist default is the production https URL (for release), so
        // in DEBUG we ignore it unless it's an explicit local/http override and
        // otherwise fall through to localhost.
        if let s = plistValue, !s.isEmpty,
           (s.hasPrefix("http://") || s.contains("localhost") || s.contains("127.0.0.1")),
           let url = URL(string: s) { return url }
        return URL(string: "http://localhost:3010/v1")!
        #else
        if let s = plistValue, !s.isEmpty, let url = URL(string: s) { return url }
        return URL(string: "https://api.d2d.io/v1")!
        #endif
    }()

    // MARK: - Auth

    /// Re-request biometric auth when app has been backgrounded longer than this.
    static let biometricTimeoutSeconds: TimeInterval = 60
    /// Proactively refresh the JWT when fewer than this many seconds remain.
    static let jwtRefreshBufferSeconds: TimeInterval = 60

    // MARK: - Offline sync

    /// Maximum number of knocks sent per batch POST.
    static let syncBatchSize = 500
    /// Back-off delays (seconds) between sync retry attempts.
    static let syncRetryDelays: [TimeInterval] = [5, 30, 120, 600, 3600]

    // MARK: - Location

    /// Target horizontal accuracy before accepting a fix (metres).
    static let locationAccuracyThresholdMetres = 20.0

    // MARK: - App metadata

    static let appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.1.0"
    static let buildNumber = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
}
