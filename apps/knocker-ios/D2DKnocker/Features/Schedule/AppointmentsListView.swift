// AppointmentsListView.swift — upcoming appointments & callbacks grouped by day.

import SwiftUI
import SwiftData

// TODO: A real scheduled-time field is not yet stored on Knock. Until the
// model gains a `scheduledAt` field, we use `capturedAt` as the scheduled slot
// for both the day grouping and the row time. Swap to `scheduledAt` here and in
// `AppointmentDay`/`AppointmentRow` once the field lands.

struct AppointmentsListView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var days: [AppointmentDay] = []

    var body: some View {
        ScrollView {
            if days.isEmpty {
                emptyState
            } else {
                VStack(alignment: .leading, spacing: D2DSpacing.lg) {
                    ForEach(days) { day in
                        daySection(day)
                    }
                }
                .padding(.horizontal, D2DSpacing.md)
                .padding(.top, D2DSpacing.sm)
                .padding(.bottom, D2DSpacing.lg)
            }
        }
        .background(D2DColor.paper)
        .navigationTitle("Appointments")
        .navigationBarTitleDisplayMode(.inline)
        .task { reload() }
        .refreshable { reload() }
    }

    // MARK: - Day section

    private func daySection(_ day: AppointmentDay) -> some View {
        VStack(alignment: .leading, spacing: D2DSpacing.sm) {
            Text(day.title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)

            D2DCard(padded: false) {
                VStack(spacing: 0) {
                    ForEach(Array(day.knocks.enumerated()), id: \.element.id) { idx, knock in
                        NavigationLink {
                            AppointmentDetailView(knock: knock)
                        } label: {
                            AppointmentRow(knock: knock)
                        }
                        .buttonStyle(.plain)
                        if idx < day.knocks.count - 1 {
                            Divider().padding(.leading, 64)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: D2DSpacing.md) {
            Image(systemName: "calendar.badge.checkmark")
                .font(.system(size: 34))
                .foregroundStyle(D2DColor.soft)
            Text("No appointments")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(D2DColor.ink)
            Text("Appointments and callbacks you log will appear here, grouped by day.")
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, D2DSpacing.xl)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }

    // MARK: - Data

    private func reload() {
        // SwiftData #Predicate cannot reference enum-case members; hoist rawValues
        // and filter on the stored `dispositionRaw` field.
        let appointmentRaw = KnockDisposition.appointment.rawValue
        let callbackRaw = KnockDisposition.callback.rawValue

        var descriptor = FetchDescriptor<Knock>(
            predicate: #Predicate { knock in
                knock.dispositionRaw == appointmentRaw || knock.dispositionRaw == callbackRaw
            },
            sortBy: [SortDescriptor(\.capturedAt, order: .forward)]
        )
        descriptor.fetchLimit = 500

        let knocks = (try? modelContext.fetch(descriptor)) ?? []
        days = Self.group(knocks)
    }

    /// Groups sorted knocks into day buckets, preserving chronological order.
    static func group(_ knocks: [Knock]) -> [AppointmentDay] {
        let cal = Calendar.current
        var buckets: [Date: [Knock]] = [:]
        for knock in knocks {
            let dayStart = cal.startOfDay(for: knock.capturedAt)
            buckets[dayStart, default: []].append(knock)
        }
        return buckets
            .sorted { $0.key < $1.key }
            .map { AppointmentDay(date: $0.key, knocks: $0.value) }
    }
}

// MARK: - Day bucket

struct AppointmentDay: Identifiable {
    let date: Date
    let knocks: [Knock]

    var id: Date { date }

    var title: String {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Today" }
        if cal.isDateInTomorrow(date) { return "Tomorrow" }
        if cal.isDateInYesterday(date) { return "Yesterday" }
        return Self.dayFormatter.string(from: date)
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEEE, MMM d"; return f
    }()
}

// MARK: - Row (time · address · disposition badge · chevron)

struct AppointmentRow: View {
    let knock: Knock

    var body: some View {
        HStack(spacing: D2DSpacing.md) {
            Text(Self.timeFormatter.string(from: knock.capturedAt))
                .font(.system(size: 13, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(D2DColor.muted)
                .frame(width: 56, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                Text(knock.addressLine.isEmpty ? "Untitled address" : knock.addressLine)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(D2DColor.ink)
                    .lineLimit(1)
                D2DStatusPill(label: knock.disposition.displayName, tone: .info)
            }

            Spacer(minLength: D2DSpacing.sm)

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; return f
    }()
}

// MARK: - Lightweight detail (placeholder until the canonical KnockDetailView ships)

// NOTE: The spec calls for the chevron to push `KnockDetailView(knock:)`, but
// that shared view does not yet exist in the target. This self-contained detail
// keeps the feature compiling and navigable. Replace the NavigationLink
// destination above with `KnockDetailView(knock: knock)` once it lands, and
// delete this view.
private struct AppointmentDetailView: View {
    let knock: Knock

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: D2DSpacing.md) {
                D2DCard {
                    VStack(alignment: .leading, spacing: D2DSpacing.sm) {
                        D2DStatusPill(label: knock.disposition.displayName, tone: .info)
                        Text(knock.addressLine.isEmpty ? "Untitled address" : knock.addressLine)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(D2DColor.ink)
                        Text(Self.full.string(from: knock.capturedAt))
                            .font(.system(size: 13))
                            .foregroundStyle(D2DColor.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let notes = knock.notes, !notes.isEmpty {
                    D2DCard {
                        VStack(alignment: .leading, spacing: D2DSpacing.xs) {
                            Text("NOTES")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(D2DColor.soft)
                                .tracking(0.5)
                            Text(notes)
                                .font(.system(size: 14))
                                .foregroundStyle(D2DColor.ink)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .padding(D2DSpacing.md)
        }
        .background(D2DColor.paper)
        .navigationTitle("Appointment")
        .navigationBarTitleDisplayMode(.inline)
    }

    private static let full: DateFormatter = {
        let f = DateFormatter(); f.dateStyle = .full; f.timeStyle = .short; return f
    }()
}
