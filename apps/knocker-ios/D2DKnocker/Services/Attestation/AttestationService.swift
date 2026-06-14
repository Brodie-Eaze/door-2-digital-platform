// AttestationService.swift — wraps Apple App Attest.
// Generates an attestation token before each knock batch sync so the server
// can verify the request originates from a genuine, unmodified D2D build.
// Falls through gracefully in simulator / debug builds where DeviceCheck
// does not work.

import Foundation
import DeviceCheck

actor AttestationService {
    private var keyId: String?
    private let keychain = KeychainService()

    // MARK: - Public API

    /// Returns an attestation token for the given challenge string, or nil if
    /// attestation is unavailable (simulator, DeviceCheck unsupported).
    func attestationToken(for challenge: String) async -> String? {
        guard DCAppAttestService.shared.isSupported else {
            return simulatorFallback()
        }
        do {
            let kid = try await ensureKeyId()
            let challengeData = Data(challenge.utf8)
            let hash = challengeData
            let assertion = try await DCAppAttestService.shared.generateAssertion(kid, clientDataHash: hash)
            return assertion.base64EncodedString()
        } catch {
            return nil
        }
    }

    // MARK: - Key management

    private func ensureKeyId() async throws -> String {
        if let existing = keychain.readString(forKey: "io.d2d.knocker.attestKeyId") {
            return existing
        }
        let keyId = try await DCAppAttestService.shared.generateKey()
        keychain.writeString(keyId, forKey: "io.d2d.knocker.attestKeyId")
        return keyId
    }

    // MARK: - Simulator stub

    private func simulatorFallback() -> String? {
        #if DEBUG
        return "SIMULATOR_ATTESTATION_STUB"
        #else
        return nil
        #endif
    }
}
