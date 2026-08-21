// KnockDetailView.swift — read-only detail screen for a single saved Knock.

import SwiftUI
import MapKit
import UIKit

struct KnockDetailView: View {
    let knock: Knock

    @State private var cameraPosition: MapCameraPosition

    init(knock: Knock) {
        self.knock = knock
        let coordinate = CLLocationCoordinate2D(latitude: knock.latitude, longitude: knock.longitude)
        let region = MKCoordinateRegion(
            center: coordinate,
            span: MKCoordinateSpan(latitudeDelta: 0.003, longitudeDelta: 0.003)
        )
        _cameraPosition = State(initialValue: .region(region))
    }

    private var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: knock.latitude, longitude: knock.longitude)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: D2DSpacing.md) {
                mapHeader
                summaryCard
                if let path = knock.photoLocalPath, let image = loadImage(path) {
                    photoCard(image)
                }
                if let notes = knock.notes, !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    notesCard(notes)
                }
                syncCard
                if knock.leadId != nil {
                    leadCard
                }
            }
            .padding(.horizontal, D2DSpacing.md)
            .padding(.top, D2DSpacing.sm)
            .padding(.bottom, D2DSpacing.lg)
        }
        .background(D2DColor.paper)
        .navigationTitle("Knock")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Map header

    private var mapHeader: some View {
        Map(position: $cameraPosition, interactionModes: []) {
            Annotation(knock.disposition.displayName, coordinate: coordinate) {
                ZStack {
                    Circle()
                        .fill(D2DColor.surface)
                        .frame(width: 34, height: 34)
                        .shadow(color: D2DColor.ink.opacity(0.25), radius: 3, y: 1)
                    Image(systemName: knock.disposition.systemImage)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(knock.disposition.color)
                }
            }
        }
        .mapStyle(.hybrid)
        .frame(height: 160)
        .clipShape(RoundedRectangle(cornerRadius: D2DRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: D2DRadius.lg)
                .strokeBorder(D2DColor.line2, lineWidth: 1)
        )
        .allowsHitTesting(false)
    }

    // MARK: - Summary card (address, disposition, captured time)

    private var summaryCard: some View {
        D2DCard {
            VStack(alignment: .leading, spacing: D2DSpacing.sm) {
                Text(knock.addressLine.isEmpty ? "Unknown address" : knock.addressLine)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(D2DColor.ink)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: D2DSpacing.sm) {
                    Image(systemName: knock.disposition.systemImage)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(knock.disposition.color)
                    D2DStatusPill(label: knock.disposition.displayName, tone: .info)
                }

                Divider().background(D2DColor.line2)

                detailRow(icon: "clock", label: "Captured", value: capturedFormatted)
                detailRow(icon: "mappin.and.ellipse", label: "Coordinate", value: coordinateFormatted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Photo card

    private func photoCard(_ image: UIImage) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader(title: "Photo")
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity)
                .frame(height: 220)
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: D2DRadius.lg))
                .overlay(
                    RoundedRectangle(cornerRadius: D2DRadius.lg)
                        .strokeBorder(D2DColor.line2, lineWidth: 1)
                )
        }
    }

    // MARK: - Notes card

    private func notesCard(_ notes: String) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader(title: "Notes")
            D2DCard {
                Text(notes)
                    .font(.system(size: 15))
                    .foregroundStyle(D2DColor.ink2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - Sync status card

    private var syncCard: some View {
        D2DCard {
            HStack(spacing: D2DSpacing.sm) {
                Image(systemName: syncIcon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(syncTint)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Sync status")
                        .font(.system(size: 11))
                        .foregroundStyle(D2DColor.muted)
                    Text(syncLabel)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(D2DColor.ink)
                }
                Spacer()
                D2DStatusPill(label: syncLabel, tone: syncTone)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Lead card

    private var leadCard: some View {
        D2DCard {
            HStack(spacing: D2DSpacing.sm) {
                Image(systemName: "person.crop.circle.badge.checkmark")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(D2DColor.accent)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Lead captured")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(D2DColor.ink)
                    Text("A lead record is attached to this knock")
                        .font(.system(size: 12))
                        .foregroundStyle(D2DColor.muted)
                }
                Spacer()
                D2DStatusPill(label: "Lead", tone: .info)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Row

    private func detailRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: D2DSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.soft)
                .frame(width: 18)
            Text(label)
                .font(.system(size: 13))
                .foregroundStyle(D2DColor.muted)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(D2DColor.ink)
        }
    }

    // MARK: - Image loading

    private func loadImage(_ path: String) -> UIImage? {
        UIImage(contentsOfFile: path)
    }

    // MARK: - Derived values

    private var capturedFormatted: String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: knock.capturedAt)
    }

    private var coordinateFormatted: String {
        String(format: "%.5f, %.5f", knock.latitude, knock.longitude)
    }

    private var syncLabel: String {
        switch knock.syncStatus {
        case .pending:  return "Pending"
        case .syncing:  return "Syncing"
        case .synced:   return "Synced"
        case .failed:   return "Failed"
        }
    }

    private var syncIcon: String {
        switch knock.syncStatus {
        case .pending:  return "clock.arrow.circlepath"
        case .syncing:  return "arrow.triangle.2.circlepath"
        case .synced:   return "checkmark.icloud"
        case .failed:   return "exclamationmark.icloud"
        }
    }

    private var syncTint: Color {
        switch knock.syncStatus {
        case .synced:   return D2DColor.success
        case .failed:   return D2DColor.danger
        default:        return D2DColor.warn
        }
    }

    private var syncTone: D2DStatusPill.Tone {
        switch knock.syncStatus {
        case .synced:   return .success
        case .failed:   return .danger
        default:        return .warn
        }
    }
}
