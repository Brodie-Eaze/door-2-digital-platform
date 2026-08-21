// ScheduleViewModel.swift

import CoreLocation
import Foundation
import Observation
import SwiftData
import UIKit

@Observable
@MainActor
final class ScheduleViewModel {
    var overdueCallbacks: [Knock] = []
    var todayCallbacks: [Knock] = []
    var pitchScript: String? = "Hi, my name is [Name] with Door 2 Digital. I'm out in your neighbourhood today reaching out to homeowners about [Campaign]. Do you have just 2 minutes? I promise I won't take up much of your time."

    /// Knocks recorded during the current active shift. Surfaced on the shift card.
    var sessionKnockCount: Int = 0

    // MARK: - Roster (real rostered shifts from the platform)

    /// The rep's rostered shifts (this + next week), grouped by date for display.
    var shifts: [ShiftDTO] = []
    var isLoadingShifts: Bool = false
    var shiftsError: String?
    /// Friendly message shown when a clock-in is rejected (e.g. shift has no
    /// territory → server 422). Cleared on the next successful action.
    var clockActionMessage: String?

    private var apiClient = APIClient()
    private let location = LocationService()

    /// Shifts grouped by `date` ("YYYY-MM-DD"), date-ascending — drives the list.
    var shiftsByDate: [(date: String, shifts: [ShiftDTO])] {
        let groups = Dictionary(grouping: shifts, by: { $0.date })
        return groups.keys.sorted().map { (date: $0, shifts: groups[$0]!.sorted { $0.start < $1.start }) }
    }

    var todayISODate: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    // MARK: - Refresh

    func refresh(context: ModelContext, appState: AppState) async {
        loadCallbacks(context: context)
        refreshSessionKnockCount(appState: appState, context: context)
        await loadShifts(appState: appState)
    }

    /// Fetch `/roster/shifts/mine`. On failure, keep whatever we had and surface
    /// the error — the local KnockSession shift spine keeps working offline.
    func loadShifts(appState: AppState) async {
        apiClient.accessToken = appState.accessToken
        isLoadingShifts = true
        shiftsError = nil
        do {
            shifts = try await apiClient.fetchMyShifts()
        } catch {
            shiftsError = (error as? LocalizedError)?.errorDescription ?? "Couldn't load your shifts"
        }
        isLoadingShifts = false
    }

    private func loadCallbacks(context: ModelContext) {
        // Hoist the enum rawValue into a local — the #Predicate macro can't
        // resolve an enum-case member access inside the predicate body.
        let callbackRaw = KnockDisposition.callback.rawValue
        let descriptor = FetchDescriptor<Knock>(
            predicate: #Predicate { $0.dispositionRaw == callbackRaw },
            sortBy: [SortDescriptor(\.capturedAt, order: .forward)]
        )
        guard let knocks = try? context.fetch(descriptor) else { return }

        let now = Date()
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: now)
        let todayEnd = calendar.date(byAdding: .day, value: 1, to: todayStart)!

        overdueCallbacks = knocks.filter { $0.capturedAt < todayStart }
        todayCallbacks = knocks.filter { $0.capturedAt >= todayStart && $0.capturedAt < todayEnd }
    }

    // MARK: - Shift management (platform clock-in/out + local session spine)

    /// Clock in to a SPECIFIC rostered shift. Posts to the platform first; on
    /// success it opens the durable local KnockSession (so knocks captured during
    /// the shift are linked + survive offline) and flips AppState. The server
    /// session id is stamped onto the local session for reconciliation.
    func clockIn(shift: ShiftDTO, appState: AppState, context: ModelContext) async {
        clockActionMessage = nil
        apiClient.accessToken = appState.accessToken

        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
        let coord = location.coordinate
        let body = ClockInRequest(
            deviceId: deviceId,
            latitude: coord?.latitude,
            longitude: coord?.longitude,
            appVersion: Config.appVersion,
            osVersion: UIDevice.current.systemVersion,
            attestationToken: nil
        )

        var serverSessionId: String?
        do {
            let resp = try await apiClient.clockIn(shiftId: shift.id, body: body)
            serverSessionId = resp.sessionId
        } catch APIError.httpError(let code, _) where code == 422 {
            // Shift has no territory — the server can't open a session.
            clockActionMessage = "This shift has no territory yet. Ask your manager to assign one before you clock in."
            return
        } catch {
            // Network/other failure — allow offline shift start so the rep can
            // still capture knocks; we'll reconcile the server session later.
            clockActionMessage = "Couldn't reach the platform — started offline. Your time will sync when you're back online."
        }

        startLocalSession(appState: appState, context: context,
                          serverSessionId: serverSessionId,
                          coord: coord, deviceId: deviceId)
        await loadShifts(appState: appState)
    }

    /// Off-shift card "Start shift" with no specific roster row — opens a local
    /// session only (no platform shift to clock into). Preserves the existing
    /// offline-first behavior.
    func startShift(appState: AppState, context: ModelContext) async {
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
        startLocalSession(appState: appState, context: context,
                          serverSessionId: nil, coord: location.coordinate, deviceId: deviceId)
    }

    private func startLocalSession(appState: AppState, context: ModelContext,
                                   serverSessionId: String?,
                                   coord: CLLocationCoordinate2D?, deviceId: String) {
        let session = KnockSession(
            orgId: appState.orgId,
            userId: appState.currentUser?.id ?? "",
            startLatitude: coord?.latitude ?? 0,   // 0 = unknown until a fix lands
            startLongitude: coord?.longitude ?? 0,
            deviceId: deviceId
        )
        let sessionId = session.id.uuidString
        session.serverSessionId = serverSessionId
        session.syncStatusRaw = serverSessionId == nil ? "pending" : "synced"

        context.insert(session)
        try? context.save()

        sessionKnockCount = 0
        appState.startShift(sessionId: sessionId)
    }

    /// Clock out. Closes the active local session, then best-effort POSTs the
    /// platform clock-out for whichever active shift we can identify.
    func endShift(appState: AppState, context: ModelContext) async {
        // Close the active local session first (the offline source of truth).
        let descriptor = FetchDescriptor<KnockSession>(
            predicate: #Predicate { $0.endedAt == nil },
            sortBy: [SortDescriptor(\.startedAt, order: .reverse)]
        )
        if let session = (try? context.fetch(descriptor))?.first {
            session.endedAt = Date()
            session.syncStatusRaw = "pending"
            try? context.save()
        }
        sessionKnockCount = 0
        appState.isOnShift = false
        appState.sessionId = nil

        // Best-effort platform clock-out for an active rostered shift.
        apiClient.accessToken = appState.accessToken
        if let active = shifts.first(where: { $0.status == "active" }) {
            _ = try? await apiClient.clockOut(shiftId: active.id)
            await loadShifts(appState: appState)
        }
    }

    /// Live count of knocks captured during the active shift. Cheap; safe to
    /// call on refresh + when the shift card appears.
    func refreshSessionKnockCount(appState: AppState, context: ModelContext) {
        guard appState.isOnShift, let sessionId = appState.sessionId else {
            sessionKnockCount = 0
            return
        }
        let descriptor = FetchDescriptor<Knock>(
            predicate: #Predicate { $0.sessionId == sessionId }
        )
        sessionKnockCount = (try? context.fetchCount(descriptor)) ?? 0
    }
}
