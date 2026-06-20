// Config.swift — app-wide configuration constants.
// API base URL is read from Info.plist key D2D_API_BASE_URL so CI can
// inject per-environment values without modifying source.

import Foundation

enum Config {
    // MARK: - API

    /// API base URL, resolved per build configuration. The value comes from the
    /// `D2D_API_BASE_URL` Info.plist key, which is substituted at build time from
    /// the like-named build setting (Debug = localhost / Mac LAN IP, Release =
    /// https://api.d2d.io/v1; override the Release setting to a Railway https URL
    /// for staging). See STAGING.md.
    ///
    /// Three tiers:
    ///   - Local dev (DEBUG):  http://localhost:3010/v1 (simulator) or the Mac's
    ///       LAN IP (real device). A stray https value is ignored in DEBUG so the
    ///       simulator never accidentally talks to staging/prod.
    ///   - Staging (RELEASE):  whatever https staging URL the build setting injects.
    ///   - Production (RELEASE default): https://api.d2d.io/v1.
    static let apiBaseURL: URL = {
        let plistValue = Bundle.main.object(forInfoDictionaryKey: "D2D_API_BASE_URL") as? String
        #if DEBUG
        // DEBUG only honours a plaintext/LAN/localhost override so a misconfigured
        // https value can't pull the simulator off the local dev API. Anything
        // else falls back to localhost.
        if let s = plistValue, !s.isEmpty,
           (s.hasPrefix("http://") || s.contains("localhost") || s.contains("127.0.0.1")),
           let url = URL(string: s) { return url }
        return URL(string: "http://localhost:3010/v1")!
        #else
        // RELEASE (staging or production): trust the injected value (an https URL
        // under ATS), else fall back to production.
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
