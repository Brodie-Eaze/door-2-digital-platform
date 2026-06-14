// ReachabilityMonitor.swift — network reachability via NWPathMonitor.
// Drives AppState.isOnline so the rep gets a real offline banner, and fires a
// sync drain the moment connectivity returns (dead-zone sales catch up).

import Foundation
import Network

final class ReachabilityMonitor {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "io.d2d.reachability")
    private var started = false

    /// Starts monitoring; `onChange(isOnline)` is delivered on the main actor on
    /// every path change (and once immediately with the current status).
    func start(_ onChange: @escaping (Bool) -> Void) {
        guard !started else { return }
        started = true
        monitor.pathUpdateHandler = { path in
            let online = path.status == .satisfied
            DispatchQueue.main.async { onChange(online) }
        }
        monitor.start(queue: queue)
    }

    func stop() { monitor.cancel() }
}
