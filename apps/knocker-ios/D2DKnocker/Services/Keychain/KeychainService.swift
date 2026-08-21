// KeychainService.swift — stores / retrieves the access token and user
// profile from the iOS Keychain. Never stores PII in UserDefaults.

import Foundation
import Security

final class KeychainService {
    private let tokenKey        = "io.d2d.knocker.accessToken"
    private let refreshKey      = "io.d2d.knocker.refreshToken"
    private let userKey         = "io.d2d.knocker.currentUser"

    // MARK: - Access token

    var accessToken: String? {
        get { readString(key: tokenKey) }
        set {
            if let value = newValue { write(value.data(using: .utf8)!, key: tokenKey) }
            else { delete(key: tokenKey) }
        }
    }

    // MARK: - Refresh token

    var refreshToken: String? {
        get { readString(key: refreshKey) }
        set {
            if let value = newValue { write(value.data(using: .utf8)!, key: refreshKey) }
            else { delete(key: refreshKey) }
        }
    }

    // MARK: - Current user

    var currentUser: UserProfile? {
        get {
            guard let data = readData(key: userKey) else { return nil }
            return try? JSONDecoder().decode(UserProfile.self, from: data)
        }
        set {
            if let value = newValue,
               let data = try? JSONEncoder().encode(value) {
                write(data, key: userKey)
            } else {
                delete(key: userKey)
            }
        }
    }

    // MARK: - Clear all

    func clearAll() {
        delete(key: tokenKey)
        delete(key: refreshKey)
        delete(key: userKey)
    }

    // MARK: - Generic string storage
    // Used by AttestationService to persist the App Attest key id. Public
    // wrappers over the private helpers so callers can't reach raw SecItem APIs.

    func readString(forKey key: String) -> String? {
        readString(key: key)
    }

    @discardableResult
    func writeString(_ value: String, forKey key: String) -> Bool {
        write(Data(value.utf8), key: key)
    }

    // MARK: - Private helpers

    private func readString(key: String) -> String? {
        guard let data = readData(key: key) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func readData(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String:            kSecClassGenericPassword,
            kSecAttrAccount as String:      key,
            kSecReturnData as String:       true,
            kSecMatchLimit as String:       kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }

    @discardableResult
    private func write(_ data: Data, key: String) -> Bool {
        delete(key: key)
        let query: [String: Any] = [
            kSecClass as String:            kSecClassGenericPassword,
            kSecAttrAccount as String:      key,
            kSecValueData as String:        data,
            kSecAttrAccessible as String:   kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    @discardableResult
    private func delete(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String:        kSecClassGenericPassword,
            kSecAttrAccount as String:  key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}
