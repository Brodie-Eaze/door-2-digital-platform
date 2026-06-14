// LocationService.swift — wraps CLLocationManager in a Swift Concurrency /
// @Observable pattern. Publishes the most recent location fix and accuracy.
// Background location is enabled for shift mode (knocker is clocked in).

import Foundation
import CoreLocation
import Observation

@Observable
final class LocationService: NSObject, CLLocationManagerDelegate {
    var coordinate: CLLocationCoordinate2D?
    var accuracy: CLLocationAccuracy = 999
    var heading: CLLocationDirection = 0
    var authorizationStatus: CLAuthorizationStatus = .notDetermined

    private let manager: CLLocationManager

    override init() {
        manager = CLLocationManager()
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5
        manager.pausesLocationUpdatesAutomatically = false
        manager.allowsBackgroundLocationUpdates = false  // enabled via startShift()
    }

    // MARK: - Lifecycle

    func requestAlways() {
        manager.requestAlwaysAuthorization()
    }

    func requestWhenInUse() {
        manager.requestWhenInUseAuthorization()
    }

    func startUpdating() {
        manager.startUpdatingLocation()
        manager.startUpdatingHeading()
    }

    func stopUpdating() {
        manager.stopUpdatingLocation()
        manager.stopUpdatingHeading()
    }

    /// Enable background updates when a shift is active.
    func startShift() {
        manager.allowsBackgroundLocationUpdates = true
        manager.startMonitoringSignificantLocationChanges()
    }

    func endShift() {
        manager.allowsBackgroundLocationUpdates = false
        manager.stopMonitoringSignificantLocationChanges()
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        coordinate = loc.coordinate
        accuracy = loc.horizontalAccuracy
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        heading = newHeading.magneticHeading
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        authorizationStatus = manager.authorizationStatus
        if authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways {
            startUpdating()
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Log but don't crash — GPS can temporarily fail
        print("[LocationService] error: \(error.localizedDescription)")
    }
}
