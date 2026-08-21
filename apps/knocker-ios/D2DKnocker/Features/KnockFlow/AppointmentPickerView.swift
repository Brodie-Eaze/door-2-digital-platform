// AppointmentPickerView.swift — schedule a callback/appointment time via presets + graphical DatePicker.

import SwiftUI

struct AppointmentPickerView: View {
    let onConfirm: (Date) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedDate: Date

    init(initialDate: Date = Date(), onConfirm: @escaping (Date) -> Void) {
        self.onConfirm = onConfirm
        _selectedDate = State(initialValue: initialDate)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    presetsSection
                    pickerSection
                }
                .padding(.horizontal, D2DSpacing.md)
                .padding(.top, D2DSpacing.sm)
                .padding(.bottom, D2DSpacing.lg)
            }
            .background(D2DColor.paper)
            .safeAreaInset(edge: .bottom) { confirmBar }
            .navigationTitle("Schedule callback")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(D2DColor.muted)
                }
            }
        }
    }

    // MARK: - Presets

    private var presetsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("QUICK PICK")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)

            VStack(spacing: 8) {
                ForEach(Self.presets, id: \.label) { preset in
                    presetRow(preset)
                }
            }
        }
    }

    private func presetRow(_ preset: Preset) -> some View {
        let date = preset.resolve()
        let isSelected = isSameMinute(date, selectedDate)
        return Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            selectedDate = date
        } label: {
            HStack(spacing: 12) {
                Image(systemName: preset.icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(isSelected ? .white : D2DColor.accent)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(preset.label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(isSelected ? .white : D2DColor.ink)
                    Text(Self.relativeFormatter.string(from: date))
                        .font(.system(size: 12))
                        .foregroundStyle(isSelected ? Color.white.opacity(0.8) : D2DColor.muted)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(.white)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                isSelected ? D2DColor.accent : D2DColor.surface,
                in: RoundedRectangle(cornerRadius: D2DRadius.lg)
            )
            .overlay(
                RoundedRectangle(cornerRadius: D2DRadius.lg)
                    .strokeBorder(isSelected ? Color.clear : D2DColor.line2, lineWidth: 1)
            )
        }
    }

    // MARK: - Graphical date picker

    private var pickerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("OR PICK A TIME")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(D2DColor.soft)
                .tracking(0.5)

            D2DCard {
                DatePicker(
                    "Callback time",
                    selection: $selectedDate,
                    in: Date()...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .datePickerStyle(.graphical)
                .tint(D2DColor.accent)
                .labelsHidden()
            }
        }
    }

    // MARK: - Confirm bar

    private var confirmBar: some View {
        VStack(spacing: 8) {
            Text("Scheduled for \(Self.summaryFormatter.string(from: selectedDate))")
                .font(.system(size: 12))
                .foregroundStyle(D2DColor.muted)

            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                onConfirm(selectedDate)
                dismiss()
            } label: {
                Text("Confirm")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(D2DColor.hero, in: RoundedRectangle(cornerRadius: D2DRadius.lg))
            }
        }
        .padding(.horizontal, D2DSpacing.md)
        .padding(.top, D2DSpacing.sm)
        .padding(.bottom, D2DSpacing.md)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) {
            Divider().background(D2DColor.line)
        }
    }

    // MARK: - Helpers

    private func isSameMinute(_ a: Date, _ b: Date) -> Bool {
        Calendar.current.isDate(a, equalTo: b, toGranularity: .minute)
    }

    // MARK: - Presets model

    private struct Preset {
        let label: String
        let icon: String
        let resolve: () -> Date
    }

    private static let presets: [Preset] = [
        Preset(label: "Later today", icon: "sun.max") {
            Date().addingTimeInterval(3 * 3600)
        },
        Preset(label: "Tomorrow AM", icon: "sunrise") {
            let cal = Calendar.current
            let tomorrow = cal.date(byAdding: .day, value: 1, to: Date()) ?? Date()
            return cal.date(bySettingHour: 9, minute: 0, second: 0, of: tomorrow) ?? tomorrow
        },
        Preset(label: "This weekend", icon: "calendar") {
            let cal = Calendar.current
            let now = Date()
            // Next Saturday at 10:00 AM.
            let weekday = cal.component(.weekday, from: now) // 1 = Sun ... 7 = Sat
            let daysUntilSat = (7 - weekday) % 7
            let offset = daysUntilSat == 0 ? 7 : daysUntilSat
            let sat = cal.date(byAdding: .day, value: offset, to: now) ?? now
            return cal.date(bySettingHour: 10, minute: 0, second: 0, of: sat) ?? sat
        }
    ]

    // MARK: - Formatters

    private static let relativeFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEE, MMM d · h:mm a"; return f
    }()
    private static let summaryFormatter: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "EEE, MMM d 'at' h:mm a"; return f
    }()
}

#Preview {
    AppointmentPickerView(onConfirm: { _ in })
}
