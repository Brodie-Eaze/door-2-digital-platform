// ScheduleView.swift — date header, shift card, today's callbacks. Matches mockup.

import SwiftUI
import SwiftData

struct ScheduleView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @State private var viewModel = ScheduleViewModel()

    private var callbacks: [Knock] { viewModel.overdueCallbacks + viewModel.todayCallbacks }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    dateHeader
                    shiftCard
                    if let msg = viewModel.clockActionMessage {
                        clockNotice(msg)
                    }
                    rosterSection
                    callbacksSection
                    manageSection
                    if let pitch = viewModel.pitchScript {
                        pitchSection(pitch)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 24)
            }
            .background(D2DColor.paper)
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await viewModel.refresh(context: modelContext, appState: appState) }
        }
        .task { await viewModel.refresh(context: modelContext, appState: appState) }
    }

    // MARK: - Date header

    private var dateHeader: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(Self.dateFormatter.string(from: Date()))
                .font(.system(size: 26, weight: .bold))
                .foregroundStyle(D2DColor.ink)
            Text(headerSubtitle)
                .font(.system(size: 14))
                .foregroundStyle(D2DColor.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var headerSubtitle: String {
        if appState.isOnShift, let start = appState.shiftStartedAt {
            return "Active shift · \(Self.duration(since: start))"
        }
        return "Not clocked in"
    }

    // MARK: - Shift card

    private var shiftCard: some View {
        Group {
            if appState.isOnShift {
                onShiftCard
            } else {
                offShiftCard
            }
        }
    }

    // On shift — live elapsed timer + session knock count, ticks every second.
    private var onShiftCard: some View {
        TimelineView(.periodic(from: .now, by: 1)) { _ in
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Circle().fill(D2DColor.accent).frame(width: 7, height: 7)
                        Text("ON SHIFT")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(D2DColor.accent)
                            .tracking(0.5)
                    }
                    Text(elapsedString)
                        .font(.system(size: 28, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(D2DColor.ink)
                    Text(onShiftDetail)
                        .font(.system(size: 12))
                        .foregroundStyle(D2DColor.muted)
                }
                Spacer()
                Button { Task { await viewModel.endShift(appState: appState, context: modelContext) } } label: {
                    Text("Clock out")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(D2DColor.accent)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .overlay(Capsule().strokeBorder(D2DColor.accent.opacity(0.4), lineWidth: 1))
                }
            }
            .padding(16)
            .background(D2DColor.accentSoft.opacity(0.6), in: RoundedRectangle(cornerRadius: D2DRadius.lg))
            .overlay(RoundedRectangle(cornerRadius: D2DRadius.lg).strokeBorder(D2DColor.accent.opacity(0.25), lineWidth: 1))
        }
    }

    // Off shift — obvious "you're not clocked in" nudge with a primary CTA.
    private var offShiftCard: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(D2DColor.paper).frame(width: 40, height: 40)
                    Image(systemName: "figure.walk")
                        .font(.system(size: 18))
                        .foregroundStyle(D2DColor.muted)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("You're not clocked in")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(D2DColor.ink)
                    Text("Start a shift to track your time and knocks")
                        .font(.system(size: 12))
                        .foregroundStyle(D2DColor.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
            }
            .padding(14)

            Button { Task { await viewModel.startShift(appState: appState, context: modelContext) } } label: {
                HStack(spacing: 6) {
                    Image(systemName: "play.fill").font(.system(size: 12, weight: .bold))
                    Text("Start shift").font(.system(size: 15, weight: .semibold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(D2DColor.accent, in: RoundedRectangle(cornerRadius: D2DRadius.md))
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 14)
        }
        .background(D2DColor.surface, in: RoundedRectangle(cornerRadius: D2DRadius.lg))
        .overlay(RoundedRectangle(cornerRadius: D2DRadius.lg).strokeBorder(D2DColor.line2, lineWidth: 1))
    }

    private var onShiftDetail: String {
        var parts: [String] = []
        if let start = appState.shiftStartedAt {
            parts.append("Started \(Self.timeFormatter.string(from: start))")
        }
        let count = viewModel.sessionKnockCount
        parts.append(count == 1 ? "1 knock" : "\(count) knocks")
        return parts.joined(separator: " · ")
    }

    private var elapsedString: String {
        guard let start = appState.shiftStartedAt else { return "0:00:00" }
        let s = max(0, Int(Date().timeIntervalSince(start)))
        let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
        return String(format: "%d:%02d:%02d", h, m, sec)
    }

    // MARK: - Callbacks

    private var callbacksSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("CALLBACKS · \(callbacks.count)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)

            if callbacks.isEmpty {
                D2DCard {
                    VStack(spacing: 8) {
                        Image(systemName: "calendar.badge.checkmark")
                            .font(.system(size: 26))
                            .foregroundStyle(D2DColor.soft)
                        Text("No callbacks scheduled")
                            .font(.system(size: 13))
                            .foregroundStyle(D2DColor.muted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                }
            } else {
                D2DCard(padded: false) {
                    VStack(spacing: 0) {
                        ForEach(Array(callbacks.enumerated()), id: \.element.id) { idx, knock in
                            CallbackRow(knock: knock, isOverdue: viewModel.overdueCallbacks.contains { $0.id == knock.id })
                            if idx < callbacks.count - 1 { Divider().padding(.leading, 64) }
                        }
                    }
                }
            }
        }
    }

    private var manageSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("MANAGE")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)
            D2DCard(padded: false) {
                VStack(spacing: 0) {
                    NavigationLink { AppointmentsListView() } label: {
                        manageRow(icon: "calendar", title: "Appointments")
                    }
                    Divider().padding(.leading, 52)
                    NavigationLink { ShiftHistoryView() } label: {
                        manageRow(icon: "clock.arrow.circlepath", title: "Shift history")
                    }
                }
            }
        }
    }

    private func manageRow(icon: String, title: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 16)).foregroundStyle(D2DColor.accent).frame(width: 24)
            Text(title).font(.system(size: 15)).foregroundStyle(D2DColor.ink)
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(D2DColor.soft)
        }
        .padding(.horizontal, 14).padding(.vertical, 14).contentShape(Rectangle())
    }

    // MARK: - Roster (real rostered shifts from the platform)

    private var rosterSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("MY SHIFTS")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)

            if viewModel.isLoadingShifts && viewModel.shifts.isEmpty {
                D2DCard {
                    HStack(spacing: 10) {
                        ProgressView().tint(D2DColor.accent)
                        Text("Loading your shifts…")
                            .font(.system(size: 13))
                            .foregroundStyle(D2DColor.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 6)
                }
            } else if viewModel.shifts.isEmpty {
                D2DCard {
                    VStack(spacing: 8) {
                        Image(systemName: "calendar.badge.exclamationmark")
                            .font(.system(size: 26))
                            .foregroundStyle(D2DColor.soft)
                        Text(viewModel.shiftsError ?? "No shifts rostered — check with your manager.")
                            .font(.system(size: 13))
                            .foregroundStyle(D2DColor.muted)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                }
            } else {
                ForEach(viewModel.shiftsByDate, id: \.date) { group in
                    rosterDayGroup(group)
                }
            }
        }
    }

    private func rosterDayGroup(_ group: (date: String, shifts: [ShiftDTO])) -> some View {
        let isToday = group.date == viewModel.todayISODate
        return VStack(alignment: .leading, spacing: 6) {
            Text(Self.shiftDayLabel(group.date, isToday: isToday))
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(isToday ? D2DColor.accent : D2DColor.muted)
            D2DCard(padded: false) {
                VStack(spacing: 0) {
                    ForEach(Array(group.shifts.enumerated()), id: \.element.id) { idx, shift in
                        ShiftRow(shift: shift, isToday: isToday) {
                            Task { await viewModel.clockIn(shift: shift, appState: appState, context: modelContext) }
                        }
                        if idx < group.shifts.count - 1 { Divider().padding(.leading, 14) }
                    }
                }
            }
        }
    }

    private func clockNotice(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(D2DColor.warn)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.ink2)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(D2DColor.warn.opacity(0.12), in: RoundedRectangle(cornerRadius: D2DRadius.md))
    }

    private static func shiftDayLabel(_ isoDate: String, isToday: Bool) -> String {
        if isToday { return "TODAY" }
        let inF = DateFormatter(); inF.dateFormat = "yyyy-MM-dd"
        guard let d = inF.date(from: isoDate) else { return isoDate }
        let outF = DateFormatter(); outF.dateFormat = "EEE, MMM d"
        return outF.string(from: d).uppercased()
    }

    private func pitchSection(_ pitch: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("PITCH OF THE DAY")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)
            D2DCard { PitchScriptCard(script: pitch) }
        }
    }

    // MARK: - Formatters

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEEE, MMM d"; return f
    }()
    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; return f
    }()
    private static func duration(since start: Date) -> String {
        let s = Int(Date().timeIntervalSince(start))
        let h = s / 3600, m = (s % 3600) / 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }
}

// MARK: - Callback row (time · name/address · chevron)

struct CallbackRow: View {
    let knock: Knock
    let isOverdue: Bool

    var body: some View {
        HStack(spacing: 12) {
            Text(Self.time.string(from: knock.capturedAt))
                .font(.system(size: 13, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(isOverdue ? D2DColor.danger : D2DColor.muted)
                .frame(width: 48, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(knock.addressLine.isEmpty ? "Callback" : knock.addressLine)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(D2DColor.ink)
                    .lineLimit(1)
                Text(isOverdue ? "Overdue callback" : "Scheduled callback")
                    .font(.system(size: 12))
                    .foregroundStyle(D2DColor.muted)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    private static let time: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "HH:mm"; return f
    }()
}

// MARK: - Shift row (a single rostered shift)

struct ShiftRow: View {
    let shift: ShiftDTO
    let isToday: Bool
    let onClockIn: () -> Void

    private var timeRange: String { "\(shift.start)–\(shift.end)" }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(timeRange)
                        .font(.system(size: 15, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(D2DColor.ink)
                    statusPill
                }
                HStack(spacing: 6) {
                    Image(systemName: "mappin.and.ellipse")
                        .font(.system(size: 11))
                        .foregroundStyle(D2DColor.soft)
                    Text(shift.territory.isEmpty ? "No territory" : shift.territory)
                        .font(.system(size: 13))
                        .foregroundStyle(D2DColor.muted)
                        .lineLimit(1)
                    if !shift.account.isEmpty {
                        Text("· \(shift.account)")
                            .font(.system(size: 13))
                            .foregroundStyle(D2DColor.soft)
                            .lineLimit(1)
                    }
                }
            }
            Spacer(minLength: 8)
            // Clock-in CTA only for today's not-yet-active scheduled shifts.
            if isToday && shift.status == "scheduled" {
                Button(action: onClockIn) {
                    Text("Clock in")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(D2DColor.accent, in: Capsule())
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private var statusPill: some View {
        let (label, color): (String, Color) = {
            switch shift.status {
            case "active":    return ("ACTIVE", D2DColor.success)
            case "lunch":     return ("LUNCH", D2DColor.warn)
            case "completed": return ("DONE", D2DColor.soft)
            case "missed":    return ("MISSED", D2DColor.danger)
            default:          return ("SCHEDULED", D2DColor.muted)
            }
        }()
        Text(label)
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.14), in: Capsule())
    }
}

// MARK: - Pitch script card

struct PitchScriptCard: View {
    let script: String
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Opening script")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(D2DColor.ink2)
                Spacer()
                Button { withAnimation { expanded.toggle() } } label: {
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12))
                        .foregroundStyle(D2DColor.muted)
                }
            }
            Text(expanded || script.count < 120 ? script : String(script.prefix(120)) + "…")
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
